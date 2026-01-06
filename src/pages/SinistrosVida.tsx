import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Search,
  FileText,
  Calendar,
  AlertTriangle,
  DollarSign,
  Filter,
  RefreshCw,
  Link2Off,
  Settings2
} from "lucide-react";
import { useState } from "react";
import { SinistroDetailModal } from "@/components/SinistrosVida/SinistroDetailModal";
import { SinistroFormModal } from "@/components/SinistrosVida/SinistroFormModal";
import { HistoricoGeralSinistrosTimeline } from "@/components/SinistrosVida/HistoricoGeralSinistrosTimeline";
import { SinistroStatusEditor } from "@/components/SinistrosVida/SinistroStatusEditor";
import { SinistroPrioridadeEditor } from "@/components/SinistrosVida/SinistroPrioridadeEditor";
import { RDSinistroPipelineConfigModal } from "@/components/SinistrosVida/RDSinistroPipelineConfigModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<string, { label: string; color: string }> = {
  aprovado: { label: "Aprovado", color: "bg-success text-success-foreground" },
  pago: { label: "Pago", color: "bg-chart-2 text-white" },
  em_analise: { label: "Em Análise", color: "bg-warning text-warning-foreground" },
  pendente_documentos: { label: "Pendente Docs", color: "bg-chart-3 text-white" },
  em_andamento: { label: "Em Andamento", color: "bg-chart-1 text-white" },
  enviado_operadora: { label: "Enviado Operadora", color: "bg-chart-4 text-white" },
  negado: { label: "Negado", color: "bg-destructive text-destructive-foreground" },
  concluido: { label: "Concluído", color: "bg-success text-success-foreground" },
};

const tipoSinistroConfig: Record<string, { label: string; color: string }> = {
  morte_natural: { label: "Morte Natural", color: "#ef4444" },
  morte_acidental: { label: "Morte Acidental", color: "#f97316" },
  invalidez: { label: "Invalidez", color: "#eab308" },
  doenca_grave: { label: "Doença Grave", color: "#8b5cf6" },
  outro: { label: "Outro", color: "#94a3b8" },
};

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-slate-500/20 text-slate-700" },
  media: { label: "Média", color: "bg-blue-500/20 text-blue-700" },
  alta: { label: "Alta", color: "bg-orange-500/20 text-orange-700" },
  critica: { label: "Crítica", color: "bg-red-500/20 text-red-700" },
};

const sourceConfig: Record<string, { label: string; color: string }> = {
  vizio: { label: "Vizio", color: "bg-purple-100 text-purple-700" },
  empresa: { label: "Empresa", color: "bg-blue-100 text-blue-700" },
};

