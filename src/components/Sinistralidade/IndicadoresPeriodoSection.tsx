import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Activity, TrendingUp, DollarSign, Calendar, Stethoscope, BedDouble, Loader2, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { DeleteIndicadorModal } from "./DeleteIndicadorModal";
import { useAuth } from "@/hooks/useAuth";

interface IndicadorPeriodo {
  id: string;
  empresa_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  tipo_relatorio: string;
  operadora: string | null;
  produto: string | null;
  metricas: Record<string, unknown>;
  quebras: Record<string, unknown>;
  media_periodo: number | null;
  import_job_id: string | null;
  created_at: string;
}

interface IndicadoresPeriodoSectionProps {
  empresaId?: string;
}

export function IndicadoresPeriodoSection({ empresaId }: IndicadoresPeriodoSectionProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedIndicador, setSelectedIndicador] = useState<IndicadorPeriodo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch user role
  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role);
    },
    enabled: !!user?.id,
  });

  // Check if user can delete (admin_vizio or admin_empresa)
  const canDelete = userRoles.includes("admin_vizio") || userRoles.includes("admin_empresa");

  const { data: indicadores = [], isLoading } = useQuery({
    queryKey: ["indicadores-periodo", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("sinistralidade_indicadores_periodo")
        .select("*")
        .order("periodo_fim", { ascending: false })
        .limit(5);

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as IndicadorPeriodo[];
    },
  });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'custo_assistencial':
        return <DollarSign className="h-4 w-4" />;
      case 'consultas':
        return <Stethoscope className="h-4 w-4" />;
      case 'internacoes':
        return <BedDouble className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'custo_assistencial': 'Custo Assistencial',
      'consultas': 'Consultas',
      'internacoes': 'Internações',
      'demonstrativo_resultado': 'Demonstrativo de Resultado',
    };
    return labels[tipo] || tipo;
  };

  const formatMetricValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (key.includes('taxa') || key.includes('percent')) {
        return `${value.toFixed(2)}%`;
      }
      if (key.includes('custo') || key.includes('valor')) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
      }
      return value.toLocaleString('pt-BR');
    }
    return String(value);
  };

  const formatMetricKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleDeleteClick = (indicador: IndicadorPeriodo, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIndicador(indicador);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (deleteMonthly: boolean) => {
    if (!selectedIndicador) return;

    setIsDeleting(true);
    try {
      // Get auth session
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      // Use fetch directly instead of supabase.functions.invoke
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-sinistralidade-periodo`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "apikey": supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            indicadorId: selectedIndicador.id,
            deleteMonthly,
          }),
        }
      );

      let data;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 401) {
          throw new Error("Sessão expirada. Faça login novamente.");
        } else if (response.status === 403) {
          throw new Error(data?.message || "Sem permissão para excluir este indicador.");
        } else if (response.status === 404) {
          throw new Error(data?.message || "Indicador não encontrado.");
        } else {
          throw new Error(data?.message || `Erro ${response.status}: ${response.statusText}`);
        }
      }

      if (data?.ok) {
        toast.success("Indicador excluído com sucesso", {
          description: deleteMonthly && data.deletedMonthlyCount > 0
            ? `${data.deletedMonthlyCount} registros mensais também foram excluídos.`
            : undefined,
        });

        // Invalidate all related queries
        queryClient.invalidateQueries({ queryKey: ["indicadores-periodo", empresaId] });
        queryClient.invalidateQueries({ queryKey: ["sinistralidade-resumo-periodo", empresaId] });
        queryClient.invalidateQueries({ queryKey: ["sinistralidade", empresaId] });
        queryClient.invalidateQueries({ queryKey: ["sinistralidade_pdf", empresaId] });
        queryClient.invalidateQueries({ queryKey: ["sinistralidade-monthly-fallback", empresaId] });

        setDeleteModalOpen(false);
        setSelectedIndicador(null);
      } else {
        throw new Error(data?.message || "Erro ao excluir indicador");
      }
    } catch (err: any) {
      console.error("[IndicadoresPeriodoSection] Delete error:", err);
      
      // Determine error type for user-friendly message
      let errorMessage = "Erro ao excluir indicador";
      let errorDescription = err.message || "Tente novamente mais tarde";

      if (err.message?.includes("Failed to fetch") || err.name === "TypeError") {
        errorMessage = "Falha de conexão";
        errorDescription = "Não foi possível conectar ao servidor. Verifique sua conexão.";
      }

      toast.error(errorMessage, { description: errorDescription });
    } finally {
      setIsDeleting(false);
    }
  };

  const getPeriodoLabel = (indicador: IndicadorPeriodo) => {
    return `${format(new Date(indicador.periodo_inicio), "dd/MM/yyyy", { locale: ptBR })} - ${format(new Date(indicador.periodo_fim), "dd/MM/yyyy", { locale: ptBR })}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (indicadores.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Indicadores por Período
          </CardTitle>
          <CardDescription>
            Métricas detalhadas extraídas de relatórios de período. A "Média do Período" é o IU consolidado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {indicadores.map((indicador) => (
              <AccordionItem key={indicador.id} value={indicador.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left flex-1">
                    {getTipoIcon(indicador.tipo_relatorio)}
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {getTipoLabel(indicador.tipo_relatorio)}
                        {indicador.operadora && (
                          <Badge variant="secondary" className="text-xs">{indicador.operadora}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {getPeriodoLabel(indicador)}
                      </div>
                    </div>
                    {/* Media do Período como KPI principal */}
                    {indicador.media_periodo !== null && (
                      <div className="text-right mr-2">
                        <p className="text-xs text-muted-foreground">Média do Período</p>
                        <p className="text-lg font-bold text-primary">{indicador.media_periodo.toFixed(2)}%</p>
                      </div>
                    )}
                    {/* Delete button - only visible for admins */}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive mr-2"
                        onClick={(e) => handleDeleteClick(indicador, e)}
                        title="Excluir indicador"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {/* Métricas principais */}
                    {indicador.metricas && Object.keys(indicador.metricas).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Métricas</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Object.entries(indicador.metricas).map(([key, value]) => (
                            <div key={key} className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">{formatMetricKey(key)}</p>
                              <p className="font-medium">{formatMetricValue(key, value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quebras */}
                    {indicador.quebras && Object.keys(indicador.quebras).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Detalhamento</h4>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                          {JSON.stringify(indicador.quebras, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <DeleteIndicadorModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        periodoLabel={selectedIndicador ? getPeriodoLabel(selectedIndicador) : undefined}
      />
    </>
  );
}
