import { useState, useCallback } from "react";
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
import { Upload, FileText, Loader2, CheckCircle, AlertTriangle, XCircle, Sparkles, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

type Step = 'upload' | 'analyzing' | 'preview' | 'applying';

export function ImportPDFModal({ open, onOpenChange, onImportComplete }: ImportPDFModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [editedRows, setEditedRows] = useState<ExtractedRow[]>([]);

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

  const resetState = useCallback(() => {
    setStep('upload');
    setSelectedFile(null);
    setExtractedData(null);
    setJobId(null);
    setProgress(0);
    setEditedRows([]);
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

    setStep('analyzing');
    setProgress(0);

    try {
      // 1. Render PDF to images
      toast({ title: "Processando PDF...", description: "Convertendo páginas em imagens." });
      const pages = await renderPdfToImages(selectedFile);
      setProgress(30);

      // 2. Upload PDF to storage
      toast({ title: "Enviando arquivo...", description: "Salvando PDF no servidor." });
      const timestamp = Date.now();
      const filePath = `${selectedEmpresaId}/sinistralidade/${timestamp}-${selectedFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('imports')
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        // Continue even if upload fails - we can still analyze
      }
      setProgress(40);

      // 3. Call AI agent
      toast({ title: "Analisando com IA...", description: "Extraindo dados do relatório." });
      
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sinistralidade-pdf-agent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyze',
          empresaId: selectedEmpresaId,
          filePath,
          pages
        })
      });

      setProgress(80);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro na análise');
      }

      const result = await response.json();
      setProgress(100);

      setExtractedData(result.extractedData);
      setEditedRows(result.extractedData.rows);
      setJobId(result.jobId);
      setStep('preview');

      toast({
        title: "Análise concluída!",
        description: `${result.extractedData.rows.length} registros extraídos do PDF.`
      });

    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Erro na análise",
        description: error instanceof Error ? error.message : "Falha ao processar PDF.",
        variant: "destructive"
      });
      setStep('upload');
    }
  };

  const handleRowEdit = (index: number, field: keyof ExtractedRow, value: string | number | null) => {
    const newRows = [...editedRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setEditedRows(newRows);
  };

  const handleApprove = async () => {
    if (!jobId) return;

    setStep('applying');

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
        throw new Error(error.error || 'Erro na aprovação');
      }

      const result = await response.json();

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

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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

              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <h4 className="font-medium mb-2">Tipos de relatório suportados:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Demonstrativo de Resultado - Todos os Contratos</li>
                    <li>• Custo Assistencial (por período)</li>
                    <li>• Relatório de Consultas</li>
                    <li>• Relatório de Internações</li>
                  </ul>
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
                <p className="font-medium">Analisando documento...</p>
                <p className="text-sm text-muted-foreground">
                  {progress < 30 ? 'Convertendo páginas em imagens...' :
                   progress < 40 ? 'Enviando arquivo...' :
                   progress < 80 ? 'Extraindo dados com IA...' :
                   'Finalizando análise...'}
                </p>
              </div>
              <Progress value={progress} className="w-64 mx-auto" />
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && extractedData && (
            <div className="space-y-4 py-4">
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
                <Button variant="outline" onClick={resetState} className="flex-1">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleApprove} 
                  disabled={extractedData.summary.errors > 0}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprovar e Aplicar
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Applying */}
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
