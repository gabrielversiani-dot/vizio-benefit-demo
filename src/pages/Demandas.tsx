import { useState } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Clock, CheckCircle2, AlertCircle, Filter, Eye, RefreshCw, Settings2, Link2Off, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { RDStationConfigModal } from "@/components/Demandas/RDStationConfigModal";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  aguardando_documentacao: { label: "Aguardando Doc.", color: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
  concluido: { label: "Concluído", color: "bg-green-500/20 text-green-700 border-green-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-700 border-red-500/30" },
};

const tipoConfig: Record<string, string> = {
  certificado: "Certificado",
  carteirinha: "Carteirinha",
  alteracao_cadastral: "Alteração Cadastral",
  reembolso: "Reembolso",
  autorizacao: "Autorização",
  agendamento: "Agendamento",
  outro: "Outro",
};

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-slate-500/20 text-slate-700" },
  media: { label: "Média", color: "bg-blue-500/20 text-blue-700" },
  alta: { label: "Alta", color: "bg-orange-500/20 text-orange-700" },
  urgente: { label: "Urgente", color: "bg-red-500/20 text-red-700" },
};

const sourceConfig: Record<string, { label: string; color: string }> = {
  manual: { label: "Manual", color: "bg-slate-100 text-slate-700" },
  rd_station: { label: "RD Station", color: "bg-purple-100 text-purple-700" },
};

interface Demanda {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  prioridade: string;
  prazo: string | null;
  created_at: string;
  source: string;
  rd_deal_name?: string | null;
  responsavel_nome?: string | null;
}

interface HistoricoItem {
  id: string;
  demanda_id: string;
  tipo_evento: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  descricao: string | null;
  usuario_nome: string | null;
  created_at: string;
  demandas?: { titulo: string } | null;
}

interface EmpresaConfig {
  id: string;
  nome: string;
  rd_station_enabled: boolean | null;
  rd_station_organization_id: string | null;
  rd_station_org_name_snapshot: string | null;
  rd_station_last_sync: string | null;
}

