import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Bug, 
  Copy, 
  Check, 
  ChevronDown, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Play,
  XCircle
} from "lucide-react";
import { toast } from "sonner";

export interface DiagnosticLog {
  timestamp: string;
  step: string;
  action: string;
  payload?: any;
  response?: any;
  durationMs?: number;
  status: 'success' | 'error' | 'warning' | 'pending';
  error?: string;
}

interface DiagnosticPanelProps {
  logs: DiagnosticLog[];
  isRunning: boolean;
  onRunTests: () => Promise<void>;
  onClearLogs: () => void;
  currentStep: string;
}

export function DiagnosticPanel({ 
  logs, 
  isRunning, 
  onRunTests, 
  onClearLogs,
  currentStep 
}: DiagnosticPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const stepLogs = logs.filter(l => l.step === currentStep);
  const successCount = stepLogs.filter(l => l.status === 'success').length;
  const errorCount = stepLogs.filter(l => l.status === 'error').length;
  const warningCount = stepLogs.filter(l => l.status === 'warning').length;

  const handleCopyReport = async () => {
    const report = {
      generatedAt: new Date().toISOString(),
      step: currentStep,
      summary: {
        total: stepLogs.length,
        success: successCount,
        errors: errorCount,
        warnings: warningCount,
      },
      logs: stepLogs.map(l => ({
        timestamp: l.timestamp,
        action: l.action,
        status: l.status,
        durationMs: l.durationMs,
        error: l.error,
        payload: l.payload,
        response: l.response,
      })),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      toast.success('Relatório copiado para a área de transferência');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar relatório');
    }
  };

  const getStatusIcon = (status: DiagnosticLog['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: DiagnosticLog['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">OK</Badge>;
      case 'error':
        return <Badge variant="destructive">ERRO</Badge>;
      case 'warning':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">AVISO</Badge>;
      case 'pending':
        return <Badge variant="secondary">PENDENTE</Badge>;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed border-orange-300 bg-orange-50/50 dark:bg-orange-950/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-orange-600" />
                <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Modo Diagnóstico
                </CardTitle>
                {stepLogs.length > 0 && (
                  <div className="flex gap-1 ml-2">
                    {successCount > 0 && (
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                        {successCount} ✓
                      </Badge>
                    )}
                    {errorCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {errorCount} ✗
                      </Badge>
                    )}
                    {warningCount > 0 && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 text-xs">
                        {warningCount} ⚠
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onRunTests}
                disabled={isRunning}
                className="gap-1"
              >
                {isRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Rodar Testes
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleCopyReport}
                disabled={stepLogs.length === 0}
                className="gap-1"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Copiar Relatório
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={onClearLogs}
                disabled={logs.length === 0}
                className="text-muted-foreground"
              >
                Limpar Logs
              </Button>
            </div>

            {/* Logs */}
            {stepLogs.length > 0 ? (
              <ScrollArea className="h-64 rounded border bg-background">
                <div className="p-2 space-y-2">
                  {stepLogs.map((log, idx) => (
                    <Collapsible key={idx}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm">
                          {getStatusIcon(log.status)}
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                          </span>
                          <span className="flex-1 font-medium truncate">{log.action}</span>
                          {log.durationMs && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {log.durationMs}ms
                            </span>
                          )}
                          {getStatusBadge(log.status)}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-6 p-2 bg-muted/50 rounded text-xs font-mono space-y-2">
                          {log.error && (
                            <div className="text-destructive">
                              <strong>Erro:</strong> {log.error}
                            </div>
                          )}
                          {log.payload && (
                            <div>
                              <strong className="text-muted-foreground">Payload:</strong>
                              <pre className="mt-1 p-2 bg-background rounded overflow-auto max-h-32">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.response && (
                            <div>
                              <strong className="text-muted-foreground">Resposta:</strong>
                              <pre className="mt-1 p-2 bg-background rounded overflow-auto max-h-32">
                                {JSON.stringify(log.response, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum log de diagnóstico. Clique em "Rodar Testes" para começar.
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
