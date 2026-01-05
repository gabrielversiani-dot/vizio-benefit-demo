import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, Circle, AlertTriangle, FileText, Loader2, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PDFImportChecklistProps {
  visible: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

export function PDFImportChecklist({ visible }: PDFImportChecklistProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      id: 'upload',
      label: 'Upload do PDF',
      description: 'Selecionar arquivo PDF do relatório Unimed',
      completed: false
    },
    {
      id: 'analyze',
      label: 'Analisar com IA',
      description: 'Executar extração via GPT-4o Vision',
      completed: false
    },
    {
      id: 'check_counts',
      label: 'Conferir contagens',
      description: 'Verificar rows/errors/warnings no preview',
      completed: false
    },
    {
      id: 'edit_field',
      label: 'Editar 1 campo',
      description: 'Alterar algum valor no preview e salvar',
      completed: false
    },
    {
      id: 'approve',
      label: 'Aprovar e aplicar',
      description: 'Confirmar importação para tabela final',
      completed: false
    },
    {
      id: 'verify_data',
      label: 'Verificar dados',
      description: 'Confirmar que dados aparecem no gráfico/tabela',
      completed: false
    }
  ]);

  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    insertedCount?: number;
    competencias?: string[];
  } | null>(null);

  // Fetch the last completed job to verify
  const { data: lastJob, refetch: refetchLastJob } = useQuery({
    queryKey: ["last-completed-job", lastJobId],
    queryFn: async () => {
      if (!lastJobId) return null;
      
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .eq("id", lastJobId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!lastJobId
  });

  // Verify data was inserted
  const verifyInsertion = async (jobId: string) => {
    setLastJobId(jobId);
    
    try {
      const { data: sinistralidade, error } = await supabase
        .from("sinistralidade")
        .select("id, competencia")
        .eq("import_job_id", jobId);

      if (error) throw error;

      if (sinistralidade && sinistralidade.length > 0) {
        setVerificationResult({
          success: true,
          message: `✅ PASSOU: ${sinistralidade.length} registros inseridos`,
          insertedCount: sinistralidade.length,
          competencias: sinistralidade.map(s => s.competencia)
        });
      } else {
        setVerificationResult({
          success: false,
          message: `❌ FALHOU: Nenhum registro encontrado para job ${jobId.slice(0, 8)}...`
        });
      }
    } catch (error) {
      setVerificationResult({
        success: false,
        message: `❌ ERRO: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });
    }
  };

  const toggleItem = (id: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const resetChecklist = () => {
    setChecklist(prev => prev.map(item => ({ ...item, completed: false })));
    setVerificationResult(null);
    setLastJobId(null);
  };

  const completedCount = checklist.filter(item => item.completed).length;
  const allCompleted = completedCount === checklist.length;

  if (!visible) return null;

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <FileText className="h-5 w-5" />
                Checklist Importação PDF (Admin)
              </CardTitle>
              <CardDescription>
                Teste guiado para validar o fluxo completo
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-blue-700">
              {completedCount}/{checklist.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Checklist Items */}
          <div className="space-y-3">
            {checklist.map((item) => (
              <div 
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                  item.completed ? 'bg-green-100/50 dark:bg-green-900/20' : 'bg-white/50 dark:bg-gray-800/50'
                }`}
              >
                <Checkbox
                  id={item.id}
                  checked={item.completed}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <div className="flex-1">
                  <label 
                    htmlFor={item.id} 
                    className={`font-medium cursor-pointer ${item.completed ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {item.label}
                  </label>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {item.completed ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>

          {/* Verification Result */}
          {verificationResult && (
            <Alert className={verificationResult.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
              <AlertDescription>
                <p className="font-medium">{verificationResult.message}</p>
                {verificationResult.competencias && (
                  <p className="text-sm mt-1">
                    Competências: {verificationResult.competencias.join(', ')}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowLogsModal(true)}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Ver Logs
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={resetChecklist}
            >
              Reiniciar Checklist
            </Button>
            {lastJobId && (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => verifyInsertion(lastJobId)}
              >
                Verificar Inserção
              </Button>
            )}
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p><strong>Instruções:</strong></p>
            <p>1. Clique em "Importar PDF (Unimed)" no topo da página</p>
            <p>2. Siga cada passo marcando conforme conclui</p>
            <p>3. Após aprovar, anote o jobId e clique em "Verificar Inserção"</p>
            <p>4. Se falhar, clique em "Ver Logs" para detalhes do erro</p>
          </div>
        </CardContent>
      </Card>

      {/* Logs Modal */}
      <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Logs de Diagnóstico</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Último Job</h4>
              {lastJob ? (
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                  {JSON.stringify(lastJob, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum job selecionado</p>
              )}
            </div>
            <div>
              <h4 className="font-medium mb-2">Resultado da Verificação</h4>
              {verificationResult ? (
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-24">
                  {JSON.stringify(verificationResult, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Execute a verificação primeiro</p>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Para logs detalhados da Edge Function, acesse:</p>
              <p className="font-mono">Lovable → Backend → Edge Function Logs → sinistralidade-pdf-agent</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
