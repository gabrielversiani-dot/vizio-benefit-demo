import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Sparkles, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Wand2,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { GridRow } from "./EditableGrid";

interface AIAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: 'empresas' | 'usuarios' | 'perfis' | 'roles';
  currentRows: GridRow[];
  onApplyParsed: (rows: Record<string, any>[]) => void;
  onApplyCorrections: (corrections: Array<{ row: number; field: string; value: string }>) => void;
  empresaId?: string;
}

interface ParseResult {
  parsedRows?: Record<string, any>[];
  columnMapping?: Record<string, string>;
  validations?: Array<{ row: number; field: string; type: string; message: string }>;
  suggestions?: string[];
  ambiguities?: Array<{ column: string; possibleMappings: string[]; question: string }>;
}

interface SuggestResult {
  corrections?: Array<{ row: number; field: string; currentValue: string; suggestedValue: string; reason: string }>;
  warnings?: Array<{ row: number; message: string }>;
  suggestions?: string[];
}

const STEP_LABELS: Record<string, string> = {
  empresas: 'Empresas',
  usuarios: 'Usuários',
  perfis: 'Perfis',
  roles: 'Funções/Roles',
};

const STEP_EXAMPLES: Record<string, string> = {
  empresas: `Nome	CNPJ	Razão Social	Email	Telefone
Empresa ABC	12.345.678/0001-90	ABC Ltda	contato@abc.com	(11) 98765-4321
Empresa XYZ	98.765.432/0001-10	XYZ S.A.	admin@xyz.com	(21) 3456-7890`,
  usuarios: `Email	Nome Completo
maria@empresa.com	Maria Silva
joao@empresa.com	João Santos`,
  perfis: `Email	CNPJ Empresa	Cargo	Telefone
maria@empresa.com	12.345.678/0001-90	Gerente RH	(11) 98765-4321
joao@empresa.com	12.345.678/0001-90	Analista	(11) 91234-5678`,
  roles: `Email	Role
maria@empresa.com	admin_empresa
joao@empresa.com	rh_gestor`,
};

