import { useState } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Heart, 
  Calendar as CalendarIcon, 
  Activity, 
  Users, 
  TrendingUp, 
  Filter, 
  Eye,
  Syringe,
  Brain,
  Apple,
  Dumbbell,
  Shield,
  MoreHorizontal
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig = {
  planejada: { label: "Planejada", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  em_andamento: { label: "Em Andamento", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  concluida: { label: "Concluída", color: "bg-green-500/20 text-green-700 border-green-500/30" },
  cancelada: { label: "Cancelada", color: "bg-red-500/20 text-red-700 border-red-500/30" },
};

const tipoConfig = {
  campanha: "Campanha",
  programa: "Programa",
  evento: "Evento",
  treinamento: "Treinamento",
};

const categoriaConfig = {
  vacinacao: { label: "Vacinação", icon: Syringe, color: "text-purple-600" },
  checkup: { label: "Check-up", icon: Activity, color: "text-blue-600" },
  bem_estar: { label: "Bem-estar", icon: Heart, color: "text-pink-600" },
  nutricional: { label: "Nutricional", icon: Apple, color: "text-green-600" },
  atividade_fisica: { label: "Atividade Física", icon: Dumbbell, color: "text-orange-600" },
  saude_mental: { label: "Saúde Mental", icon: Brain, color: "text-indigo-600" },
  prevencao: { label: "Prevenção", icon: Shield, color: "text-teal-600" },
  outro: { label: "Outro", icon: MoreHorizontal, color: "text-gray-600" },
};

type StatusAcao = keyof typeof statusConfig;
type TipoAcao = keyof typeof tipoConfig;
type CategoriaAcao = keyof typeof categoriaConfig;

interface AcaoSaude {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoAcao;
  categoria: CategoriaAcao;
  status: StatusAcao;
  data_inicio: string;
  data_fim: string | null;
  local: string | null;
  capacidade_maxima: number | null;
  created_at: string;
  empresas?: { nome: string } | null;
}

const PromocaoSaude = () => {
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ["acoes_saude", filtroStatus, filtroCategoria],
    queryFn: async () => {
      let query = supabase
        .from("acoes_saude")
        .select("*, empresas(nome)")
        .order("data_inicio", { ascending: true });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus as StatusAcao);
      }
      if (filtroCategoria !== "todos") {
        query = query.eq("categoria", filtroCategoria as CategoriaAcao);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AcaoSaude[];
    },
  });

  const contadores = {
    total: acoes.length,
    planejadas: acoes.filter((a) => a.status === "planejada").length,
    emAndamento: acoes.filter((a) => a.status === "em_andamento").length,
    concluidas: acoes.filter((a) => a.status === "concluida").length,
  };

  // Calendar logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getAcoesForDay = (day: Date) => {
    return acoes.filter((acao) => {
      const inicio = parseISO(acao.data_inicio);
      const fim = acao.data_fim ? parseISO(acao.data_fim) : inicio;
      return day >= inicio && day <= fim;
    });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Promoção de Saúde</h1>
          <p className="text-muted-foreground">
            Acompanhe campanhas, programas e ações de saúde
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Ações</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contadores.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planejadas</CardTitle>
              <CalendarIcon className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{contadores.planejadas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <Activity className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{contadores.emAndamento}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{contadores.concluidas}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="calendario" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendario">Calendário</TabsTrigger>
            <TabsTrigger value="lista">Lista de Ações</TabsTrigger>
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          </TabsList>

          <TabsContent value="calendario" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Calendário de Ações</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={prevMonth}>
                      ←
                    </Button>
                    <span className="font-medium min-w-[150px] text-center">
                      {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <Button variant="outline" size="sm" onClick={nextMonth}>
                      →
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                      <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} className="p-2" />
                    ))}
                    {daysInMonth.map((day) => {
                      const dayAcoes = getAcoesForDay(day);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div
                          key={day.toISOString()}
                          className={`min-h-[80px] p-1 border rounded-md ${
                            isToday ? "border-primary bg-primary/5" : "border-border"
                          }`}
                        >
                          <div className={`text-sm ${isToday ? "font-bold text-primary" : ""}`}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-1 mt-1">
                            {dayAcoes.slice(0, 2).map((acao) => {
                              const CategoriaIcon = categoriaConfig[acao.categoria].icon;
                              return (
                                <div
                                  key={acao.id}
                                  className={`text-xs p-1 rounded truncate flex items-center gap-1 ${statusConfig[acao.status].color}`}
                                  title={acao.titulo}
                                >
                                  <CategoriaIcon className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{acao.titulo}</span>
                                </div>
                              );
                            })}
                            {dayAcoes.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayAcoes.length - 2} mais
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
                    <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                      <SelectTrigger>
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas as Categorias</SelectItem>
                        {Object.entries(categoriaConfig).map(([key, { label }]) => (
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

            {/* Tabela de Ações */}
            <Card>
              <CardHeader>
                <CardTitle>Ações de Saúde</CardTitle>
                <CardDescription>
                  Lista de todas as campanhas, programas e eventos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : acoes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma ação de saúde encontrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Início</TableHead>
                        <TableHead>Data Fim</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acoes.map((acao) => {
                        const CategoriaIcon = categoriaConfig[acao.categoria].icon;
                        return (
                          <TableRow key={acao.id}>
                            <TableCell className="font-medium">{acao.titulo}</TableCell>
                            <TableCell>{tipoConfig[acao.tipo]}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CategoriaIcon className={`h-4 w-4 ${categoriaConfig[acao.categoria].color}`} />
                                {categoriaConfig[acao.categoria].label}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={statusConfig[acao.status].color}
                              >
                                {statusConfig[acao.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(acao.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              {acao.data_fim
                                ? format(new Date(acao.data_fim), "dd/MM/yyyy", { locale: ptBR })
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
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

          <TabsContent value="indicadores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Indicadores de Saúde</CardTitle>
                <CardDescription>
                  Métricas de adesão e participação nas ações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum indicador disponível
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default PromocaoSaude;