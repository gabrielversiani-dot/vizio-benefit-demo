import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Bot, Loader2, History, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";

const ImportacaoIndex = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { empresaSelecionada, isAdminVizio } = useEmpresa();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch recent jobs
  const { data: recentJobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ["import-jobs-recent", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("import_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (empresaSelecionada && !isAdminVizio) {
        query = query.eq("empresa_id", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaSelecionada,
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ["text/csv", "application/vnd.ms-excel"];
      const isCSV = file.name.toLowerCase().endsWith('.csv');
      
      if (!validTypes.includes(file.type) && !isCSV) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione um arquivo CSV",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !empresaSelecionada) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo CSV e uma empresa",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setAnalyzing(false);

    try {
      // 1. Upload file to storage
      const timestamp = Date.now();
      const filePath = `${empresaSelecionada}/${timestamp}-${selectedFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("imports")
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      setUploading(false);
      setAnalyzing(true);

      // 2. Call edge function to analyze
      const { data, error } = await supabase.functions.invoke("admin-data-agent", {
        body: {
          action: "analyze",
          empresaId: empresaSelecionada,
          filePath,
        },
      });

      if (error) {
        console.error("Function error:", error);
        throw new Error(error.message || "Erro na análise");
      }

      if (!data?.ok || !data?.job) {
        throw new Error(data?.error || "Erro na resposta da análise");
      }

      toast({
        title: "Análise concluída!",
        description: `${data.summary.totalRows} linhas analisadas. Revise o preview.`,
      });

      // 3. Navigate to job preview
      navigate(`/admin/importacao/jobs/${data.job.id}`);

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

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock; label: string }> = {
      pending: { variant: "secondary", icon: Clock, label: "Pendente" },
      processing: { variant: "secondary", icon: Loader2, label: "Processando" },
      ready_for_review: { variant: "outline", icon: AlertCircle, label: "Aguardando Revisão" },
      completed: { variant: "default", icon: CheckCircle, label: "Concluído" },
      rejected: { variant: "destructive", icon: XCircle, label: "Rejeitado" },
      failed: { variant: "destructive", icon: XCircle, label: "Falhou" },
    };
    const c = config[status] || { variant: "outline", icon: AlertCircle, label: status };
    const Icon = c.icon;
    return (
      <Badge variant={c.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {c.label}
      </Badge>
    );
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
            Central de Importação
          </h1>
          <p className="text-muted-foreground">
            Upload de dados com análise inteligente e aprovação humana
          </p>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Nova Importação
            </CardTitle>
            <CardDescription>
              Faça upload de um arquivo CSV. A IA irá analisar, detectar o tipo de dados, 
              validar e preparar um preview para sua aprovação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!empresaSelecionada && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Selecione uma empresa no topo da página para continuar
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="file-upload">Arquivo CSV</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                disabled={!empresaSelecionada}
              />
              <p className="text-sm text-muted-foreground">
                Formato aceito: CSV (separador ; ou ,)
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
              onClick={handleAnalyze} 
              disabled={!selectedFile || uploading || analyzing || !empresaSelecionada}
              size="lg"
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
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Importações Recentes
            </CardTitle>
            <CardDescription>
              Clique em uma importação para ver detalhes ou continuar a revisão
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingJobs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : recentJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma importação encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipo Detectado</TableHead>
                    <TableHead>Linhas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {job.arquivo_nome}
                      </TableCell>
                      <TableCell>{getDataTypeLabel(job.data_type)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="default" className="text-xs">{job.valid_rows} ok</Badge>
                          {job.warning_rows > 0 && (
                            <Badge variant="secondary" className="text-xs">{job.warning_rows} avisos</Badge>
                          )}
                          {job.error_rows > 0 && (
                            <Badge variant="destructive" className="text-xs">{job.error_rows} erros</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(job.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/admin/importacao/jobs/${job.id}`)}
                        >
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ImportacaoIndex;