const Demandas = () => {
  const { empresaSelecionada, empresas, isAdminVizio } = useEmpresa();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroSource, setFiltroSource] = useState<string>("todos");
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // empresaSelecionada is the ID (string), empresaAtual is the object
  const empresaId = empresaSelecionada;
  const empresaAtual = empresas.find(e => e.id === empresaSelecionada);

  // Fetch empresa details with RD config
  const { data: empresaConfig, refetch: refetchEmpresaConfig } = useQuery({
    queryKey: ["empresa-rd-config", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, rd_station_enabled, rd_station_organization_id, rd_station_org_name_snapshot, rd_station_last_sync")
        .eq("id", empresaId)
        .single();
      if (error) throw error;
      return data as EmpresaConfig;
    },
    enabled: !!empresaId,
  });

  // Fetch demandas
  const { data: demandas = [], isLoading, refetch: refetchDemandas } = useQuery({
    queryKey: ["demandas", empresaId, filtroStatus, filtroTipo, filtroSource],
    queryFn: async () => {
      if (!empresaId) return [];
      
      // Start building the query
      const baseQuery = supabase
        .from("demandas")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      // Apply filters using raw SQL filter to avoid TS enum issues
      let filteredQuery = baseQuery;
      
      if (filtroStatus !== "todos") {
        filteredQuery = filteredQuery.filter("status", "eq", filtroStatus);
      }
      if (filtroTipo !== "todos") {
        filteredQuery = filteredQuery.filter("tipo", "eq", filtroTipo);
      }
      if (filtroSource !== "todos") {
        filteredQuery = filteredQuery.filter("source", "eq", filtroSource);
      }

      const { data, error } = await filteredQuery;
      if (error) throw error;
      return data as Demanda[];
    },
    enabled: !!empresaId,
  });

  // Fetch historico
  const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
    queryKey: ["demandas-historico", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      const { data, error } = await supabase
        .from("demandas_historico")
        .select("*, demandas(titulo)")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as HistoricoItem[];
    },
    enabled: !!empresaId,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Nenhuma empresa selecionada");

      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('rdstation-sync-demandas', {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: {
          empresaId,
          forceSync: false,
        },
      });

      if (error) throw error;
      
      if (!data.success) {
        if (data.needsSetup) {
          throw new Error("NEEDS_SETUP");
        }
        if (data.needsMapping) {
          throw new Error("NEEDS_MAPPING");
        }
        throw new Error(data.error || "Erro desconhecido");
      }
      
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sincronização concluída: ${data.imported} novos, ${data.updated} atualizados`);
      refetchDemandas();
      refetchEmpresaConfig();
      queryClient.invalidateQueries({ queryKey: ["demandas-historico"] });
    },
    onError: (error: Error) => {
      if (error.message === "NEEDS_SETUP") {
        toast.error("Integração RD Station não habilitada para esta empresa");
      } else if (error.message === "NEEDS_MAPPING") {
        toast.error("Empresa não vinculada a uma organização do RD Station");
      } else {
        toast.error(error.message || "Erro ao sincronizar com RD Station");
      }
    },
  });

  const contadores = {
    total: demandas.length,
    pendentes: demandas.filter((d) => d.status === "pendente").length,
    emAndamento: demandas.filter((d) => d.status === "em_andamento").length,
    concluidos: demandas.filter((d) => d.status === "concluido").length,
  };

  const rdEnabled = empresaConfig?.rd_station_enabled && empresaConfig?.rd_station_organization_id;
  const lastSync = empresaConfig?.rd_station_last_sync 
    ? formatDistanceToNow(new Date(empresaConfig.rd_station_last_sync), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Acompanhamento de Demandas</h1>
            <p className="text-muted-foreground">
              Visualize e acompanhe suas solicitações
              {empresaAtual && ` - ${empresaAtual.nome}`}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* RD Station Status & Sync */}
            {rdEnabled ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2" />
                  RD Station Conectado
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
                {lastSync && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Última sync: {lastSync}
                  </span>
                )}
              </div>
            ) : (
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                <Link2Off className="h-3 w-3 mr-2" />
                RD Station não vinculado
              </Badge>
            )}
            
            {/* Config button - only for admin */}
            {isAdminVizio && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setConfigModalOpen(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Configurar RD
              </Button>
            )}
          </div>
        </div>

        {/* Warning for non-admin users when RD not configured */}
        {!rdEnabled && !isAdminVizio && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Integração não configurada</p>
              <p className="text-sm text-amber-700">
                A sincronização com RD Station não está ativa para sua empresa. 
                Solicite à corretora para configurar a integração.
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Demandas</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contadores.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{contadores.pendentes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <AlertCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{contadores.emAndamento}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{contadores.concluidos}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="lista" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lista">Lista de Demandas</TabsTrigger>
            <TabsTrigger value="historico">Histórico / Prestação de Contas</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="w-48">
                    <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Status</SelectItem>
                        {Object.entries(statusConfig).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-48">
                    <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Tipos</SelectItem>
                        {Object.entries(tipoConfig).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-48">
                    <Select value={filtroSource} onValueChange={setFiltroSource}>
                      <SelectTrigger>
                        <SelectValue placeholder="Origem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas as Origens</SelectItem>
                        {Object.entries(sourceConfig).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Demandas */}
            <Card>
              <CardHeader>
                <CardTitle>Suas Demandas</CardTitle>
                <CardDescription>
                  Lista de todas as solicitações registradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : demandas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {!rdEnabled && isAdminVizio ? (
                      <div className="space-y-3">
                        <p>Nenhuma demanda encontrada</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setConfigModalOpen(true)}
                        >
                          <Settings2 className="h-4 w-4 mr-2" />
                          Vincular RD Station
                        </Button>
                      </div>
                    ) : rdEnabled ? (
                      <div className="space-y-3">
                        <p>Nenhuma demanda encontrada</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => syncMutation.mutate()}
                          disabled={syncMutation.isPending}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                          Sincronizar agora
                        </Button>
                      </div>
                    ) : (
                      <p>Nenhuma demanda encontrada</p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Prazo</TableHead>
                          <TableHead>Data Criação</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {demandas.map((demanda) => (
                          <TableRow key={demanda.id}>
                            <TableCell className="font-medium">
                              <div>
                                {demanda.titulo}
                                {demanda.rd_deal_name && (
                                  <p className="text-xs text-muted-foreground">
                                    Negociação: {demanda.rd_deal_name}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{tipoConfig[demanda.tipo] || demanda.tipo}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={statusConfig[demanda.status]?.color || ""}
                              >
                                {statusConfig[demanda.status]?.label || demanda.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={prioridadeConfig[demanda.prioridade]?.color || ""}
                              >
                                {prioridadeConfig[demanda.prioridade]?.label || demanda.prioridade}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={sourceConfig[demanda.source]?.color || "bg-slate-100"}
                              >
                                {sourceConfig[demanda.source]?.label || demanda.source}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {demanda.responsavel_nome || "-"}
                            </TableCell>
                            <TableCell>
                              {demanda.prazo
                                ? format(new Date(demanda.prazo), "dd/MM/yyyy", { locale: ptBR })
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(demanda.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico / Prestação de Contas</CardTitle>
                <CardDescription>
                  Timeline de todas as alterações e atividades nas demandas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistorico ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : historico.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum histórico disponível
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historico.map((item) => (
                      <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            {item.tipo_evento === 'sync' ? (
                              <RefreshCw className="h-4 w-4 text-purple-500" />
                            ) : item.tipo_evento === 'status_change' ? (
                              <AlertCircle className="h-4 w-4 text-blue-500" />
                            ) : (
                              <ClipboardList className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                              {item.demandas?.titulo || 'Demanda removida'}
                            </span>
                            {item.tipo_evento === 'sync' && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                                Sincronização
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.descricao || 'Atualização registrada'}
                          </p>
                          {item.status_anterior && item.status_novo && (
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {statusConfig[item.status_anterior]?.label || item.status_anterior}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge variant="outline" className="text-xs">
                                {statusConfig[item.status_novo]?.label || item.status_novo}
                              </Badge>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{item.usuario_nome || 'Sistema'}</span>
                            <span>•</span>
                            <span>
                              {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* RD Station Config Modal */}
      {empresaConfig && (
        <RDStationConfigModal
          open={configModalOpen}
          onOpenChange={setConfigModalOpen}
          empresa={empresaConfig}
          onUpdate={() => {
            refetchEmpresaConfig();
            refetchDemandas();
          }}
        />
      )}
    </AppLayout>
  );
};

export default Demandas;
