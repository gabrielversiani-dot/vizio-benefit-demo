import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bot, Sparkles, Loader2 } from "lucide-react";
import { isFeatureEnabled } from "@/config/featureFlags";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

interface Alerta {
  tipo: string;
  mensagem: string;
  severidade: "warning" | "error" | "info";
}

interface AIAlertasSectionProps {
  alertas: Alerta[];
  empresaId?: string | null;
  periodoInicio?: string | null;
  periodoFim?: string | null;
}

/**
 * Seção de Alertas e Recomendações
 * 
 * Exibe alertas baseados em regras estáticas + prepara espaço para IA.
 * 
 * Para CLIENTES: mostra apenas alertas (sem bloco IA "Em breve")
 * Para ADMINS: mostra bloco "Em breve" mesmo quando IA não habilitada
 */
export function AIAlertasSection({ 
  alertas, 
  empresaId,
  periodoInicio,
  periodoFim 
}: AIAlertasSectionProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { isAdmin, isClient } = usePermissions();
  const aiEnabled = isFeatureEnabled("AI_ALERTAS");
  
  // Clientes não veem seção "Em breve" - só veem se houver alertas reais
  const showAISection = isAdmin || aiEnabled;
  
  // Se cliente e não há alertas e IA não habilitada, não mostrar nada
  if (isClient && !aiEnabled && alertas.length === 0) {
    return null;
  }

  const handleGenerateAI = async () => {
    if (!aiEnabled) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-alertas-recomendacoes", {
        body: {
          empresaId,
          periodoInicio,
          periodoFim,
        },
      });

      if (error) throw error;

      if (data?.code === "NOT_IMPLEMENTED") {
        toast.info("Funcionalidade em desenvolvimento", {
          description: data.message,
        });
      } else {
        toast.success("Recomendações geradas com sucesso!");
      }
    } catch (error: any) {
      console.error("[AIAlertasSection] Error:", error);
      toast.error("Erro ao gerar recomendações", {
        description: error.message || "Tente novamente mais tarde",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Alertas e Recomendações
        </CardTitle>
        <CardDescription>
          Pontos de atenção e sugestões de ação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bloco IA - só mostrar para admins ou quando habilitado */}
        {showAISection && (
          <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">Assistente IA</h4>
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {aiEnabled ? "Beta" : "Em breve"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {aiEnabled 
                    ? "Gere insights e recomendações personalizadas baseadas no histórico de sinistralidade."
                    : "Em breve a IA vai analisar o histórico e sugerir ações para reduzir sinistralidade."
                  }
                </p>
                {isAdmin && (
                  <Button 
                    size="sm" 
                    className="mt-3"
                    disabled={!aiEnabled || isGenerating}
                    onClick={handleGenerateAI}
                    title={!aiEnabled ? "Em breve" : undefined}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Gerar Recomendações com IA
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alertas estáticos - sempre mostrar se houver */}
        {alertas.length > 0 && (
          <div className="space-y-3">
            {alertas.map((alerta, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-lg border ${
                  alerta.severidade === 'error' 
                    ? 'bg-destructive/10 border-destructive/20' 
                    : alerta.severidade === 'warning'
                    ? 'bg-orange-500/10 border-orange-500/20'
                    : 'bg-blue-500/10 border-blue-500/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className={`h-4 w-4 ${
                    alerta.severidade === 'error' 
                      ? 'text-destructive' 
                      : alerta.severidade === 'warning'
                      ? 'text-orange-500'
                      : 'text-blue-500'
                  }`} />
                  <span className="font-medium">{alerta.tipo}</span>
                </div>
                <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
              </div>
            ))}
          </div>
        )}

        {/* Texto informativo quando IA desabilitada - só para admins */}
        {!aiEnabled && isAdmin && alertas.length === 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Recomendações estarão disponíveis em breve.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
