import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, FileText, Upload, Loader2, CheckCircle, ArrowRight } from "lucide-react";

interface Props {
  jobId: string;
  empresaId: string;
  dataType: string;
  errorRows: number;
  warningRows: number;
}

type Step = 1 | 2 | 3;

// Supabase Edge Function URL
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function ReimportModal({ jobId, empresaId, dataType, errorRows, warningRows }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Export errors/warnings using edge function
  const handleExportErrors = async () => {
    setExporting(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        throw new Error("Sessão não encontrada");
      }

      const accessToken = sessionData.session.access_token;
      const functionUrl = `${SUPABASE_URL}/functions/v1/export-import-job`;

      // Export only error and warning rows
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          jobId, 
          statusFilter: 'error,warning', // Export both errors and warnings
          searchQuery: '' 
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro ${response.status}`);
        }
        throw new Error(`Erro ${response.status}`);
      }

      // Get filename from Content-Disposition header
      let filename = `erros_avisos_${new Date().toISOString().slice(0, 10)}.csv`;
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportação concluída!",
        description: `Arquivo "${filename}" baixado. Corrija e continue.`,
      });

      setCurrentStep(2);
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const isCSV = file.name.toLowerCase().endsWith('.csv');
      if (!isCSV) {
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

  const handleReimport = async () => {
    if (!selectedFile) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo CSV corrigido",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // 1. Upload file to storage
      const timestamp = Date.now();
      const filePath = `${empresaId}/reimports/${jobId}/${timestamp}-${selectedFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("imports")
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // 2. Call edge function to analyze with parentJobId
      const { data, error } = await supabase.functions.invoke("admin-data-agent", {
        body: {
          action: "analyze",
          empresaId,
          filePath,
          parentJobId: jobId,
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
        title: "Reimportação iniciada!",
        description: `${data.summary.totalRows} linhas analisadas. Revise o preview.`,
      });

      // 3. Close modal and navigate to new job
      setOpen(false);
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
    }
  };

  const resetModal = () => {
    setCurrentStep(1);
    setSelectedFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetModal();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={errorRows === 0 && warningRows === 0}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reimportar Linhas Corrigidas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Corrigir e Reimportar
          </DialogTitle>
          <DialogDescription>
            Corrija os erros/avisos no CSV e reimporte para aplicar as correções
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step
                        ? "bg-green-600 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step ? <CheckCircle className="h-4 w-4" /> : step}
                </div>
                {step < 3 && (
                  <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Export */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Passo 1: Exportar erros/avisos
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Baixe o CSV com as linhas que precisam de correção:
                </p>
                <div className="flex gap-2 mb-3">
                  <Badge variant="destructive">{errorRows} erros</Badge>
                  <Badge variant="secondary">{warningRows} avisos</Badge>
                </div>
                <Button onClick={handleExportErrors} disabled={exporting}>
                  {exporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exportando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Erros e Avisos
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Se já exportou o arquivo, clique em{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setCurrentStep(2)}
                >
                  pular para o passo 2
                </button>
              </p>
            </div>
          )}

          {/* Step 2: Instructions */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Passo 2: Corrigir o CSV
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Abra o arquivo exportado no Excel ou editor de planilhas</li>
                  <li>• Corrija os dados nas linhas indicadas como erro/aviso</li>
                  <li>• <strong>Mantenha os cabeçalhos exatamente como estão</strong></li>
                  <li>• Salve como CSV (separador ponto-e-vírgula ou vírgula)</li>
                </ul>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                  Voltar
                </Button>
                <Button onClick={() => setCurrentStep(3)}>
                  Continuar para Upload
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Upload */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Passo 3: Enviar CSV corrigido
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione o arquivo CSV corrigido para análise:
                </p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="reimport-file">Arquivo CSV corrigido</Label>
                    <Input
                      id="reimport-file"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                  </div>
                  {selectedFile && (
                    <div className="flex items-center gap-2 p-2 bg-primary/5 rounded text-sm">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>{selectedFile.name}</span>
                      <span className="text-muted-foreground">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                  Voltar
                </Button>
                <Button 
                  onClick={handleReimport} 
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Analisar Correções
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