export default function SinistrosVida() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSinistro, setSelectedSinistro] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPipelineConfigOpen, setIsPipelineConfigOpen] = useState(false);
  const { empresaSelecionada, empresas, isAdminVizio } = useEmpresa();
  const { canCreateSinistrosVida, canManageSinistrosVida, isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  
  const empresaAtual = empresas.find(e => e.id === empresaSelecionada);

  // Fetch sinistros from database
  const { data: sinistros = [], isLoading, refetch } = useQuery({
    queryKey: ['sinistros-vida', empresaSelecionada, filtroStatus, filtroTipo],
    queryFn: async () => {
      let query = supabase
        .from('sinistros_vida')
        .select(`
          *,
          empresas:empresa_id (nome)
        `)
        .order('created_at', { ascending: false });

      if (empresaSelecionada) {
        query = query.eq('empresa_id', empresaSelecionada);
      }

      if (filtroStatus !== "todos") {
        query = query.eq('status', filtroStatus);
      }

      if (filtroTipo !== "todos") {
        query = query.eq('tipo_sinistro', filtroTipo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Sync mutation (push pending sinistros to RD)
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!empresaSelecionada) throw new Error("Nenhuma empresa selecionada");
      
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Sessão expirada");
      }

      // Get pending sinistros without RD deal
      const { data: pendingSinistros } = await supabase
        .from('sinistros_vida')
        .select('id')
        .eq('empresa_id', empresaSelecionada)
        .is('rd_deal_id', null)
        .limit(10);

      if (!pendingSinistros || pendingSinistros.length === 0) {
        return { synced: 0 };
      }

      let synced = 0;
      for (const sinistro of pendingSinistros) {
        try {
          const response = await supabase.functions.invoke('rd-sync-sinistro-vida', {
            body: { sinistroId: sinistro.id, action: 'push' },
          });
          
          if (response.data?.success) synced++;
        } catch (e) {
          console.error('Sync error for', sinistro.id, e);
        }
      }

      return { synced };
    },
    onSuccess: (data) => {
      if (data.synced > 0) {
        toast.success(`${data.synced} sinistro(s) sincronizado(s) com RD Station`);
      } else {
        toast.info("Nenhum sinistro pendente de sincronização");
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['sinistros-vida-historico-geral'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao sincronizar");
    },
  });

  // Pull mutation (import sinistros from RD)
  const pullMutation = useMutation({
    mutationFn: async () => {
      if (!empresaSelecionada) throw new Error("Nenhuma empresa selecionada");
      
      const response = await supabase.functions.invoke('rd-sync-sinistro-vida', {
        body: { empresaId: empresaSelecionada, action: 'pull' },
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Erro ao importar do RD');
      }
      
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erro ao importar do RD');
      }
      
      return response.data;
    },
    onSuccess: (data) => {
      const msg = `Importação concluída: ${data.created || 0} novos, ${data.updated || 0} atualizados`;
      if (data.errors > 0) {
        toast.warning(`${msg} (${data.errors} erro(s))`);
      } else {
        toast.success(msg);
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['sinistros-vida-historico-geral'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao importar do RD Station");
    },
  });

  // Calculate KPIs
  const totalSinistros = sinistros.length;
  const valorTotal = sinistros.reduce((acc, s) => acc + (s.valor_indenizacao || 0), 0);
  const aprovados = sinistros.filter(s => ['aprovado', 'pago', 'concluido'].includes(s.status)).length;
  const taxaAprovacao = totalSinistros > 0 ? (aprovados / totalSinistros) * 100 : 0;
  const emAnalise = sinistros.filter(s => s.status === "em_analise").length;
  
  // RD Stats
  const rdLinked = sinistros.filter(s => s.rd_deal_id).length;
  const rdPending = sinistros.filter(s => !s.rd_deal_id).length;

  const filteredSinistros = sinistros.filter(
    (sinistro) =>
      sinistro.beneficiario_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sinistro.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sinistro.empresas?.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid gap-6 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sinistros de Vida em Grupo</h1>
            <p className="text-muted-foreground">
              Gestão completa de sinistros de seguro de vida em grupo
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* RD Station Status */}
            {isAdmin && rdLinked > 0 && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <div className="w-2 h-2 rounded-full bg-purple-500 mr-2" />
                {rdLinked} no RD Station
              </Badge>
            )}
            
            {isAdmin && rdPending > 0 && (
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                <Link2Off className="h-3 w-3 mr-2" />
                {rdPending} pendente(s)
              </Badge>
            )}
            
            {isAdminVizio && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsPipelineConfigOpen(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Configurar Pipeline
              </Button>
            )}
            
            {isAdminVizio && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => pullMutation.mutate()}
                disabled={pullMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${pullMutation.isPending ? 'animate-spin' : ''}`} />
                {pullMutation.isPending ? 'Importando...' : 'Importar do RD'}
              </Button>
            )}
            
            {isAdminVizio && rdPending > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Sincronizando...' : `Enviar ${rdPending} ao RD`}
              </Button>
            )}
            
            {canCreateSinistrosVida && (
              <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Novo Sinistro
              </Button>
            )}
          </div>
        </div>

        {/* Form Modal */}
        <SinistroFormModal open={isFormOpen} onOpenChange={setIsFormOpen} />
        
        {/* Pipeline Config Modal */}
        {empresaSelecionada && empresaAtual && (
          <RDSinistroPipelineConfigModal
            open={isPipelineConfigOpen}
            onOpenChange={setIsPipelineConfigOpen}
            empresaId={empresaSelecionada}
            empresaNome={empresaAtual.nome}
            onUpdate={() => refetch()}
          />
        )}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Sinistros</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSinistros}</div>
              <p className="text-xs text-muted-foreground">{emAnalise} em análise</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">Em indenizações</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{taxaAprovacao.toFixed(0)}%</div>
              <p className="text-xs text-muted-foreground">{aprovados} aprovados/pagos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{emAnalise}</div>
              <p className="text-xs text-muted-foreground">Aguardando análise</p>
            </CardContent>
          </Card>
        </div>

        {/* Alert for pending */}
        {emAnalise > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium">Sinistros Pendentes de Análise</p>
                  <p className="text-sm text-muted-foreground">
                    Existem {emAnalise} sinistro(s) aguardando análise e decisão.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="lista" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lista">Lista de Sinistros</TabsTrigger>
            <TabsTrigger value="historico">Histórico / Prestação de Contas</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            {/* Filters */}
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
                        {Object.entries(tipoSinistroConfig).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[200px] max-w-sm relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por beneficiário, ID ou empresa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Listagem de Sinistros</CardTitle>
                <CardDescription>
                  Lista de todos os sinistros registrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSinistros.length === 0 ? (
                  <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                    <Shield className="h-12 w-12 opacity-30 mb-3" />
                    {searchTerm || filtroStatus !== "todos" || filtroTipo !== "todos" 
                      ? "Nenhum resultado encontrado" 
                      : "Nenhum sinistro cadastrado"}
                    {canCreateSinistrosVida && !searchTerm && filtroStatus === "todos" && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4"
                        onClick={() => setIsFormOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Registrar primeiro sinistro
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Beneficiário</TableHead>
                        {isAdminVizio && <TableHead>Empresa</TableHead>}
                        <TableHead>Tipo</TableHead>
                        <TableHead>Data Ocorrência</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSinistros.map((sinistro) => {
                        const tipoConf = tipoSinistroConfig[sinistro.tipo_sinistro] || { label: sinistro.tipo_sinistro, color: "#94a3b8" };
                        const origemConf = sourceConfig[sinistro.aberto_por_role] || sourceConfig.vizio;
                        
                        return (
                          <TableRow key={sinistro.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{sinistro.beneficiario_nome}</p>
                                {sinistro.beneficiario_cpf && (
                                  <p className="text-sm text-muted-foreground">{sinistro.beneficiario_cpf}</p>
                                )}
                              </div>
                            </TableCell>
                            {isAdminVizio && (
                              <TableCell>{sinistro.empresas?.nome || '-'}</TableCell>
                            )}
                            <TableCell>
                              <Badge variant="outline" style={{ borderColor: tipoConf.color, color: tipoConf.color }}>
                                {tipoConf.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {new Date(sinistro.data_ocorrencia).toLocaleDateString('pt-BR')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <SinistroPrioridadeEditor
                                sinistroId={sinistro.id}
                                prioridade={sinistro.prioridade || 'media'}
                                empresaId={sinistro.empresa_id}
                              />
                            </TableCell>
                            <TableCell>
                              <SinistroStatusEditor
                                sinistroId={sinistro.id}
                                status={sinistro.status}
                                empresaId={sinistro.empresa_id}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge className={origemConf.color}>
                                {origemConf.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="gap-2"
                                onClick={() => {
                                  setSelectedSinistro(sinistro);
                                  setIsDetailOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4" />
                                Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <HistoricoGeralSinistrosTimeline empresaId={empresaSelecionada} />
          </TabsContent>
        </Tabs>

        {/* Detail Modal */}
        <SinistroDetailModal
          sinistro={selectedSinistro}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          canEdit={canManageSinistrosVida}
        />
      </div>
    </AppLayout>
  );
}
