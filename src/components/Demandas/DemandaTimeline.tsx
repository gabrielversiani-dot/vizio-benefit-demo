import { Badge } from "@/components/ui/badge";
import { format, isToday, isYesterday, startOfDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  MessageSquare, 
  Paperclip,
  PlusCircle,
  ArrowRight
} from "lucide-react";
import { HistoricoEvent } from "@/hooks/useDemandaHistorico";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  aguardando_documentacao: { label: "Aguardando Doc.", color: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
  concluido: { label: "Concluído", color: "bg-green-500/20 text-green-700 border-green-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-700 border-red-500/30" },
};

const eventConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
  created: { icon: PlusCircle, color: "text-green-600", bgColor: "bg-green-100" },
  status_changed: { icon: ArrowRight, color: "text-blue-600", bgColor: "bg-blue-100" },
  completed: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100" },
  priority_changed: { icon: AlertCircle, color: "text-orange-600", bgColor: "bg-orange-100" },
  comment_added: { icon: MessageSquare, color: "text-slate-600", bgColor: "bg-slate-100" },
  attachment_added: { icon: Paperclip, color: "text-slate-600", bgColor: "bg-slate-100" },
  rd_sync: { icon: RefreshCw, color: "text-purple-600", bgColor: "bg-purple-100" },
  sync: { icon: RefreshCw, color: "text-purple-600", bgColor: "bg-purple-100" },
};

interface DemandaTimelineProps {
  events: HistoricoEvent[];
  showDemandaTitle?: boolean;
  groupByDay?: boolean;
  className?: string;
}

function getDateGroupLabel(date: Date): string {
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  
  const daysAgo = differenceInDays(new Date(), date);
  if (daysAgo <= 7) return `${daysAgo} dias atrás`;
  
  return format(date, "dd 'de' MMMM", { locale: ptBR });
}

function groupEventsByDay(events: HistoricoEvent[]): Map<string, HistoricoEvent[]> {
  const groups = new Map<string, HistoricoEvent[]>();
  
  events.forEach(event => {
    const dateKey = startOfDay(new Date(event.created_at)).toISOString();
    const existing = groups.get(dateKey) || [];
    groups.set(dateKey, [...existing, event]);
  });
  
  return groups;
}

function TimelineEvent({ event, showDemandaTitle }: { event: HistoricoEvent; showDemandaTitle?: boolean }) {
  const eventType = event.tipo_evento || 'status_changed';
  const config = eventConfig[eventType] || eventConfig.status_changed;
  const IconComponent = config.icon;
  
  const isCompleted = eventType === 'completed';
  const meta = event.meta as HistoricoEvent['meta'];
  const slaHuman = meta?.sla_human;

  const sourceLabel = event.source === 'rd_station' ? 'RD Station' 
    : event.source === 'system' ? 'Sistema' 
    : event.usuario_nome || 'Sistema';

  return (
    <div className={cn(
      "flex gap-4 p-4 border rounded-lg transition-colors",
      isCompleted && "bg-green-50/50 border-green-200"
    )}>
      <div className="flex-shrink-0">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          config.bgColor
        )}>
          <IconComponent className={cn("h-5 w-5", config.color)} />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {showDemandaTitle && event.demandas?.titulo && (
            <span className="font-medium truncate">
              {event.demandas.titulo}
            </span>
          )}
          
          {isCompleted && (
            <Badge className="bg-green-600 text-white border-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Concluída
            </Badge>
          )}
          
          {isCompleted && slaHuman && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <Clock className="h-3 w-3 mr-1" />
              SLA: {slaHuman}
            </Badge>
          )}
          
          {eventType === 'rd_sync' || eventType === 'sync' ? (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              Sincronização RD
            </Badge>
          ) : null}
        </div>
        
        <p className="text-sm text-muted-foreground">
          {event.descricao || 'Atualização registrada'}
        </p>
        
        {event.status_anterior && event.status_novo && eventType !== 'completed' && (
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={cn("text-xs", statusConfig[event.status_anterior]?.color)}>
              {statusConfig[event.status_anterior]?.label || event.status_anterior}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className={cn("text-xs", statusConfig[event.status_novo]?.color)}>
              {statusConfig[event.status_novo]?.label || event.status_novo}
            </Badge>
          </div>
        )}
        
        {event.comentario && (
          <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
            {event.comentario}
          </div>
        )}
        
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>{sourceLabel}</span>
          <span>•</span>
          <span>
            {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DemandaTimeline({ events, showDemandaTitle = true, groupByDay = false, className }: DemandaTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Nenhum evento registrado</p>
      </div>
    );
  }

  if (groupByDay) {
    const groups = groupEventsByDay(events);
    const sortedGroups = Array.from(groups.entries()).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );

    return (
      <div className={cn("space-y-6", className)}>
        {sortedGroups.map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-0 bg-background py-1">
              {getDateGroupLabel(new Date(dateKey))}
            </h3>
            <div className="space-y-3">
              {dayEvents.map((event) => (
                <TimelineEvent 
                  key={event.id} 
                  event={event} 
                  showDemandaTitle={showDemandaTitle} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {events.map((event) => (
        <TimelineEvent 
          key={event.id} 
          event={event} 
          showDemandaTitle={showDemandaTitle} 
        />
      ))}
    </div>
  );
}
