import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, Search, Clock, X } from "lucide-react";
import { useDemandaHistoricoGeral, HistoricoEvent } from "@/hooks/useDemandaHistorico";
import { DemandaTimeline } from "./DemandaTimeline";

const eventTypeOptions = [
  { value: "todos", label: "Todos os Eventos" },
  { value: "created", label: "Criação" },
  { value: "status_changed", label: "Mudança de Status" },
  { value: "completed", label: "Concluídos" },
  { value: "rd_sync", label: "Sincronização RD" },
  { value: "comment_added", label: "Comentários" },
];

interface HistoricoGeralTimelineProps {
  empresaId: string | undefined;
}

export function HistoricoGeralTimeline({ empresaId }: HistoricoGeralTimelineProps) {
  const [filtroTipoEvento, setFiltroTipoEvento] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  
  const { data: historico = [], isLoading } = useDemandaHistoricoGeral(empresaId, 200);

  // Filter events
  const filteredEvents = historico.filter((event) => {
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

  // Count completed events with SLA
  const completedCount = historico.filter(e => e.tipo_evento === 'completed').length;

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
              Timeline de todas as alterações e atividades nas demandas
            </CardDescription>
          </div>
          
          {completedCount > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 self-start">
              <Clock className="h-3 w-3 mr-1" />
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
        {hasActiveFilters && (
          <p className="text-sm text-muted-foreground">
            Mostrando {filteredEvents.length} de {historico.length} eventos
          </p>
        )}

        {/* Timeline */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {hasActiveFilters 
              ? "Nenhum evento encontrado com os filtros selecionados"
              : "Nenhum histórico disponível"
            }
          </div>
        ) : (
          <DemandaTimeline 
            events={filteredEvents} 
            showDemandaTitle={true}
            groupByDay={true}
          />
        )}
      </CardContent>
    </Card>
  );
}
