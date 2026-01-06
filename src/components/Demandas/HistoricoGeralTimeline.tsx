import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, Search, Clock, X, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, RefreshCw, PlusCircle } from "lucide-react";
import { useDemandaHistoricoGeral, HistoricoEvent } from "@/hooks/useDemandaHistorico";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const eventTypeOptions = [
  { value: "todos", label: "Todos os Eventos" },
  { value: "created", label: "Criação" },
  { value: "status_changed", label: "Mudança de Status" },
  { value: "priority_changed", label: "Mudança de Prioridade" },
  { value: "completed", label: "Concluídos" },
  { value: "rd_sync", label: "Sincronização RD" },
  { value: "comment_added", label: "Comentários" },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  aguardando_documentacao: { label: "Aguardando Doc.", color: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
  concluido: { label: "Concluído", color: "bg-green-500/20 text-green-700 border-green-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-700 border-red-500/30" },
};

interface GroupedDemanda {
  demandaId: string;
  titulo: string;
  latestStatus: string | null;
  origins: Set<string>;
  events: HistoricoEvent[];
  slaHuman: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HistoricoGeralTimelineProps {
  empresaId: string | undefined;
}

// Deduplicate events that are essentially the same (same type, similar timestamp within 2 min, same message)
function deduplicateEvents(events: HistoricoEvent[]): HistoricoEvent[] {
  const seen = new Map<string, HistoricoEvent>();
  
  for (const event of events) {
    // Create a key based on type, description, and rounded timestamp
    const timestampRounded = Math.floor(new Date(event.created_at).getTime() / (2 * 60 * 1000)); // 2-minute buckets
    const key = `${event.tipo_evento}-${event.descricao || ''}-${timestampRounded}`;
    
    // Keep the most recent version if duplicate
    const existing = seen.get(key);
    if (!existing || new Date(event.created_at) > new Date(existing.created_at)) {
      seen.set(key, event);
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

// Group events by demanda_id and consolidate
function groupEventsByDemanda(events: HistoricoEvent[]): GroupedDemanda[] {
  const groups = new Map<string, GroupedDemanda>();
  
  for (const event of events) {
    const demandaId = event.demanda_id;
    
    if (!groups.has(demandaId)) {
      groups.set(demandaId, {
        demandaId,
        titulo: event.demandas?.titulo || 'Demanda sem título',
        latestStatus: null,
        origins: new Set(),
        events: [],
        slaHuman: null,
        createdAt: event.created_at,
        updatedAt: event.created_at,
      });
    }
    
    const group = groups.get(demandaId)!;
    group.events.push(event);
    
    // Track origins
    if (event.source) {
      group.origins.add(event.source === 'rd_station' ? 'RD Station' : 
                        event.source === 'system' ? 'Sistema' : event.source);
    }
    
    // Update latest status
    if (event.status_novo) {
      group.latestStatus = event.status_novo;
    }
    
    // Extract SLA if completed
    if (event.tipo_evento === 'completed') {
      const meta = event.meta as { sla_human?: string } | null;
      if (meta?.sla_human) {
        group.slaHuman = meta.sla_human;
      }
    }
    
    // Track timestamps
    if (new Date(event.created_at) > new Date(group.updatedAt)) {
      group.updatedAt = event.created_at;
    }
    if (new Date(event.created_at) < new Date(group.createdAt)) {
      group.createdAt = event.created_at;
    }
  }
  
  // Deduplicate events within each group
  for (const group of groups.values()) {
    group.events = deduplicateEvents(group.events);
  }
  
  // Sort by most recent activity
  return Array.from(groups.values()).sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function EventIcon({ type }: { type: string | null }) {
  switch (type) {
    case 'created':
      return <PlusCircle className="h-4 w-4 text-green-600" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'priority_changed':
      return <ArrowUpDown className="h-4 w-4 text-orange-600" />;
    case 'status_changed':
      return <AlertCircle className="h-4 w-4 text-blue-600" />;
    case 'rd_sync':
    case 'sync':
      return <RefreshCw className="h-4 w-4 text-purple-600" />;
    default:
      return <Clock className="h-4 w-4 text-slate-600" />;
  }
}

function DemandaGroupCard({ group }: { group: GroupedDemanda }) {
  const [isOpen, setIsOpen] = useState(false);
  const isConcluida = group.latestStatus === 'concluido';
  const originsArray = Array.from(group.origins);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        isConcluida && "border-green-200 bg-green-50/30"
      )}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors text-left">
            <div className="flex-shrink-0 mt-1">
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium truncate">{group.titulo}</span>
                
                {/* Status Badge */}
                {group.latestStatus && (
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", statusConfig[group.latestStatus]?.color)}
                  >
                    {isConcluida && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {statusConfig[group.latestStatus]?.label || group.latestStatus}
                  </Badge>
                )}
                
                {/* SLA Badge */}
                {isConcluida && group.slaHuman && (
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    SLA: {group.slaHuman}
                  </Badge>
                )}
              </div>
              
              {/* Origins and event count */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {originsArray.length > 0 && (
                  <span className="flex items-center gap-1">
                    Origem: {originsArray.join(' + ')}
                  </span>
                )}
                <span>•</span>
                <span>{group.events.length} evento{group.events.length > 1 ? 's' : ''}</span>
                <span>•</span>
                <span>Última atualização: {format(new Date(group.updatedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 border-t bg-muted/20">
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Timeline de Eventos
            </h4>
            <div className="space-y-2">
              {group.events.map((event, index) => (
                <div 
                  key={event.id} 
                  className="flex items-start gap-3 p-2 rounded bg-background border"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <EventIcon type={event.tipo_evento} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{event.descricao || 'Atualização registrada'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>
                        {event.source === 'rd_station' ? 'RD Station' : 
                         event.source === 'system' ? 'Sistema' : 
                         event.usuario_nome || 'Sistema'}
                      </span>
                      <span>•</span>
                      <span>
                        {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {event.tipo_evento === 'completed' && (
                        <>
                          <span>•</span>
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                            Concluída
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function HistoricoGeralTimeline({ empresaId }: HistoricoGeralTimelineProps) {
  const [filtroTipoEvento, setFiltroTipoEvento] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  
  const { data: historico = [], isLoading } = useDemandaHistoricoGeral(empresaId, 500);

  // Filter events first, then group
  const filteredEvents = useMemo(() => {
    return historico.filter((event) => {
      // Filter by event type
      if (filtroTipoEvento !== "todos" && event.tipo_evento !== filtroTipoEvento) {
        return false;
      }
      
      // Filter by search text
      if (filtroBusca) {
        const searchLower = filtroBusca.toLowerCase();
        const matchesDemanda = event.demandas?.titulo?.toLowerCase().includes(searchLower);
        const matchesDescricao = event.descricao?.toLowerCase().includes(searchLower);
        const matchesUsuario = event.usuario_nome?.toLowerCase().includes(searchLower);
        if (!matchesDemanda && !matchesDescricao && !matchesUsuario) {
          return false;
        }
      }
      
      return true;
    });
  }, [historico, filtroTipoEvento, filtroBusca]);

  // Group events by demanda
  const groupedDemandas = useMemo(() => {
    return groupEventsByDemanda(filteredEvents);
  }, [filteredEvents]);

  // Count completed demands
  const completedCount = groupedDemandas.filter(g => g.latestStatus === 'concluido').length;

  const clearFilters = () => {
    setFiltroTipoEvento("todos");
    setFiltroBusca("");
  };

  const hasActiveFilters = filtroTipoEvento !== "todos" || filtroBusca !== "";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Histórico / Prestação de Contas</CardTitle>
            <CardDescription>
              Acompanhe todas as atividades e eventos das demandas consolidados por solicitação
            </CardDescription>
          </div>
          
          {completedCount > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 self-start">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {completedCount} demanda{completedCount > 1 ? 's' : ''} concluída{completedCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          <div className="w-48">
            <Select value={filtroTipoEvento} onValueChange={setFiltroTipoEvento}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tipo de Evento" />
              </SelectTrigger>
              <SelectContent>
                {eventTypeOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 min-w-[200px] max-w-sm relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por demanda, descrição..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        {/* Results summary */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {groupedDemandas.length} demanda{groupedDemandas.length !== 1 ? 's' : ''} 
            {hasActiveFilters && ` (${filteredEvents.length} eventos filtrados)`}
          </p>
          <p className="text-xs text-muted-foreground">
            Clique para expandir e ver a timeline completa
          </p>
        </div>

        {/* Grouped Demands */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : groupedDemandas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto opacity-30 mb-3" />
            {hasActiveFilters 
              ? "Nenhuma demanda encontrada com os filtros selecionados"
              : "Nenhum histórico disponível ainda"
            }
          </div>
        ) : (
          <div className="space-y-3">
            {groupedDemandas.map((group) => (
              <DemandaGroupCard key={group.demandaId} group={group} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
