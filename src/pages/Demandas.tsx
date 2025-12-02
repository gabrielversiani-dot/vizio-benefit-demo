import { useState } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Clock, CheckCircle2, AlertCircle, Filter, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  aguardando_documentacao: { label: "Aguardando Doc.", color: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
  concluido: { label: "Concluído", color: "bg-green-500/20 text-green-700 border-green-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-700 border-red-500/30" },
};

const tipoConfig = {
  certificado: "Certificado",
  carteirinha: "Carteirinha",
  alteracao_cadastral: "Alteração Cadastral",
  reembolso: "Reembolso",
  autorizacao: "Autorização",
  agendamento: "Agendamento",
  outro: "Outro",
};

const prioridadeConfig = {
  baixa: { label: "Baixa", color: "bg-slate-500/20 text-slate-700" },
  media: { label: "Média", color: "bg-blue-500/20 text-blue-700" },
  alta: { label: "Alta", color: "bg-orange-500/20 text-orange-700" },
  urgente: { label: "Urgente", color: "bg-red-500/20 text-red-700" },
};

type StatusDemanda = keyof typeof statusConfig;
type TipoDemanda = keyof typeof tipoConfig;
type PrioridadeDemanda = keyof typeof prioridadeConfig;

interface Demanda {
  id: string;
  titulo: string;
  tipo: TipoDemanda;
  status: StatusDemanda;
  prioridade: PrioridadeDemanda;
  prazo: string | null;
  created_at: string;
  empresas?: { nome: string } | null;
}

const Demandas = () => {
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ["demandas", filtroStatus, filtroTipo],
    queryFn: async () => {
      let query = supabase
        .from("demandas")
        .select("*, empresas(nome)")
        .order("created_at", { ascending: false });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus as StatusDemanda);
      }
      if (filtroTipo !== "todos") {
        query = query.eq("tipo", filtroTipo as TipoDemanda);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Demanda[];
    },
  });

  const contadores = {
    total: demandas.length,
    pendentes: demandas.filter((d) => d.status === "pendente").length,
    emAndamento: demandas.filter((d) => d.status === "em_andamento").length,
    concluidos: demandas.filter((d) => d.status === "concluido").length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Acompanhamento de Demandas</h1>
          <p className="text-muted-foreground">
            Visualize e acompanhe suas solicitações
          </p>
        </div>

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
            <TabsTrigger value="historico">Histórico</TabsTrigger>
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
                    Nenhuma demanda encontrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead>Data Criação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demandas.map((demanda) => (
                        <TableRow key={demanda.id}>
                          <TableCell className="font-medium">{demanda.titulo}</TableCell>
                          <TableCell>{tipoConfig[demanda.tipo]}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusConfig[demanda.status].color}
                            >
                              {statusConfig[demanda.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={prioridadeConfig[demanda.prioridade].color}
                            >
                              {prioridadeConfig[demanda.prioridade].label}
                            </Badge>
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Atualizações</CardTitle>
                <CardDescription>
                  Timeline de todas as alterações nas demandas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum histórico disponível
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Demandas;