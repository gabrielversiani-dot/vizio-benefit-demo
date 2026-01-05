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
  TrendingUp, 
  Filter, 
  Eye,
  Plus,
  Edit,
  Trash2,
  FileText,
  Download
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getCampanhaDoMes } from "@/config/campanhasMensais";
import { CampanhaBadge } from "@/components/PromocaoSaude/CampanhaBadge";
import { AcaoFormModal } from "@/components/PromocaoSaude/AcaoFormModal";
import { AcaoDetailModal } from "@/components/PromocaoSaude/AcaoDetailModal";
import { usePermissions } from "@/hooks/usePermissions";

const statusConfig: Record<string, { label: string; color: string }> = {
  planejada: { label: "Planejada", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  em_andamento: { label: "Em Andamento", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  concluida: { label: "Concluída", color: "bg-green-500/20 text-green-700 border-green-500/30" },
  cancelada: { label: "Cancelada", color: "bg-red-500/20 text-red-700 border-red-500/30" },
};

interface AcaoSaude {
  id: string;
  empresa_id: string;
  filial_id: string | null;
  titulo: string;
  descricao: string | null;
  campanha_mes: string | null;
  data_inicio: string;
  hora_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  local: string | null;
  publico_alvo: string | null;
  responsavel: string | null;
  status: string;
  visibilidade: string;
  faturamento_entidades?: { nome: string } | null;
}


const PromocaoSaude = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaSelecionada, isAdminVizio } = useEmpresa();
  const { user } = useAuth();
  const { canManagePromocaoSaude, canDownloadMateriais, isAdmin, isClient } = usePermissions();
  
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAcao, setSelectedAcao] = useState<AcaoSaude | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ["acoes_saude", empresaSelecionada, filtroStatus],
    queryFn: async () => {
      if (!empresaSelecionada) return [];
      
      let query = supabase
        .from("acoes_saude")
        .select("*, faturamento_entidades(nome)")
        .eq("empresa_id", empresaSelecionada)
        .order("data_inicio", { ascending: true });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus as "planejada" | "em_andamento" | "concluida" | "cancelada");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AcaoSaude[];
    },
    enabled: !!empresaSelecionada,
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
  const currentMonth = currentDate.getMonth() + 1;
  const campanha = getCampanhaDoMes(currentMonth);

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

  const handleDayClick = (day: Date) => {
    if (isAdmin) {
      setSelectedDate(day);
      setSelectedAcao(null);
      setFormModalOpen(true);
    }
  };

  const handleEditAcao = (acao: AcaoSaude) => {
    setSelectedAcao(acao);
    setSelectedDate(undefined);
    setFormModalOpen(true);
  };

  const handleViewAcao = (acao: AcaoSaude) => {
    setSelectedAcao(acao);
    setDetailModalOpen(true);
  };

  const handleDeleteAcao = async (acao: AcaoSaude) => {
    if (!confirm(`Excluir a ação "${acao.titulo}"?`)) return;
    
    try {
      const { error } = await supabase
        .from("acoes_saude")
        .delete()
        .eq("id", acao.id);
      
      if (error) throw error;
      
      toast({ title: "Ação excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["acoes_saude"] });
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Promoção de Saúde</h1>
            <p className="text-muted-foreground">
              Gerencie campanhas, ações e materiais de saúde
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setSelectedAcao(null); setSelectedDate(undefined); setFormModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Ação
            </Button>
          )}
        </div>

        {/* Campaign of the month */}
        {campanha && (
          <Card className="border-l-4" style={{ borderLeftColor: campanha.corPrimaria }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${campanha.corPrimaria}20` }}
                  >
                    <Heart className="h-5 w-5" style={{ color: campanha.corPrimaria }} />
                  </div>
                  <div>
                    <p className="font-medium">{campanha.nome}</p>
                    <p className="text-sm text-muted-foreground">{campanha.descricao}</p>
                  </div>
                </div>
                <CampanhaBadge mes={currentMonth} showSugestoes={isAdmin} />
              </div>
            </CardContent>
          </Card>
        )}

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
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
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
                          onClick={() => handleDayClick(day)}
                          className={`min-h-[80px] p-1 border rounded-md transition-colors ${
                            isToday ? "border-primary bg-primary/5" : "border-border"
                          } ${isAdmin ? "cursor-pointer hover:bg-muted/50" : ""}`}
                          style={campanha ? { borderTopColor: campanha.corPrimaria, borderTopWidth: 2 } : {}}
                        >
                          <div className={`text-sm ${isToday ? "font-bold text-primary" : ""}`}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-1 mt-1">
                            {dayAcoes.slice(0, 2).map((acao) => (
                              <div
                                key={acao.id}
                                onClick={(e) => { e.stopPropagation(); handleViewAcao(acao); }}
                                className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${statusConfig[acao.status]?.color || ""}`}
                                title={acao.titulo}
                              >
                                {acao.titulo}
                              </div>
                            ))}
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
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Ações */}
            <Card>
              <CardHeader>
                <CardTitle>Ações de Saúde</CardTitle>
                <CardDescription>
                  Lista de todas as campanhas e ações
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
                        <TableHead>Campanha</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Local</TableHead>
                        {isAdmin && <TableHead>Visibilidade</TableHead>}
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acoes.map((acao) => (
                        <TableRow key={acao.id}>
                          <TableCell className="font-medium">{acao.titulo}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {acao.campanha_mes || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusConfig[acao.status]?.color || ""}
                            >
                              {statusConfig[acao.status]?.label || acao.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(parseISO(acao.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {acao.local || "-"}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Badge variant={acao.visibilidade === "cliente" ? "default" : "secondary"}>
                                {acao.visibilidade === "cliente" ? "Cliente" : "Interno"}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewAcao(acao)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => handleEditAcao(acao)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleDeleteAcao(acao)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materiais" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Materiais de Divulgação
                </CardTitle>
                <CardDescription>
                  Selecione uma ação na lista ou calendário para ver e gerenciar seus materiais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Clique em uma ação para visualizar os materiais disponíveis</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <AcaoFormModal
        open={formModalOpen}
        onClose={() => { setFormModalOpen(false); setSelectedAcao(null); setSelectedDate(undefined); }}
        acao={selectedAcao}
        defaultDate={selectedDate}
      />

      <AcaoDetailModal
        open={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedAcao(null); }}
        acao={selectedAcao}
        isAdmin={isAdmin}
      />
    </AppLayout>
  );
};

export default PromocaoSaude;
