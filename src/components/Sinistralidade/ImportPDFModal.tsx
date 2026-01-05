import { useState, useCallback, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, CheckCircle, AlertTriangle, XCircle, Sparkles, Building2, Save, Edit, Copy, Bug, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { pdfjsLib } from "@/lib/pdfjs";

interface Empresa {
  id: string;
  nome: string;
}

interface ExtractedRow {
  competencia: string | null;
  vidas: number | null;
  faturamento: number | null;
  sinistros: number | null;
  iu: number | null;
  observacoes: string | null;
  page_ref: string;
}

interface ExtractedData {
  document_type: string;
  meta: {
    operadora: string;
    empresa_nome: string | null;
    produto: string | null;
    periodo_inicio: string | null;
    periodo_fim: string | null;
  };
  rows: ExtractedRow[];
  indicadores_periodo: {
    tipo: string | null;
    metricas: Record<string, unknown>;
    quebras: Record<string, unknown>;
  };
  validations: {
    errors: string[];
    warnings: string[];
  };
  summary: {
    rows: number;
    errors: number;
    warnings: number;
  };
}

interface ImportPDFModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'analyzing' | 'preview' | 'saving' | 'applying';
type AnalyzeMode = 'client_render' | 'server_fallback';

export function ImportPDFModal({ open, onOpenChange, onImportComplete }: ImportPDFModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [editedRows, setEditedRows] = useState<ExtractedRow[]>([]);
  const [originalRows, setOriginalRows] = useState<ExtractedRow[]>([]);
  const [changesSaved, setChangesSaved] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  // Debug/meta
  const [analysisMode, setAnalysisMode] = useState<AnalyzeMode>('client_render');
  const [analysisRequestId, setAnalysisRequestId] = useState<string | null>(null);
  const [analysisDurationMs, setAnalysisDurationMs] = useState<number | null>(null);
  const [showDebugDetails, setShowDebugDetails] = useState(false);

  const workerSrc = pdfjsLib?.GlobalWorkerOptions?.workerSrc || '';

  // Fetch empresas
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  // Diagnostics (admin_vizio only)
  const { data: isAdminVizio = false } = useQuery({
    queryKey: ["import-pdf-is-admin-vizio"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin_vizio')
        .maybeSingle();
      return !!data;
    },
    enabled: open,
  });

  // Detect dirty state (changes not saved)
  const isDirty = useMemo(() => {
    if (editedRows.length !== originalRows.length) return true;
    return editedRows.some((row, index) => {
      const original = originalRows[index];
      if (!original) return true;
      return (
        row.competencia !== original.competencia ||
        row.vidas !== original.vidas ||
        row.faturamento !== original.faturamento ||
        row.sinistros !== original.sinistros ||
        row.iu !== original.iu ||
        row.observacoes !== original.observacoes
      );
    });
  }, [editedRows, originalRows]);

  // Update changesSaved when dirty state changes
  useEffect(() => {
    if (isDirty) {
      setChangesSaved(false);
    }
  }, [isDirty]);

  const resetState = useCallback(() => {
    setStep('upload');
    setSelectedFile(null);
    setExtractedData(null);
    setJobId(null);
    setProgress(0);
    setEditedRows([]);
    setOriginalRows([]);
    setChangesSaved(true);
    setLastError(null);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo PDF.",
        variant: "destructive"
      });
    }
  };

  const renderPdfToImages = async (file: File): Promise<Array<{ pageNumber: number; imageBase64: string }>> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: Array<{ pageNumber: number; imageBase64: string }> = [];

    const numPages = Math.min(pdf.numPages, 5); // Limit to 5 pages

    for (let i = 1; i <= numPages; i++) {
      setProgress((i / numPages) * 30);
      const page = await pdf.getPage(i);
      const scale = 2; // Higher scale for better quality
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      const imageBase64 = canvas.toDataURL('image/png');
      pages.push({ pageNumber: i, imageBase64 });
    }

    return pages;
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !selectedEmpresaId) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um arquivo PDF e uma empresa.",
        variant: "destructive"
      });
      return;
    }

    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const startedAt = performance.now();

    setAnalysisRequestId(requestId);
    setAnalysisDurationMs(null);
    setShowDebugDetails(false);
    setLastError(null);

    setStep('analyzing');
    setProgress(0);

    let mode: AnalyzeMode = 'client_render';
    let pages: Array<{ pageNumber: number; imageBase64: string }> = [];

    try {
      // 1) Try client-side render (worker local)
      try {
        toast({ title: "Processando PDF...", description: "Convertendo páginas em imagens." });
        pages = await renderPdfToImages(selectedFile);
        if (!pages || pages.length === 0) {
          throw new Error('Nenhuma página renderizada');
        }
      } catch (err) {
        console.warn('Client PDF render failed, switching to server fallback:', err);
        mode = 'server_fallback';
        pages = [];
        toast({
          title: "Modo compatibilidade",
          description: "Falha ao processar no navegador; analisando no servidor..."
        });
      }

      setAnalysisMode(mode);
      setProgress(30);

      // 2) Upload PDF to storage (required for server fallback)
      toast({ title: "Enviando arquivo...", description: "Salvando PDF no servidor." });
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const timestamp = Date.now();
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${selectedEmpresaId}/unimed_bh/${year}/${month}/${timestamp}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('sinistralidade_pdfs')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw new Error(`Falha no upload do PDF: ${uploadError.message}`);
      }

      setProgress(40);

      // 3) Call AI agent
      toast({ title: "Analisando com IA...", description: mode === 'server_fallback' ? "Processando PDF no servidor." : "Extraindo dados do relatório." });

      const { data: session } = await supabase.auth.getSession();

      const body: any = {
        action: 'analyze',
        empresaId: selectedEmpresaId,
        filePath,
        requestId,
        mode,
      };
      if (mode === 'client_render') {
        body.pages = pages;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sinistralidade-pdf-agent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      setProgress(80);

      const durationMs = Math.round(performance.now() - startedAt);
      setAnalysisDurationMs(durationMs);

      if (!response.ok) {
        const errorText = await response.text();
        setLastError(errorText);
        
        // Parse structured error if available
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.code === 'LOVABLE_AI_RATE_LIMIT') {
            toast({
              title: "Limite temporário atingido",
              description: "Aguarde alguns instantes e tente novamente.",
              variant: "destructive"
            });
          } else if (errorData.code === 'LOVABLE_AI_NO_BALANCE') {
            toast({
              title: "Sem saldo de AI",
              description: "Recarregue seu saldo em Settings → Cloud & AI balance.",
              variant: "destructive"
            });
          } else if (errorData.code === 'AI_JSON_PARSE_FAILED') {
            toast({
              title: "Falha ao interpretar resposta da IA",
              description: "A IA retornou dados em formato inválido. Tente novamente.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Erro na análise",
              description: errorData.message || "Clique em 'Ver detalhes' para mais informações.",
              variant: "destructive"
            });
          }
        } catch {
          toast({
            title: "Erro na análise",
            description: "Clique em 'Ver detalhes' para copiar o erro completo.",
            variant: "destructive"
          });
        }
        
        setStep('upload');
        return;
      }

      const result = await response.json();
      setProgress(100);

      setExtractedData(result.extractedData);
      setEditedRows(result.extractedData.rows);
      setOriginalRows(result.extractedData.rows);
      setJobId(result.jobId);
      setChangesSaved(true);

      // 4) Save document record in sinistralidade_documentos
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const competencias = result.extractedData.rows
          .map((r: ExtractedRow) => r.competencia)
          .filter((c: string | null): c is string => c !== null);

        await supabase
          .from('sinistralidade_documentos')
          .insert({
            empresa_id: selectedEmpresaId,
            operadora: result.extractedData.meta?.operadora || 'Unimed BH',
            tipo_relatorio: result.extractedData.document_type,
            periodo_inicio: result.extractedData.meta?.periodo_inicio,
            periodo_fim: result.extractedData.meta?.periodo_fim,
            competencias: competencias.length > 0 ? competencias : null,
            file_path: filePath,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            status: result.extractedData.summary?.errors > 0 ? 'failed' : 'analyzed',
            import_job_id: result.jobId,
            ai_summary: result.extractedData.summary ? 
              `${result.extractedData.summary.rows} registros, ${result.extractedData.summary.errors} erros, ${result.extractedData.summary.warnings} avisos` : null,
            uploaded_by: user.id,
          });
      }

      setStep('preview');

      toast({
        title: "Análise concluída!",
        description: `${result.extractedData.rows.length} registros extraídos do PDF.`
      });

    } catch (error) {
      console.error('Analysis error:', error);
      if (!lastError) {
        const fallback = error instanceof Error
          ? JSON.stringify({ message: error.message, stack: error.stack }, null, 2)
          : JSON.stringify({ error }, null, 2);
        setLastError(fallback);
      }
      setStep('upload');
      toast({
        title: "Erro na análise",
        description: "Clique em 'Ver detalhes' para copiar o erro completo.",
        variant: "destructive"
      });
    }
  };

  const handleRowEdit = (index: number, field: keyof ExtractedRow, value: string | number | null) => {
    const newRows = [...editedRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setEditedRows(newRows);
  };

  // Save changes to import_job_rows
  const handleSaveChanges = async () => {
    if (!jobId) return;

    setStep('saving');

    try {
      const { data: session } = await supabase.auth.getSession();

      // Update each row in the database
      for (let i = 0; i < editedRows.length; i++) {
        const row = editedRows[i];
        const { error } = await supabase
          .from('import_job_rows')
          .update({
            mapped_data: {
              competencia: row.competencia,
              vidas: row.vidas,
              faturamento: row.faturamento,
              sinistros: row.sinistros,
              iu: row.iu,
              observacoes: row.observacoes,
              page_ref: row.page_ref,
              operadora: extractedData?.meta.operadora,
              produto: extractedData?.meta.produto
            }
          })
          .eq('job_id', jobId)
          .eq('row_number', i + 1);

        if (error) {
          console.error('Error updating row:', error);
          throw new Error(`Erro ao salvar linha ${i + 1}`);
        }
      }

      // Update original rows to match edited rows
      setOriginalRows([...editedRows]);
      setChangesSaved(true);
      setStep('preview');

      toast({
        title: "Alterações salvas!",
        description: "Os dados editados foram salvos no staging."
      });

    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Falha ao salvar alterações.",
        variant: "destructive"
      });
      setStep('preview');
    }
  };

  const handleApprove = async () => {
    if (!jobId) return;

    // Block if there are unsaved changes
    if (isDirty && !changesSaved) {
      toast({
        title: "Alterações não salvas",
        description: "Salve as alterações antes de aprovar.",
        variant: "destructive"
      });
      return;
    }

    setStep('applying');
    setLastError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sinistralidade-pdf-agent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
          empresaId: selectedEmpresaId,
          jobId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        setLastError(JSON.stringify(error, null, 2));
        throw new Error(error.error || 'Erro na aprovação');
      }

      const result = await response.json();

      // Update document status to 'applied'
      if (jobId) {
        await supabase
          .from('sinistralidade_documentos')
          .update({ status: 'applied' })
          .eq('import_job_id', jobId);
      }

      toast({
        title: "Dados importados!",
        description: result.message
      });

      onImportComplete();
      onOpenChange(false);
      resetState();

    } catch (error) {
      console.error('Approve error:', error);
      toast({
        title: "Erro na aprovação",
        description: error instanceof Error ? error.message : "Falha ao aplicar dados.",
        variant: "destructive"
      });
      setStep('preview');
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'demonstrativo_resultado': 'Demonstrativo de Resultado',
      'custo_assistencial': 'Custo Assistencial',
      'consultas': 'Relatório de Consultas',
      'internacoes': 'Relatório de Internações',
      'unknown': 'Tipo não identificado'
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar PDF Sinistralidade (Unimed BH)
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Selecione o PDF do relatório Unimed e a empresa.'}
            {step === 'analyzing' && 'Analisando o PDF com inteligência artificial...'}
            {step === 'preview' && 'Revise os dados extraídos antes de aplicar.'}
            {step === 'saving' && 'Salvando alterações...'}
            {step === 'applying' && 'Aplicando dados no sistema...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                  <SelectTrigger>
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Arquivo PDF</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    {selectedFile ? (
                      <div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">Clique para selecionar</p>
                        <p className="text-sm text-muted-foreground">ou arraste o arquivo PDF aqui</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {lastError && (
                <Alert variant="destructive">
                  <AlertDescription className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Falha na análise.</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowDebugDetails((v) => !v)}
                        >
                          <Bug className="h-4 w-4 mr-2" />
                          Ver detalhes
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            const payload = JSON.stringify({
                              requestId: analysisRequestId,
                              mode: analysisMode,
                              duration_ms: analysisDurationMs,
                              workerSrc,
                              error: lastError,
                            }, null, 2);
                            await navigator.clipboard.writeText(payload);
                            toast({ title: "Copiado", description: "Detalhes copiados para a área de transferência." });
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar
                        </Button>
                      </div>
                    </div>

                    {showDebugDetails && (
                      <pre className="text-xs overflow-auto max-h-48 rounded-md bg-muted p-3">{JSON.stringify({
                        requestId: analysisRequestId,
                        mode: analysisMode,
                        duration_ms: analysisDurationMs,
                        workerSrc,
                        error: lastError,
                      }, null, 2)}</pre>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <h4 className="font-medium mb-2">Tipos de relatório suportados:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Demonstrativo de Resultado - Todos os Contratos</li>
                    <li>• Custo Assistencial (por período)</li>
                    <li>• Relatório de Consultas</li>
                    <li>• Relatório de Internações</li>
                  </ul>

                  {isAdminVizio && (
                    <div className="mt-4 rounded-lg border bg-background p-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Bug className="h-4 w-4" />
                        Diagnóstico rápido (worker PDF.js)
                      </div>
                      <div className="mt-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">workerSrc</span>
                          <Badge variant="outline" className="font-mono max-w-[65%] truncate">{workerSrc || 'vazio'}</Badge>
                        </div>
                        {(!workerSrc || workerSrc.includes('cdnjs')) && (
                          <div className="mt-2 text-destructive">
                            Alerta: workerSrc inválido (vazio ou contém cdnjs). O processamento no navegador pode falhar.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleAnalyze} 
                disabled={!selectedFile || !selectedEmpresaId}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Analisar com IA
              </Button>
            </div>
          )}

           {/* Step 2: Analyzing */}
           {step === 'analyzing' && (
             <div className="py-12 text-center space-y-6">
               <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
               <div className="space-y-2">
                 <p className="font-medium">
                   {analysisMode === 'server_fallback' ? 'Analisando no servidor (modo compatibilidade)...' : 'Analisando documento...'}
                 </p>
                 <p className="text-sm text-muted-foreground">
                   {analysisMode === 'server_fallback'
                     ? 'Baixando PDF e tentando extrair texto automaticamente...'
                     : (progress < 30 ? 'Convertendo páginas em imagens...' :
                        progress < 40 ? 'Enviando arquivo...' :
                        progress < 80 ? 'Extraindo dados com IA...' :
                        'Finalizando análise...')}
                 </p>
               </div>
               <Progress value={progress} className="w-64 mx-auto" />
             </div>
           )}

          {/* Step 3: Preview */}
          {step === 'preview' && extractedData && (
            <div className="space-y-4 py-4">
              {/* Dirty state warning */}
              {isDirty && !changesSaved && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                  <Edit className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Você tem alterações não salvas. Salve antes de aprovar.</span>
                    <Button size="sm" onClick={handleSaveChanges}>
                      <Save className="h-4 w-4 mr-1" />
                      Salvar
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{extractedData.summary.rows}</p>
                    <p className="text-xs text-muted-foreground">Registros</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{extractedData.summary.rows - extractedData.summary.errors - extractedData.summary.warnings}</p>
                    <p className="text-xs text-muted-foreground">Válidos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{extractedData.summary.warnings}</p>
                    <p className="text-xs text-muted-foreground">Avisos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{extractedData.summary.errors}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </CardContent>
                </Card>
              </div>

              {/* Metadata */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{getDocumentTypeLabel(extractedData.document_type)}</Badge>
                    <Badge variant="secondary">{extractedData.meta.operadora}</Badge>
                    {extractedData.meta.produto && (
                      <Badge variant="secondary">{extractedData.meta.produto}</Badge>
                    )}
                    {extractedData.meta.periodo_inicio && extractedData.meta.periodo_fim && (
                      <Badge variant="outline">
                        {extractedData.meta.periodo_inicio} a {extractedData.meta.periodo_fim}
                      </Badge>
                    )}
                    {jobId && (
                      <Badge variant="outline" className="font-mono text-xs">
                        Job: {jobId.slice(0, 8)}...
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Validation Messages */}
              {(extractedData.validations.errors.length > 0 || extractedData.validations.warnings.length > 0) && (
                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="p-4">
                    {extractedData.validations.errors.map((err, i) => (
                      <div key={`err-${i}`} className="flex items-center gap-2 text-sm text-red-600">
                        <XCircle className="h-4 w-4" />
                        {err}
                      </div>
                    ))}
                    {extractedData.validations.warnings.map((warn, i) => (
                      <div key={`warn-${i}`} className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        {warn}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Last Error */}
              {lastError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <details>
                      <summary className="cursor-pointer font-medium">Ver erro completo</summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-32">{lastError}</pre>
                    </details>
                  </AlertDescription>
                </Alert>
              )}

              {/* Data Table */}
              <ScrollArea className="h-[300px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Página</TableHead>
                      <TableHead className="w-24">Competência</TableHead>
                      <TableHead className="w-20">Vidas</TableHead>
                      <TableHead>Faturamento</TableHead>
                      <TableHead>Sinistros</TableHead>
                      <TableHead className="w-20">IU %</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editedRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant="outline">{row.page_ref}</Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.competencia || ''}
                            onChange={(e) => handleRowEdit(index, 'competencia', e.target.value)}
                            className="h-8 w-24"
                            placeholder="YYYY-MM"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={row.vidas || ''}
                            onChange={(e) => handleRowEdit(index, 'vidas', e.target.value ? parseInt(e.target.value) : null)}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={row.faturamento || ''}
                            onChange={(e) => handleRowEdit(index, 'faturamento', e.target.value ? parseFloat(e.target.value) : null)}
                            className="h-8 w-32"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={row.sinistros || ''}
                            onChange={(e) => handleRowEdit(index, 'sinistros', e.target.value ? parseFloat(e.target.value) : null)}
                            className="h-8 w-32"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={row.iu || ''}
                            onChange={(e) => handleRowEdit(index, 'iu', e.target.value ? parseFloat(e.target.value) : null)}
                            className="h-8 w-20"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.observacoes || ''}
                            onChange={(e) => handleRowEdit(index, 'observacoes', e.target.value || null)}
                            className="h-8"
                            placeholder="..."
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Indicadores de Período */}
              {extractedData.indicadores_periodo?.tipo && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">Indicadores do Período</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                      {JSON.stringify(extractedData.indicadores_periodo, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={resetState}>
                  Cancelar
                </Button>
                {isDirty && !changesSaved && (
                  <Button variant="secondary" onClick={handleSaveChanges}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </Button>
                )}
                <Button 
                  onClick={handleApprove} 
                  disabled={extractedData.summary.errors > 0 || (isDirty && !changesSaved)}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprovar e Aplicar
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Saving */}
          {step === 'saving' && (
            <div className="py-12 text-center space-y-6">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="font-medium">Salvando alterações...</p>
            </div>
          )}

          {/* Step 5: Applying */}
          {step === 'applying' && (
            <div className="py-12 text-center space-y-6">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="font-medium">Aplicando dados no sistema...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
