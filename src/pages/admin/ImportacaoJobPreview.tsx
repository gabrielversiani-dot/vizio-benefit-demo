import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Bot, CheckCircle, XCircle, AlertTriangle, Loader2, FileText, ChevronLeft, ChevronRight, Search, GitBranch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { ImportJobChecklist } from "@/components/Admin/ImportJobChecklist";
import { PostApprovalValidation } from "@/components/Admin/PostApprovalValidation";
import { ExportJobCSV } from "@/components/Admin/ExportJobCSV";
import { ReimportModal } from "@/components/Admin/ReimportModal";
import { ReimportComparison } from "@/components/Admin/ReimportComparison";

type ImportJob = {
  id: string;
  empresa_id: string;
  data_type: string;
  status: string;
  arquivo_nome: string;
  arquivo_url: string;
  total_rows: number;
  valid_rows: number;
  warning_rows: number;
  error_rows: number;
  duplicate_rows: number;
  column_mapping: Record<string, string>;
  ai_summary: string | null;
  ai_suggestions: unknown;
  created_at: string;
  criado_por: string;
  aprovado_por: string | null;
  data_aprovacao: string | null;
  parent_job_id: string | null;
};

type ImportJobRow = {
  id: string;
  job_id: string;
  row_number: number;
  status: string;
  original_data: Record<string, string>;
  mapped_data: Record<string, unknown>;
  validation_errors: string[] | null;
  validation_warnings: string[] | null;
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ImportacaoJobPreview = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaSelecionada, isAdminVizio } = useEmpresa();
  
  // Pagination and filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Fetch job details
  const { data: job, isLoading: loadingJob, error: jobError } = useQuery({
    queryKey: ["import-job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (error) throw error;
      return data as ImportJob | null;
    },
    enabled: !!jobId,
  });

  // Fetch job rows with server-side pagination
  const { data: rowsResult, isLoading: loadingRows } = useQuery({
    queryKey: ["import-job-rows", jobId, statusFilter, pageSize, currentPage, debouncedSearch],
    queryFn: async () => {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("import_job_rows")
        .select("id, row_number, status, mapped_data, validation_errors, validation_warnings", { count: "exact" })
        .eq("job_id", jobId)
        .order("row_number")
        .range(from, to);

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "valid" | "warning" | "error" | "duplicate" | "updated");
      }

      // Apply search filter for beneficiarios
      if (debouncedSearch && job?.data_type === "beneficiarios") {
        const searchTerm = `%${debouncedSearch}%`;
        query = query.or(`mapped_data->>cpf.ilike.${searchTerm},mapped_data->>nome_completo.ilike.${searchTerm}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data as ImportJobRow[], totalCount: count || 0 };
    },
    enabled: !!jobId && !!job,
  });

  const jobRows = rowsResult?.rows || [];
  const totalCount = rowsResult?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Reset page when filters change
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Calculate display range
  const fromItem = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const toItem = Math.min(currentPage * pageSize, totalCount);

  const handleApprove = async () => {
    if (!job) return;

    setApproving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data-agent", {
        body: {
          action: "approve",
          jobId: job.id,
          empresaId: job.empresa_id,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Erro na aprovação");

      toast({
        title: "Importação aprovada!",
        description: `${data.inserted} registros inseridos, ${data.updated} atualizados.`,
      });

      queryClient.invalidateQueries({ queryKey: ["import-job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs-recent"] });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro na aprovação",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!job) return;

    setRejecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data-agent", {
        body: {
          action: "reject",
          jobId: job.id,
          empresaId: job.empresa_id,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Erro ao descartar");

      toast({
        title: "Importação descartada",
        description: "Os dados não foram inseridos.",
      });

      queryClient.invalidateQueries({ queryKey: ["import-job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs-recent"] });
      navigate("/admin/importacao");

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  const getRowStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      valid: { variant: "default", label: "Válido" },
      warning: { variant: "secondary", label: "Aviso" },
      error: { variant: "destructive", label: "Erro" },
      duplicate: { variant: "outline", label: "Duplicado" },
    };
    const c = config[status] || { variant: "outline", label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getDataTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      beneficiarios: "Beneficiários",
      faturamento: "Faturamento",
      sinistralidade: "Sinistralidade",
      movimentacoes: "Movimentações",
      contratos: "Contratos",
    };
    return labels[type] || type;
  };

  const canApprove = job?.status === "ready_for_review" && (job.valid_rows > 0 || job.warning_rows > 0);
  const canReject = job?.status === "ready_for_review";

  if (loadingJob) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (jobError || !job) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Importação não encontrada</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/importacao")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Check access for non-admin_vizio users
  if (!isAdminVizio && job.empresa_id !== empresaSelecionada) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <p className="text-destructive">Você não tem acesso a esta importação.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/importacao")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/importacao")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Preview da Importação</h1>
            <p className="text-muted-foreground font-mono text-sm">{job.arquivo_nome}</p>
          </div>
          
          {/* Status Badge + Reimport Badge */}
          <div className="flex items-center gap-2">
            {job.parent_job_id && (
              <Badge variant="outline" className="bg-primary/10">
                <GitBranch className="h-3 w-3 mr-1" />
                Reimportação
              </Badge>
            )}
            <Badge 
              variant={job.status === "completed" ? "default" : job.status === "rejected" ? "destructive" : "secondary"}
              className="text-sm px-3 py-1"
            >
              {job.status === "ready_for_review" ? "Aguardando Revisão" : 
               job.status === "completed" ? "Concluído" : 
               job.status === "rejected" ? "Rejeitado" : job.status}
            </Badge>
          </div>
        </div>

        {/* Reimport Comparison (if this is a reimport) */}
        {job.parent_job_id && (
          <ReimportComparison jobId={job.id} parentJobId={job.parent_job_id} />
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tipo Detectado</CardDescription>
              <CardTitle className="text-lg">{getDataTypeLabel(job.data_type)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Linhas</CardDescription>
              <CardTitle className="text-lg">{job.total_rows}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" /> Válidas
              </CardDescription>
              <CardTitle className="text-lg text-green-600">{job.valid_rows}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-600" /> Avisos
              </CardDescription>
              <CardTitle className="text-lg text-yellow-600">{job.warning_rows}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-600" /> Erros
              </CardDescription>
              <CardTitle className="text-lg text-red-600">{job.error_rows}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Job Checklist */}
        <ImportJobChecklist job={job} rows={jobRows} />

        {/* AI Summary */}
        {job.ai_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Análise da IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg whitespace-pre-wrap text-sm">
                {job.ai_summary}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Column Mapping */}
        {job.column_mapping && Object.keys(job.column_mapping).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Mapeamento de Colunas</CardTitle>
              <CardDescription>Colunas do arquivo → Campos do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(job.column_mapping).map(([original, mapped]) => (
                  <Badge key={original} variant="outline" className="text-xs">
                    {original} → {mapped}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Preview */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Preview dos Dados</CardTitle>
                  <CardDescription>
                    {totalCount > 0 
                      ? `Mostrando ${fromItem}–${toItem} de ${totalCount} linhas`
                      : "Nenhuma linha encontrada"}
                  </CardDescription>
                </div>
                
                {/* Export Buttons */}
                <ExportJobCSV
                  jobId={job.id}
                  dataType={job.data_type}
                  totalRows={job.total_rows}
                  statusFilter={statusFilter}
                  searchQuery={debouncedSearch}
                  filteredCount={totalCount}
                />
              </div>
              
              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Select value={statusFilter} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="valid">Válidos</SelectItem>
                      <SelectItem value="warning">Avisos</SelectItem>
                      <SelectItem value="error">Erros</SelectItem>
                      <SelectItem value="duplicate">Duplicados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Page Size */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Por página:</span>
                  <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={job?.data_type === "beneficiarios" ? "Buscar por CPF ou Nome..." : "Buscar..."}
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingRows ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : jobRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma linha encontrada para os filtros atuais</p>
                {(statusFilter !== "all" || searchQuery) && (
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => {
                      setStatusFilter("all");
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : (
              <>
                <ScrollArea className="h-[400px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead>Dados Mapeados</TableHead>
                        <TableHead className="w-[300px]">Validação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobRows.map((row) => (
                        <TableRow 
                          key={row.id} 
                          className={row.status === 'error' ? 'bg-destructive/5' : row.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}
                        >
                          <TableCell className="font-mono text-sm">{row.row_number}</TableCell>
                          <TableCell>{getRowStatusBadge(row.status)}</TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-xs font-mono space-x-2 truncate">
                              {Object.entries(row.mapped_data || {}).slice(0, 4).map(([k, v]) => (
                                <span key={k}>
                                  <span className="text-muted-foreground">{k}:</span> {String(v)}
                                </span>
                              ))}
                              {Object.keys(row.mapped_data || {}).length > 4 && (
                                <span className="text-muted-foreground">...</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.validation_errors?.map((err, i) => (
                                <Badge key={`err-${i}`} variant="destructive" className="text-xs">
                                  {err}
                                </Badge>
                              ))}
                              {row.validation_warnings?.map((warn, i) => (
                                <Badge key={`warn-${i}`} variant="secondary" className="text-xs">
                                  {warn}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Próximo
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {job.status === "ready_for_review" && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Reimport button (when there are errors/warnings) */}
              {(job.error_rows > 0 || job.warning_rows > 0) && (
                <div className="flex justify-end">
                  <ReimportModal
                    jobId={job.id}
                    empresaId={job.empresa_id}
                    dataType={job.data_type}
                    errorRows={job.error_rows}
                    warningRows={job.warning_rows}
                    onExportErrors={() => {
                      // Trigger filtered export with error status
                      handleStatusChange("error");
                    }}
                  />
                </div>
              )}
              <div className="flex gap-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      className="flex-1" 
                      size="lg"
                      disabled={!canApprove || approving}
                    >
                      {approving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Aprovar e Inserir ({job.valid_rows + job.warning_rows} registros)
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Importação</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div>
                          <p>
                            Você está prestes a inserir <strong>{job.valid_rows + job.warning_rows}</strong> registros 
                            na tabela de <strong>{getDataTypeLabel(job.data_type)}</strong>.
                          </p>
                          {job.duplicate_rows > 0 && (
                            <p className="mt-2 flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              {job.duplicate_rows} registros serão atualizados (duplicados).
                            </p>
                          )}
                          <p className="mt-2 text-destructive font-medium">
                            Esta ação não pode ser desfeita facilmente.
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleApprove}>
                        Confirmar Importação
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      size="lg"
                      disabled={!canReject || rejecting}
                    >
                      {rejecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Descartar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Descartar Importação?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Os dados analisados serão descartados e nenhum registro será inserido no banco.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReject}>
                        Descartar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed/Rejected Message */}
        {job.status === "completed" && (
          <>
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium text-green-600">Importação Concluída</p>
                <p className="text-sm text-muted-foreground">
                  Aprovada em {job.data_aprovacao ? new Date(job.data_aprovacao).toLocaleString("pt-BR") : "-"}
                </p>
              </CardContent>
            </Card>

            {/* Post-Approval Validation */}
            <PostApprovalValidation
              jobId={job.id}
              empresaId={job.empresa_id}
              dataType={job.data_type}
              rows={jobRows}
            />
          </>
        )}

        {job.status === "rejected" && (
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="pt-6 text-center">
              <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-red-600">Importação Descartada</p>
              <p className="text-sm text-muted-foreground">
                Nenhum dado foi inserido no banco
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default ImportacaoJobPreview;
