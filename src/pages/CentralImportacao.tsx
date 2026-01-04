import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Loader2, Bot, History, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";

type ImportJob = {
  id: string;
  empresa_id: string;
  data_type: string;
  status: string;
  arquivo_nome: string;
  total_rows: number;
  valid_rows: number;
  warning_rows: number;
  error_rows: number;
  duplicate_rows: number;
  column_mapping: Record<string, string>;
  ai_summary: string;
  created_at: string;
  profiles?: { nome_completo: string };
};

type ImportJobRow = {
  id: string;
  row_number: number;
  status: string;
  original_data: Record<string, string>;
  mapped_data: Record<string, unknown>;
  validation_errors: string[] | null;
  validation_warnings: string[] | null;
};

const CentralImportacao = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaSelecionada, isAdminVizio } = useEmpresa();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [jobRows, setJobRows] = useState<ImportJobRow[]>([]);
  const [approving, setApproving] = useState(false);

  // Fetch pending jobs
  const { data: pendingJobs = [], isLoading: loadingPending } = useQuery({
    queryKey: ["import-jobs-pending", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("import_jobs")
        .select("*")
        .eq("status", "ready_for_review")
        .order("created_at", { ascending: false });

      if (empresaSelecionada && !isAdminVizio) {
        query = query.eq("empresa_id", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profiles separately
      const jobs = data || [];
      const userIds = [...new Set(jobs.map(j => j.criado_por))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.nome_completo]) || []);
      
      return jobs.map(j => ({
        ...j,
        profiles: { nome_completo: profileMap.get(j.criado_por) || "-" }
      })) as ImportJob[];
    },
  });

  // Fetch history
  const { data: historyJobs = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["import-jobs-history", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("import_jobs")
        .select("*")
        .in("status", ["completed", "rejected", "failed"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (empresaSelecionada && !isAdminVizio) {
        query = query.eq("empresa_id", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const jobs = data || [];
      const userIds = [...new Set(jobs.map(j => j.criado_por))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.nome_completo]) || []);
      
      return jobs.map(j => ({
        ...j,
        profiles: { nome_completo: profileMap.get(j.criado_por) || "-" }
      })) as ImportJob[];
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione um arquivo CSV ou Excel",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile || !empresaSelecionada) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo e uma empresa",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setAnalyzing(false);
    setCurrentJob(null);
    setJobRows([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Upload file
      const fileName = `${empresaSelecionada}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("imports")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      setUploading(false);
      setAnalyzing(true);

      // Call edge function for analysis
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("admin-data-agent", {
        body: {
          action: "analyze",
          empresaId: empresaSelecionada,
          filePath: fileName,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data;
      if (!result.success) throw new Error(result.error || "Erro na análise");

      setCurrentJob(result.job);

      // Fetch job rows
      const { data: rows, error: rowsError } = await supabase
        .from("import_job_rows")
        .select("*")
        .eq("job_id", result.job.id)
        .order("row_number");

      if (rowsError) throw rowsError;
      setJobRows(rows as ImportJobRow[]);

      queryClient.invalidateQueries({ queryKey: ["import-jobs-pending"] });

      toast({
        title: "Análise concluída!",
        description: `${result.summary.totalRows} linhas analisadas. Revise os dados antes de aprovar.`,
      });

      setSelectedFile(null);
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleViewJob = async (job: ImportJob) => {
    setCurrentJob(job);
    
    const { data: rows, error } = await supabase
      .from("import_job_rows")
      .select("*")
      .eq("job_id", job.id)
      .order("row_number");

    if (!error) {
      setJobRows(rows as ImportJobRow[]);
    }
  };

  const handleApprove = async () => {
    if (!currentJob) return;

    setApproving(true);
    try {
      const response = await supabase.functions.invoke("admin-data-agent", {
        body: {
          action: "approve",
          jobId: currentJob.id,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data;
      
      toast({
        title: "Importação concluída!",
        description: `${result.inserted} registros inseridos, ${result.updated} atualizados.`,
      });

      setCurrentJob(null);
      setJobRows([]);
      queryClient.invalidateQueries({ queryKey: ["import-jobs-pending"] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs-history"] });

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
    if (!currentJob) return;

    try {
      const response = await supabase.functions.invoke("admin-data-agent", {
        body: {
          action: "reject",
          jobId: currentJob.id,
        },
      });

      if (response.error) throw new Error(response.error.message);

      toast({
        title: "Importação descartada",
        description: "Os dados não foram inseridos.",
      });

      setCurrentJob(null);
      setJobRows([]);
      queryClient.invalidateQueries({ queryKey: ["import-jobs-pending"] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs-history"] });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      valid: { variant: "default", label: "Válido" },
      warning: { variant: "secondary", label: "Aviso" },
      error: { variant: "destructive", label: "Erro" },
      duplicate: { variant: "outline", label: "Duplicado" },
    };
    const c = config[status] || { variant: "outline", label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getJobStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pendente" },
      processing: { variant: "secondary", label: "Processando" },
      ready_for_review: { variant: "outline", label: "Aguardando Revisão" },
      approved: { variant: "default", label: "Aprovado" },
      completed: { variant: "default", label: "Concluído" },
      rejected: { variant: "destructive", label: "Rejeitado" },
      failed: { variant: "destructive", label: "Falhou" },
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8" />
            Central de Importação com IA
          </h1>
          <p className="text-muted-foreground">
            Upload de dados com análise inteligente, validação e aprovação humana
          </p>
        </div>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Nova Importação
            </TabsTrigger>
            <TabsTrigger value="pending">
              <Sparkles className="h-4 w-4 mr-2" />
              Pendentes ({pendingJobs.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Upload e Análise Inteligente
                </CardTitle>
                <CardDescription>
                  Faça upload de um arquivo CSV ou Excel. A IA irá detectar o tipo de dados, 
                  mapear as colunas, validar e preparar um preview para sua aprovação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file-upload">Selecione o arquivo</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                  />
                  <p className="text-sm text-muted-foreground">
                    Formatos aceitos: CSV (separador ; ou ,), Excel (.xlsx, .xls)
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}

                <Button 
                  onClick={handleUploadAndAnalyze} 
                  disabled={!selectedFile || uploading || analyzing || !empresaSelecionada}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Fazendo upload...
                    </>
                  ) : analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analisando com IA...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Analisar com IA
                    </>
                  )}
                </Button>

                {!empresaSelecionada && (
                  <p className="text-sm text-destructive text-center">
                    Selecione uma empresa no topo da página
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preview Section */}
            {currentJob && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Preview da Importação</CardTitle>
                      <CardDescription>
                        Tipo detectado: <strong>{getDataTypeLabel(currentJob.data_type)}</strong>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {currentJob.valid_rows} válidos
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {currentJob.warning_rows} avisos
                      </Badge>
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        {currentJob.error_rows} erros
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* AI Summary */}
                  {currentJob.ai_summary && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-5 w-5 text-primary" />
                        <span className="font-medium">Análise da IA</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{currentJob.ai_summary}</p>
                    </div>
                  )}

                  {/* Column Mapping */}
                  {currentJob.column_mapping && (
                    <div className="space-y-2">
                      <Label>Mapeamento de Colunas</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(currentJob.column_mapping).map(([original, mapped]) => (
                          <Badge key={original} variant="outline" className="text-xs">
                            {original} → {mapped}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data Preview */}
                  <div className="space-y-2">
                    <Label>Preview dos Dados ({jobRows.length} linhas)</Label>
                    <ScrollArea className="h-[400px] border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">#</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead>Dados Mapeados</TableHead>
                            <TableHead>Validação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobRows.map((row) => (
                            <TableRow key={row.id} className={row.status === 'error' ? 'bg-destructive/5' : ''}>
                              <TableCell className="font-mono text-sm">{row.row_number}</TableCell>
                              <TableCell>{getStatusBadge(row.status)}</TableCell>
                              <TableCell className="max-w-md">
                                <div className="text-xs font-mono truncate">
                                  {Object.entries(row.mapped_data || {}).slice(0, 4).map(([k, v]) => (
                                    <span key={k} className="mr-2">
                                      <span className="text-muted-foreground">{k}:</span> {String(v)}
                                    </span>
                                  ))}
                                  {Object.keys(row.mapped_data || {}).length > 4 && '...'}
                                </div>
                              </TableCell>
                              <TableCell>
                                {row.validation_errors?.map((err, i) => (
                                  <Badge key={i} variant="destructive" className="mr-1 mb-1 text-xs">
                                    {err}
                                  </Badge>
                                ))}
                                {row.validation_warnings?.map((warn, i) => (
                                  <Badge key={i} variant="secondary" className="mr-1 mb-1 text-xs">
                                    {warn}
                                  </Badge>
                                ))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4 border-t">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          className="flex-1" 
                          disabled={approving || currentJob.error_rows === currentJob.total_rows}
                        >
                          {approving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Aprovar e Inserir ({currentJob.valid_rows + currentJob.warning_rows} registros)
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Importação</AlertDialogTitle>
                          <AlertDialogDescription>
                            Você está prestes a inserir <strong>{currentJob.valid_rows + currentJob.warning_rows}</strong> registros 
                            na tabela de <strong>{getDataTypeLabel(currentJob.data_type)}</strong>.
                            {currentJob.duplicate_rows > 0 && (
                              <span className="block mt-2">
                                <AlertTriangle className="h-4 w-4 inline mr-1" />
                                {currentJob.duplicate_rows} registros serão atualizados (duplicados).
                              </span>
                            )}
                            <span className="block mt-2 text-destructive">
                              Esta ação não pode ser desfeita facilmente.
                            </span>
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
                        <Button variant="destructive" className="flex-1">
                          <XCircle className="h-4 w-4 mr-2" />
                          Descartar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Descartar Importação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Os dados analisados serão descartados e nenhum registro será inserido.
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
          </TabsContent>

          <TabsContent value="pending" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Importações Pendentes de Revisão</CardTitle>
                <CardDescription>
                  Clique em uma importação para revisar e aprovar
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPending ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma importação pendente
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Linhas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado por</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-mono text-sm">{job.arquivo_nome}</TableCell>
                          <TableCell>{getDataTypeLabel(job.data_type)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Badge variant="default" className="text-xs">{job.valid_rows}</Badge>
                              <Badge variant="secondary" className="text-xs">{job.warning_rows}</Badge>
                              <Badge variant="destructive" className="text-xs">{job.error_rows}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>{getJobStatusBadge(job.status)}</TableCell>
                          <TableCell>{job.profiles?.nome_completo || "-"}</TableCell>
                          <TableCell>{new Date(job.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <Button size="sm" onClick={() => handleViewJob(job)}>
                              Revisar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Importações</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : historyJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum histórico encontrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Linhas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado por</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-mono text-sm">{job.arquivo_nome}</TableCell>
                          <TableCell>{getDataTypeLabel(job.data_type)}</TableCell>
                          <TableCell>{job.total_rows}</TableCell>
                          <TableCell>{getJobStatusBadge(job.status)}</TableCell>
                          <TableCell>{job.profiles?.nome_completo || "-"}</TableCell>
                          <TableCell>{new Date(job.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CentralImportacao;
