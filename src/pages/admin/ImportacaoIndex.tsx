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
import { Upload, FileText, Bot, Loader2, History, AlertCircle, CheckCircle, XCircle, Clock, Download } from "lucide-react";
import { ImportTestGuide } from "@/components/Admin/ImportTestGuide";

// CSV Templates
const TEMPLATES = {
  beneficiarios: {
    headers: "nome_completo;cpf;data_nascimento;sexo;tipo;titular_cpf;grau_parentesco;email;telefone;matricula;cargo;departamento;plano_saude;plano_odonto;plano_vida;status;data_inclusao;observacoes",
    example: `nome_completo;cpf;data_nascimento;sexo;tipo;titular_cpf;grau_parentesco;email;telefone;matricula;cargo;departamento;plano_saude;plano_odonto;plano_vida;status;data_inclusao;observacoes
João da Silva;123.456.789-09;1985-03-15;M;titular;;Cônjuge;joao.silva@email.com;11999998888;001;Gerente;TI;true;true;true;ativo;2024-01-01;Funcionário antigo
Maria da Silva;987.654.321-00;1988-07-20;F;dependente;123.456.789-09;Cônjuge;maria.silva@email.com;11999997777;;;false;true;false;ativo;2024-01-01;Esposa do João
Pedro da Silva;111.222.333-44;2010-11-10;M;dependente;123.456.789-09;Filho;;;;;;;true;true;true;ativo;2024-01-01;Filho do João
Ana Santos;444.555.666-77;1990-05-25;F;titular;;Cônjuge;ana.santos@email.com;11988887777;002;Analista;RH;true;true;true;ativo;2024-02-15;
Lucas Santos;555.666.777-88;2015-08-12;M;dependente;444.555.666-77;Filho;;;;;;;true;false;false;ativo;2024-02-15;Filho da Ana
Julia Santos;666.777.888-99;2018-03-01;F;dependente;444.555.666-77;Filho;;;;;;;true;false;false;ativo;2024-02-15;Filha da Ana`,
  },
  movimentacoes: {
    headers: "tipo;categoria;nome_completo;cpf;data_nascimento;data_movimentacao;motivo;observacoes",
    example: "",
  },
  faturamento: {
    headers: "competencia;categoria;valor_mensalidade;valor_coparticipacao;valor_reembolsos;valor_total;total_vidas;total_titulares;total_dependentes;data_vencimento;status",
    example: "",
  },
  sinistros: {
    headers: "competencia;categoria;valor_premio;valor_sinistros;quantidade_sinistros;sinistros_consultas;sinistros_exames;sinistros_internacoes;sinistros_procedimentos;sinistros_outros",
    example: "",
  },
};

const downloadCSV = (content: string, filename: string) => {
  // Add BOM for Excel to recognize UTF-8
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
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

        {/* Test Guide */}
        <ImportTestGuide />

        {/* Templates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Templates CSV
            </CardTitle>
            <CardDescription>
              Baixe os templates padronizados para importação de dados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Beneficiários</h4>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadCSV(TEMPLATES.beneficiarios.headers, "template_beneficiarios.csv")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Template Vazio
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadCSV(TEMPLATES.beneficiarios.example, "exemplo_beneficiarios.csv")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exemplo Preenchido
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Movimentações</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadCSV(TEMPLATES.movimentacoes.headers, "template_movimentacoes.csv")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Faturamento</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadCSV(TEMPLATES.faturamento.headers, "template_faturamento.csv")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Sinistralidade</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadCSV(TEMPLATES.sinistros.headers, "template_sinistros.csv")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p><strong>Formato:</strong> CSV separado por ponto-e-vírgula (;) ou vírgula (,)</p>
              <p><strong>Datas:</strong> Formato YYYY-MM-DD (ex: 2024-01-15)</p>
              <p><strong>Booleanos:</strong> true/false ou sim/não</p>
              <p><strong>Dependentes:</strong> Preencha titular_cpf com o CPF do titular</p>
            </div>
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
