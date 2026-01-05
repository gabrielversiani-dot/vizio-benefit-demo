import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Calendar, CheckCircle, Clock, AlertCircle, Building2, Plus, Eye, Pencil, Trash2, FileText, Heart, Shield, Smile } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { FaturaFormModal } from "@/components/Faturamento/FaturaFormModal";
import { FaturaDetailModal } from "@/components/Faturamento/FaturaDetailModal";
import { DeleteFaturaModal } from "@/components/Faturamento/DeleteFaturaModal";

type FaturamentoRow = {
  id: string;
  empresa_id: string;
  filial_id: string | null;
  produto: "saude" | "vida" | "odonto";
  competencia: string;
  vencimento: string;
  valor_total: number;
  status: "aguardando_pagamento" | "pago" | "atraso" | "cancelado";
  pago_em: string | null;
  observacao: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
  empresas?: { nome: string } | null;
  filial?: { nome: string } | null;
};

type Empresa = {
  id: string;
  nome: string;
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pago: { label: "Pago", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  aguardando_pagamento: { label: "Aguardando", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  atraso: { label: "Em Atraso", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", icon: AlertCircle },
};

const produtoConfig: Record<string, { label: string; color: string; icon: typeof Heart }> = {
  saude: { label: "Saúde", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: Heart },
  vida: { label: "Vida", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: Shield },
  odonto: { label: "Odonto", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300", icon: Smile },
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function Faturamento() {
  const { empresaSelecionada, isAdminVizio } = useEmpresa();
  const queryClient = useQueryClient();
  
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas");
  const [periodoFilter, setPeriodoFilter] = useState<string>("12");
  const [produtoFilter, setProdutoFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFatura, setSelectedFatura] = useState<FaturamentoRow | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");

  // Fetch user role for permission check
  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      return data?.role;
    },
  });

  const canManage = userRole === "admin_vizio" || userRole === "admin_empresa";

  // Fetch empresas (only for admin_vizio)
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
    enabled: isAdminVizio,
  });

  // Fetch faturamentos with empresa and filial name
  const { data: faturamentos = [], isLoading } = useQuery({
    queryKey: ["faturamentos", empresaSelecionada, periodoFilter],
    queryFn: async () => {
      const mesesAtras = new Date();
      mesesAtras.setMonth(mesesAtras.getMonth() - parseInt(periodoFilter));
      
      let query = supabase
        .from("faturamentos")
        .select("*, empresas(nome), filial:faturamento_entidades(nome)")
        .gte("competencia", mesesAtras.toISOString().split('T')[0])
        .order("competencia", { ascending: false })
        .order("vencimento", { ascending: false });
      
      if (empresaSelecionada) {
        query = query.eq("empresa_id", empresaSelecionada);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as FaturamentoRow[];
    },
  });

  // Auto-update status for overdue invoices
  const updateOverdueMutation = useMutation({
    mutationFn: async (overdueIds: string[]) => {
      const { error } = await supabase
        .from("faturamentos")
        .update({ status: "atraso" })
        .in("id", overdueIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamentos"] });
    },
  });

  // Check and update overdue invoices
  useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const overdueInvoices = faturamentos.filter(
      f => f.status === "aguardando_pagamento" && f.vencimento < today
    );
    if (overdueInvoices.length > 0) {
      updateOverdueMutation.mutate(overdueInvoices.map(f => f.id));
    }
  }, [faturamentos]);

  // Filter data
  const filteredData = useMemo(() => {
    let data = faturamentos;
    if (empresaFilter !== "todas" && isAdminVizio) {
      data = data.filter(f => f.empresa_id === empresaFilter);
    }
    if (produtoFilter !== "todos") {
      data = data.filter(f => f.produto === produtoFilter);
    }
    if (statusFilter !== "todos") {
      data = data.filter(f => f.status === statusFilter);
    }
    return data;
  }, [faturamentos, empresaFilter, produtoFilter, statusFilter, isAdminVizio]);

  // KPIs
  const kpis = useMemo(() => {
    const totalPeriodo = filteredData.reduce((acc, f) => acc + Number(f.valor_total), 0);
    const totalAberto = filteredData
      .filter(f => f.status === "aguardando_pagamento")
      .reduce((acc, f) => acc + Number(f.valor_total), 0);
    const totalAtraso = filteredData
      .filter(f => f.status === "atraso")
      .reduce((acc, f) => acc + Number(f.valor_total), 0);
    const totalPago = filteredData
      .filter(f => f.status === "pago")
      .reduce((acc, f) => acc + Number(f.valor_total), 0);

    return { totalPeriodo, totalAberto, totalAtraso, totalPago };
  }, [filteredData]);

  // Handlers
  const handleNewFatura = () => {
    setSelectedFatura(null);
    setFormMode("create");
    setIsFormOpen(true);
  };

  const handleEditFatura = (fatura: FaturamentoRow) => {
    setSelectedFatura(fatura);
    setFormMode("edit");
    setIsFormOpen(true);
  };

  const handleViewFatura = (fatura: FaturamentoRow) => {
    setSelectedFatura(fatura);
    setIsDetailOpen(true);
  };

  const handleDeleteFatura = (fatura: FaturamentoRow) => {
    setSelectedFatura(fatura);
    setIsDeleteOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedFatura(null);
    queryClient.invalidateQueries({ queryKey: ["faturamentos"] });
  };

  const handleDeleteSuccess = () => {
    setIsDeleteOpen(false);
    setSelectedFatura(null);
    queryClient.invalidateQueries({ queryKey: ["faturamentos"] });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </AppLayout>
    );
  }

  // Empty state
  if (faturamentos.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Faturamento</h1>
            <p className="mt-2 text-muted-foreground">
              Gestão de faturas por produto
            </p>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma fatura cadastrada</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                Cadastre faturas para acompanhar pagamentos e vencimentos por produto.
              </p>
              {canManage && (
                <Button onClick={handleNewFatura}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar primeira fatura
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {isFormOpen && (
          <FaturaFormModal
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            fatura={selectedFatura}
            mode={formMode}
            onSuccess={handleFormSuccess}
          />
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Faturamento</h1>
            <p className="mt-1 text-muted-foreground">
              Gestão de faturas por produto
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {isAdminVizio && (
              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas Empresas</SelectItem>
                  {empresas.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={produtoFilter} onValueChange={setProdutoFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Produtos</SelectItem>
                <SelectItem value="saude">Saúde</SelectItem>
                <SelectItem value="vida">Vida</SelectItem>
                <SelectItem value="odonto">Odonto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="aguardando_pagamento">Aguardando</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atraso">Em Atraso</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
                <SelectItem value="24">Últimos 24 meses</SelectItem>
              </SelectContent>
            </Select>
            {canManage && (
              <Button onClick={handleNewFatura}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Fatura
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total do Período</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalPeriodo)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {filteredData.length} faturas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Em Aberto</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalAberto)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {filteredData.filter(f => f.status === "aguardando_pagamento").length} faturas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Em Atraso</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalAtraso)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {filteredData.filter(f => f.status === "atraso").length} faturas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total Pago</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalPago)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {filteredData.filter(f => f.status === "pago").length} faturas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Faturas Table */}
        <Card>
          <CardHeader>
            <CardTitle>Faturas</CardTitle>
            <CardDescription>Lista de faturas do período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Empresa</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma fatura encontrada com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((fatura) => {
                    const statusInfo = statusConfig[fatura.status];
                    const produtoInfo = produtoConfig[fatura.produto];
                    const StatusIcon = statusInfo?.icon || Clock;
                    const ProdutoIcon = produtoInfo?.icon || Heart;
                    const empresaNome = fatura.empresas?.nome || "—";
                    const filialNome = fatura.filial?.nome;

                    return (
                      <TableRow key={fatura.id}>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          <div>
                            {empresaNome}
                            {filialNome && (
                              <span className="block text-xs">Filial: {filialNome}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="md:hidden text-muted-foreground text-xs block">
                            {empresaNome}{filialNome && ` • ${filialNome}`}
                          </span>
                          {format(new Date(fatura.competencia), "MMM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${produtoInfo?.color} flex items-center gap-1 w-fit`}>
                            <ProdutoIcon className="h-3 w-3" />
                            {produtoInfo?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(fatura.vencimento), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(fatura.valor_total))}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusInfo?.color} flex items-center gap-1 w-fit`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewFatura(fatura)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canManage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditFatura(fatura)}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteFatura(fatura)}
                                  title="Excluir"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {isFormOpen && (
        <FaturaFormModal
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          fatura={selectedFatura}
          mode={formMode}
          onSuccess={handleFormSuccess}
        />
      )}

      {isDetailOpen && selectedFatura && (
        <FaturaDetailModal
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          fatura={selectedFatura}
        />
      )}

      {isDeleteOpen && selectedFatura && (
        <DeleteFaturaModal
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          fatura={selectedFatura}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </AppLayout>
  );
}
