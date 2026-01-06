import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  RefreshCw,
  User,
  ArrowUpDown
} from "lucide-react";

interface TimelineEvent {
  id: string;
  tipo_evento: string;
  descricao: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  meta: Record<string, unknown> | null;
  source: string | null;
  usuario_nome: string | null;
  created_at: string;
}

interface SinistroTimelineProps {
  sinistroId: string;
}

const eventTypeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  created: {
    icon: <FileText className="h-4 w-4" />,
    color: "bg-chart-1 text-white",
    label: "Criação",
  },
  status_changed: {
    icon: <ArrowUpDown className="h-4 w-4" />,
    color: "bg-chart-2 text-white",
    label: "Status",
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "bg-success text-success-foreground",
    label: "Concluído",
  },
  sync: {
    icon: <RefreshCw className="h-4 w-4" />,
    color: "bg-chart-4 text-white",
    label: "Sync RD",
  },
  document_uploaded: {
    icon: <FileText className="h-4 w-4" />,
    color: "bg-chart-3 text-white",
    label: "Documento",
  },
  priority_changed: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: "bg-warning text-warning-foreground",
    label: "Prioridade",
  },
};

const statusLabels: Record<string, string> = {
  em_analise: "Em Análise",
  pendente_documentos: "Pendente Docs",
  em_andamento: "Em Andamento",
  enviado_operadora: "Enviado Operadora",
  aprovado: "Aprovado",
  negado: "Negado",
  pago: "Pago",
  concluido: "Concluído",
};

export function SinistroTimeline({ sinistroId }: SinistroTimelineProps) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['sinistro-timeline', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros_vida_timeline')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TimelineEvent[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico / Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico / Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhum evento registrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Histórico / Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {events.map((event) => {
              const config = eventTypeConfig[event.tipo_evento] || {
                icon: <Clock className="h-4 w-4" />,
                color: "bg-muted",
                label: event.tipo_evento,
              };

              const meta = event.meta as Record<string, unknown> | null;
              const slaHuman = meta?.sla_human as string | undefined;

              return (
                <div key={event.id} className="relative pl-10">
                  {/* Icon circle */}
                  <div 
                    className={`absolute left-0 top-0 h-8 w-8 rounded-full flex items-center justify-center ${config.color}`}
                  >
                    {config.icon}
                  </div>

                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {config.label}
                          </Badge>
                          {event.source === 'rd_station' && (
                            <Badge variant="secondary" className="text-xs">
                              RD Station
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm">
                          {event.descricao || `${event.tipo_evento}`}
                        </p>
                        {event.status_anterior && event.status_novo && (
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{statusLabels[event.status_anterior] || event.status_anterior}</span>
                            <span>→</span>
                            <span className="font-medium text-foreground">
                              {statusLabels[event.status_novo] || event.status_novo}
                            </span>
                          </div>
                        )}
                        {slaHuman && (
                          <p className="mt-1 text-xs text-success font-medium">
                            SLA: {slaHuman}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <p>{format(new Date(event.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                        <p>{format(new Date(event.created_at), "HH:mm", { locale: ptBR })}</p>
                      </div>
                    </div>
                    {event.usuario_nome && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>por {event.usuario_nome}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