export function AIAssistantModal({
  open,
  onOpenChange,
  step,
  currentRows,
  onApplyParsed,
  onApplyCorrections,
  empresaId,
}: AIAssistantModalProps) {
  const [pastedText, setPastedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<'parse' | 'suggest' | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [suggestResult, setSuggestResult] = useState<SuggestResult | null>(null);

  const handleParse = async () => {
    if (!pastedText.trim()) {
      toast.error("Cole os dados antes de analisar");
      return;
    }

    setIsProcessing(true);
    setMode('parse');
    setParseResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke('admin-data-agent', {
        body: {
          action: 'setup_parse',
          empresaId: empresaId || '00000000-0000-0000-0000-000000000000',
          step,
          pastedText,
        },
      });

      if (response.error) throw response.error;
      
      setParseResult(response.data as ParseResult);
      toast.success("Dados analisados com sucesso");
    } catch (err: any) {
      console.error("AI parse error:", err);
      toast.error(err.message || "Erro ao analisar dados");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggest = async () => {
    if (currentRows.length === 0) {
      toast.error("Adicione dados na grade antes de pedir sugestões");
      return;
    }

    setIsProcessing(true);
    setMode('suggest');
    setSuggestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke('admin-data-agent', {
        body: {
          action: 'setup_suggest',
          empresaId: empresaId || '00000000-0000-0000-0000-000000000000',
          step,
          currentRows: currentRows.map(r => r.data),
        },
      });

      if (response.error) throw response.error;
      
      setSuggestResult(response.data as SuggestResult);
      toast.success("Sugestões geradas");
    } catch (err: any) {
      console.error("AI suggest error:", err);
      toast.error(err.message || "Erro ao gerar sugestões");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyParsed = () => {
    if (!parseResult?.parsedRows) return;
    onApplyParsed(parseResult.parsedRows);
    toast.success(`${parseResult.parsedRows.length} registro(s) adicionados à grade`);
    handleReset();
    onOpenChange(false);
  };

  const handleApplyCorrection = (correction: { row: number; field: string; suggestedValue: string }) => {
    onApplyCorrections([{ row: correction.row, field: correction.field, value: correction.suggestedValue }]);
    toast.success("Correção aplicada");
  };

  const handleApplyAllCorrections = () => {
    if (!suggestResult?.corrections) return;
    onApplyCorrections(
      suggestResult.corrections.map(c => ({ row: c.row, field: c.field, value: c.suggestedValue }))
    );
    toast.success(`${suggestResult.corrections.length} correção(ões) aplicada(s)`);
    handleReset();
    onOpenChange(false);
  };

  const handleReset = () => {
    setPastedText("");
    setParseResult(null);
    setSuggestResult(null);
    setMode(null);
  };

  const handleCopyExample = () => {
    navigator.clipboard.writeText(STEP_EXAMPLES[step]);
    toast.success("Exemplo copiado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente IA - {STEP_LABELS[step]}
          </DialogTitle>
          <DialogDescription>
            Cole dados do Excel/Sheets ou peça sugestões de correções para os dados existentes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {/* Action buttons */}
            {!mode && (
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setMode('parse')}
                >
                  <Copy className="h-6 w-6" />
                  <span>Analisar Dados Colados</span>
                  <span className="text-xs text-muted-foreground">Cole texto e a IA organiza</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setMode('suggest')}
                  disabled={currentRows.length === 0}
                >
                  <Wand2 className="h-6 w-6" />
                  <span>Sugerir Correções</span>
                  <span className="text-xs text-muted-foreground">
                    {currentRows.length > 0 
                      ? `Analisar ${currentRows.length} registro(s)`
                      : 'Adicione dados primeiro'
                    }
                  </span>
                </Button>
              </div>
            )}

            {/* Parse mode */}
            {mode === 'parse' && !parseResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cole os dados abaixo:</span>
                  <Button variant="ghost" size="sm" onClick={handleCopyExample}>
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Ver exemplo
                  </Button>
                </div>
                <Textarea
                  placeholder={`Cole dados do Excel, Google Sheets ou texto tabulado...\n\nExemplo:\n${STEP_EXAMPLES[step].split('\n').slice(0, 2).join('\n')}`}
                  className="min-h-[200px] font-mono text-sm"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
                {step === 'usuarios' && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Por segurança, senhas NÃO são processadas pela IA. Você deverá preenchê-las manualmente.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    Voltar
                  </Button>
                  <Button onClick={handleParse} disabled={isProcessing || !pastedText.trim()}>
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Analisar com IA
                  </Button>
                </div>
              </div>
            )}

            {/* Parse result */}
            {parseResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">
                    {parseResult.parsedRows?.length || 0} registro(s) identificado(s)
                  </span>
                </div>

                {/* Column mapping */}
                {parseResult.columnMapping && Object.keys(parseResult.columnMapping).length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Mapeamento de colunas:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(parseResult.columnMapping).map(([orig, mapped]) => (
                        <Badge key={orig} variant="secondary">
                          {orig} <ArrowRight className="h-3 w-3 mx-1" /> {mapped}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validations */}
                {parseResult.validations && parseResult.validations.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Validações:</span>
                    <div className="space-y-1 mt-2">
                      {parseResult.validations.map((v, i) => (
                        <Alert key={i} variant={v.type === 'error' ? 'destructive' : 'default'}>
                          <AlertDescription className="text-sm">
                            Linha {v.row + 1}, {v.field}: {v.message}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ambiguities */}
                {parseResult.ambiguities && parseResult.ambiguities.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Ambiguidades encontradas:</span>
                    <div className="space-y-2 mt-2">
                      {parseResult.ambiguities.map((a, i) => (
                        <Alert key={i}>
                          <HelpCircle className="h-4 w-4" />
                          <AlertDescription>
                            {a.question} (Opções: {a.possibleMappings.join(', ')})
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {parseResult.suggestions && parseResult.suggestions.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Sugestões:</span>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
                      {parseResult.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preview */}
                {parseResult.parsedRows && parseResult.parsedRows.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Preview dos dados:</span>
                    <div className="mt-2 border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            {Object.keys(parseResult.parsedRows[0]).map(col => (
                              <th key={col} className="px-2 py-1 text-left font-medium">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {parseResult.parsedRows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-t">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-2 py-1">
                                  {String(val || '-')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parseResult.parsedRows.length > 5 && (
                        <div className="text-xs text-muted-foreground p-2 bg-muted/50">
                          +{parseResult.parsedRows.length - 5} mais registro(s)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    Recomeçar
                  </Button>
                  <Button 
                    onClick={handleApplyParsed} 
                    disabled={!parseResult.parsedRows?.length}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aplicar na Grade ({parseResult.parsedRows?.length || 0} registros)
                  </Button>
                </div>
              </div>
            )}

            {/* Suggest mode - loading */}
            {mode === 'suggest' && !suggestResult && (
              <div className="space-y-4">
                {isProcessing ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-muted-foreground">Analisando {currentRows.length} registro(s)...</span>
                  </div>
                ) : (
                  <>
                    <Alert>
                      <Sparkles className="h-4 w-4" />
                      <AlertDescription>
                        A IA vai analisar os {currentRows.length} registro(s) na grade e sugerir correções de formato, 
                        dados faltantes e possíveis erros.
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleReset}>
                        Voltar
                      </Button>
                      <Button onClick={handleSuggest}>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Gerar Sugestões
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Suggest result */}
            {suggestResult && (
              <div className="space-y-4">
                {/* Corrections */}
                {suggestResult.corrections && suggestResult.corrections.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {suggestResult.corrections.length} correção(ões) sugerida(s):
                      </span>
                      <Button size="sm" variant="outline" onClick={handleApplyAllCorrections}>
                        Aplicar Todas
                      </Button>
                    </div>
                    <div className="space-y-2 mt-2">
                      {suggestResult.corrections.map((c, i) => (
                        <div 
                          key={i} 
                          className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                        >
                          <div className="flex-1">
                            <div className="text-sm">
                              <strong>Linha {c.row + 1}</strong> - {c.field}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              "{c.currentValue}" → 
                              <span className="text-primary font-medium"> "{c.suggestedValue}"</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{c.reason}</div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleApplyCorrection(c)}
                          >
                            Aplicar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription>
                      Nenhuma correção necessária! Os dados parecem estar corretos.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Warnings */}
                {suggestResult.warnings && suggestResult.warnings.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Avisos:</span>
                    <div className="space-y-1 mt-2">
                      {suggestResult.warnings.map((w, i) => (
                        <Alert key={i}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Linha {w.row + 1}: {w.message}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {suggestResult.suggestions && suggestResult.suggestions.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Sugestões gerais:</span>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
                      {suggestResult.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Separator />

                <Button variant="outline" onClick={handleReset}>
                  Fazer nova análise
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
