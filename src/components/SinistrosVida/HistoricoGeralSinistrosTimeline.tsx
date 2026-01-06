import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, Search, Clock, X, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, RefreshCw, PlusCircle, FileText } from "lucide-react";
import { useSinistroVidaHistoricoGeral, SinistroTimelineEvent } from "@/hooks/useSinistroVidaHistorico";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatSLA } from "@/lib/formatSLA";

const eventTypeOptions = [
  { value: "todos", label: "Todos os Eventos" },
  { value: "created", label: "Criação" },
  { value: "status_changed", label: "Mudança de Status" },
  { value: "priority_changed", label: "Mudança de Prioridade" },
  { value: "completed", label: "Concluídos" },
  { value: "sync", label: "Sincronização RD" },
  { value: "document_uploaded", label: "Documentos" },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  em_analise: { label: "Em Análise", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  pendente_documentos: { label: "Pendente Docs", color: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  enviado_operadora: { label: "Enviado Operadora", color: "bg-purple-500/20 text-purple-700 border-purple-500/30" },
  aprovado: { label: "Aprovado", color: "bg-green-500/20 text-green-700 border-green-500/30" },
  negado: { label: "Negado", color: "bg-red-500/20 text-red-700 border-red-500/30" },
  pago: { label: "Pago", color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" },
  concluido: { label: "Concluído", color: "bg-green-500/20 text-green-700 border-green-500/30" },
};

interface GroupedSinistro {
  sinistroId: string;
  beneficiarioNome: string;
  tipoSinistro: string;
  latestStatus: string | null;
  origins: Set<string>;
  events: SinistroTimelineEvent[];
  slaHuman: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HistoricoGeralSinistrosTimelineProps {
  empresaId: string | undefined;
}

// Deduplicate events
function deduplicateEvents(events: SinistroTimelineEvent[]): SinistroTimelineEvent[] {
  const seen = new Map<string, SinistroTimelineEvent>();
  
  for (const event of events) {
    const timestampRounded = Math.floor(new Date(event.created_at).getTime() / (2 * 60 * 1000));
    const key = `${event.tipo_evento}-${event.descricao || ''}-${timestampRounded}`;
    
    const existing = seen.get(key);
    if (!existing || new Date(event.created_at) > new Date(existing.created_at)) {
      seen.set(key, event);
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

// Group events by sinistro
function groupEventsBySinistro(events: SinistroTimelineEvent[]): GroupedSinistro[] {
  const groups = new Map<string, GroupedSinistro>();
  
  for (const event of events) {
    const sinistroId = event.sinistro_id;
    
    if (!groups.has(sinistroId)) {
      groups.set(sinistroId, {
        sinistroId,
        beneficiarioNome: event.sinistros_vida?.beneficiario_nome || 'Sinistro',
        tipoSinistro: event.sinistros_vida?.tipo_sinistro || '',
        latestStatus: event.sinistros_vida?.status || null,
        origins: new Set(),
        events: [],
        slaHuman: null,
        createdAt: event.created_at,
        updatedAt: event.created_at,
      });
    }
    
    const group = groups.get(sinistroId)!;
    group.events.push(event);
    
    if (event.source) {
      group.origins.add(event.source === 'rd_station' ? 'RD Station' : 
                        event.source === 'sistema' ? 'Sistema' : event.source);
    }
    
    if (event.status_novo) {
      group.latestStatus = event.status_novo;
    }
    
    if (event.tipo_evento === 'completed' || event.tipo_evento === 'status_changed') {
      const meta = event.meta as { sla_human?: string; sla_minutos?: number } | null;
      if (meta?.sla_human) {
        group.slaHuman = meta.sla_human;
      } else if (meta?.sla_minutos) {
        group.slaHuman = formatSLA(meta.sla_minutos * 60);
      }
    }
    
    if (new Date(event.created_at) > new Date(group.updatedAt)) {
      group.updatedAt = event.created_at;
    }
    if (new Date(event.created_at) < new Date(group.createdAt)) {
      group.createdAt = event.created_at;
    }
  }
  
  for (const group of groups.values()) {
    group.events = deduplicateEvents(group.events);
  }
  
  return Array.from(groups.values()).sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'created':
      return <PlusCircle className="h-4 w-4 text-green-600" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'priority_changed':
      return <ArrowUpDown className="h-4 w-4 text-orange-600" />;
    case 'status_changed':
      return <AlertCircle className="h-4 w-4 text-blue-600" />;
    case 'sync':
      return <RefreshCw className="h-4 w-4 text-purple-600" />;
    case 'document_uploaded':
      return <FileText className="h-4 w-4 text-slate-600" />;
    default:
      return <Clock className="h-4 w-4 text-slate-600" />;
  }
}

function SinistroGroupCard({ group }: { group: GroupedSinistro }) {
  const [isOpen, setIsOpen] = useState(false);
  const isConcluido = ['concluido', 'pago', 'aprovado'].includes(group.latestStatus || '');
  const originsArray = Array.from(group.origins);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        isConcluido && "border-green-200 bg-green-50/30"
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
                <span className="font-medium truncate">{group.beneficiarioNome}</span>
                
                {group.latestStatus && (
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", statusConfig[group.latestStatus]?.color)}
                  >
                    {isConcluido && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {statusConfig[group.latestStatus]?.label || group.latestStatus}
                  </Badge>
                )}
                
                {isConcluido && group.slaHuman && (
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    SLA: {group.slaHuman}
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {group.tipoSinistro && (
                  <>
                    <span>{group.tipoSinistro.replace(/_/g, ' ')}</span>
                    <span>•</span>
                  </>
                )}
                {originsArray.length > 0 && (
                  <>
                    <span>Origem: {originsArray.join(' + ')}</span>
                    <span>•</span>
                  </>
                )}
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
              {group.events.map((event) => (
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
                         event.source === 'sistema' ? 'Sistema' : 
                         event.usuario_nome || 'Sistema'}
                      </span>
                      <span>•</span>
                      <span>
                        {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {(event.tipo_evento === 'completed' || ['concluido', 'pago'].includes(event.status_novo || '')) && (
                        <>
                          <span>•</span>
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                            Concluído
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

export function HistoricoGeralSinistrosTimeline({ empresaId }: HistoricoGeralSinistrosTimelineProps) {
  const [filtroTipoEvento, setFiltroTipoEvento] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  
  const { data: historico = [], isLoading } = useSinistroVidaHistoricoGeral(empresaId, 500);

  const filteredEvents = useMemo(() => {
    return historico.filter((event) => {
      if (filtroTipoEvento !== "todos" && event.tipo_evento !== filtroTipoEvento) {
        return false;
      }
      
      if (filtroBusca) {
        const searchLower = filtroBusca.toLowerCase();
        const matchesBeneficiario = event.sinistros_vida?.beneficiario_nome?.toLowerCase().includes(searchLower);
        const matchesDescricao = event.descricao?.toLowerCase().includes(searchLower);
        const matchesUsuario = event.usuario_nome?.toLowerCase().includes(searchLower);
        if (!matchesBeneficiario && !matchesDescricao && !matchesUsuario) {
          return false;
        }
      }
      
      return true;
    });
  }, [historico, filtroTipoEvento, filtroBusca]);

  const groupedSinistros = useMemo(() => {
    return groupEventsBySinistro(filteredEvents);
  }, [filteredEvents]);

  const completedCount = groupedSinistros.filter(g => 
    ['concluido', 'pago', 'aprovado'].includes(g.latestStatus || '')
  ).length;

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
              Acompanhe todas as atividades e eventos dos sinistros consolidados por caso
            </CardDescription>
          </div>
          
          {completedCount > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 self-start">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {completedCount} sinistro{completedCount > 1 ? 's' : ''} concluído{completedCount > 1 ? 's' : ''}
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
              placeholder="Buscar por beneficiário, descrição..."
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
            {groupedSinistros.length} sinistro{groupedSinistros.length !== 1 ? 's' : ''} 
            {hasActiveFilters && ` (${filteredEvents.length} eventos filtrados)`}
          </p>
          <p className="text-xs text-muted-foreground">
            Clique para expandir e ver a timeline completa
          </p>
        </div>

        {/* Grouped Sinistros */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : groupedSinistros.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto opacity-30 mb-3" />
            {hasActiveFilters 
              ? "Nenhum sinistro encontrado com os filtros selecionados"
              : "Nenhum histórico disponível ainda"
            }
          </div>
        ) : (
          <div className="space-y-3">
            {groupedSinistros.map((group) => (
              <SinistroGroupCard key={group.sinistroId} group={group} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
