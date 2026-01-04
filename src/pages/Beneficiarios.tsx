import { AppLayout } from "@/components/Layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, UserPlus, Users, UserCheck, Heart, Shield, Smile, Building2, Upload, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { format } from "date-fns";
import { ImportCSVModal } from "@/components/Beneficiarios/ImportCSVModal";
import { BeneficiarioFormModal } from "@/components/Beneficiarios/BeneficiarioFormModal";
import { toast } from "sonner";
type Beneficiario = {
  id: string;
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  sexo: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  matricula: string | null;
  tipo: string;
  titular_id: string | null;
  grau_parentesco: string | null;
  cargo: string | null;
  departamento: string | null;
  plano_saude: boolean | null;
  plano_vida: boolean | null;
  plano_odonto: boolean | null;
  status: string;
  data_inclusao: string;
  empresa_id: string;
};

type Empresa = {
  id: string;
  nome: string;
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const statusColors: Record<string, string> = {
  ativo: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  inativo: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  suspenso: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  suspenso: "Suspenso",
};

function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

function getFaixaEtaria(idade: number): string {
  if (idade < 18) return "0-17";
  if (idade < 30) return "18-29";
  if (idade < 40) return "30-39";
  if (idade < 50) return "40-49";
  if (idade < 60) return "50-59";
  return "60+";
}

export default function Beneficiarios() {
  const { empresaSelecionada } = useEmpresa();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [planoFilter, setPlanoFilter] = useState<string>("todos");
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedBeneficiario, setSelectedBeneficiario] = useState<Beneficiario | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [beneficiarioToDelete, setBeneficiarioToDelete] = useState<Beneficiario | null>(null);

  // Fetch empresas
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
  });

  // Fetch beneficiarios
  const { data: beneficiarios = [], isLoading } = useQuery({
    queryKey: ["beneficiarios", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("beneficiarios")
        .select("*")
        .order("nome_completo");
      
      if (empresaSelecionada) {
        query = query.eq("empresa_id", empresaSelecionada);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Beneficiario[];
    },
  });

  // Filtered beneficiarios
  const filteredBeneficiarios = useMemo(() => {
    return beneficiarios.filter((b) => {
      const matchesSearch = b.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.cpf.includes(searchTerm);
      const matchesStatus = statusFilter === "todos" || b.status === statusFilter;
      const matchesTipo = tipoFilter === "todos" || b.tipo === tipoFilter;
      const matchesEmpresa = empresaFilter === "todas" || b.empresa_id === empresaFilter;
      
      let matchesPlano = true;
      if (planoFilter === "saude") matchesPlano = b.plano_saude === true;
      else if (planoFilter === "vida") matchesPlano = b.plano_vida === true;
      else if (planoFilter === "odonto") matchesPlano = b.plano_odonto === true;
      
      return matchesSearch && matchesStatus && matchesTipo && matchesPlano && matchesEmpresa;
    });
  }, [beneficiarios, searchTerm, statusFilter, tipoFilter, planoFilter, empresaFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filteredBeneficiarios.length;
    const ativos = filteredBeneficiarios.filter(b => b.status === "ativo").length;
    const inativos = filteredBeneficiarios.filter(b => b.status === "inativo").length;
    const suspensos = filteredBeneficiarios.filter(b => b.status === "suspenso").length;
    const titulares = filteredBeneficiarios.filter(b => b.tipo === "titular").length;
    const dependentes = filteredBeneficiarios.filter(b => b.tipo === "dependente").length;
    const comSaude = filteredBeneficiarios.filter(b => b.plano_saude).length;
    const comVida = filteredBeneficiarios.filter(b => b.plano_vida).length;
    const comOdonto = filteredBeneficiarios.filter(b => b.plano_odonto).length;
    
    return { total, ativos, inativos, suspensos, titulares, dependentes, comSaude, comVida, comOdonto };
  }, [filteredBeneficiarios]);

  // Chart data - Distribuição por plano
  const planoDistribuicao = useMemo(() => [
    { name: "Saúde", value: kpis.comSaude, color: COLORS[0] },
    { name: "Vida", value: kpis.comVida, color: COLORS[1] },
    { name: "Odonto", value: kpis.comOdonto, color: COLORS[2] },
  ], [kpis]);

  // Chart data - Distribuição por tipo
  const tipoDistribuicao = useMemo(() => [
    { name: "Titulares", value: kpis.titulares, color: COLORS[0] },
    { name: "Dependentes", value: kpis.dependentes, color: COLORS[3] },
  ], [kpis]);

  // Chart data - Por cidade
  const cidadeDistribuicao = useMemo(() => {
    const cidadeCounts: Record<string, number> = {};
    filteredBeneficiarios.forEach(b => {
      const cidade = b.cidade || "Não informado";
      cidadeCounts[cidade] = (cidadeCounts[cidade] || 0) + 1;
    });
    return Object.entries(cidadeCounts)
      .map(([cidade, total]) => ({ cidade, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredBeneficiarios]);

  // Chart data - Por faixa etária
  const faixaEtariaDistribuicao = useMemo(() => {
    const faixas: Record<string, number> = {
      "0-17": 0, "18-29": 0, "30-39": 0, "40-49": 0, "50-59": 0, "60+": 0
    };
    filteredBeneficiarios.forEach(b => {
      const idade = calcularIdade(b.data_nascimento);
      const faixa = getFaixaEtaria(idade);
      faixas[faixa]++;
    });
    return Object.entries(faixas).map(([faixa, total]) => ({ faixa, total }));
  }, [filteredBeneficiarios]);

  // Filter beneficiarios by plan type for tabs
  const beneficiariosSaude = filteredBeneficiarios.filter(b => b.plano_saude);
  const beneficiariosVida = filteredBeneficiarios.filter(b => b.plano_vida);
  const beneficiariosOdonto = filteredBeneficiarios.filter(b => b.plano_odonto);

  const handleEdit = (beneficiario: Beneficiario) => {
    setSelectedBeneficiario(beneficiario);
    setFormModalOpen(true);
  };

  const handleDelete = async () => {
    if (!beneficiarioToDelete) return;
    
    try {
      const { error } = await supabase
        .from("beneficiarios")
        .delete()
        .eq("id", beneficiarioToDelete.id);
      
      if (error) throw error;
      
      toast.success("Beneficiário excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["beneficiarios"] });
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(error.message || "Erro ao excluir beneficiário");
    } finally {
      setDeleteDialogOpen(false);
      setBeneficiarioToDelete(null);
    }
  };

  const openDeleteDialog = (beneficiario: Beneficiario) => {
    setBeneficiarioToDelete(beneficiario);
    setDeleteDialogOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormModalOpen(open);
    if (!open) {
      setSelectedBeneficiario(null);
    }
  };

  const renderBeneficiariosList = (list: Beneficiario[], planoLabel: string) => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar beneficiários de ${planoLabel}...`}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Tipos</SelectItem>
            <SelectItem value="titular">Titular</SelectItem>
            <SelectItem value="dependente">Dependente</SelectItem>
          </SelectContent>
        </Select>
        {!empresaSelecionada && (
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-[200px]">
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
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum beneficiário encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Data Inclusão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.nome_completo}</TableCell>
                  <TableCell>{b.cpf}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{b.tipo}</Badge>
                  </TableCell>
                  <TableCell>{b.cidade && b.uf ? `${b.cidade}/${b.uf}` : "-"}</TableCell>
                  <TableCell>{b.cargo || "-"}</TableCell>
                  <TableCell>{format(new Date(b.data_inclusao), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[b.status]}>
                      {statusLabels[b.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(b)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => openDeleteDialog(b)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Beneficiários</h1>
            <p className="text-muted-foreground mt-1">
              Gestão de beneficiários por categoria
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                if (!empresaSelecionada) {
                  toast.error("Selecione uma empresa para importar beneficiários");
                  return;
                }
                setImportModalOpen(true);
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
            <Button
              onClick={() => {
                if (!empresaSelecionada) {
                  toast.error("Selecione uma empresa para adicionar beneficiário");
                  return;
                }
                setSelectedBeneficiario(null);
                setFormModalOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Beneficiário
            </Button>
          </div>
        </div>

        {empresaSelecionada && (
          <>
            <ImportCSVModal
              open={importModalOpen}
              onOpenChange={setImportModalOpen}
              empresaId={empresaSelecionada}
            />
            <BeneficiarioFormModal
              open={formModalOpen}
              onOpenChange={handleFormClose}
              empresaId={empresaSelecionada}
              beneficiario={selectedBeneficiario}
            />
          </>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o beneficiário "{beneficiarioToDelete?.nome_completo}"? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
            <TabsTrigger value="saude">Saúde</TabsTrigger>
            <TabsTrigger value="vida">Vida</TabsTrigger>
            <TabsTrigger value="odonto">Odonto</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {/* Filtros globais */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar beneficiários..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {!empresaSelecionada && (
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
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Status</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={planoFilter} onValueChange={setPlanoFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Planos</SelectItem>
                      <SelectItem value="saude">Saúde</SelectItem>
                      <SelectItem value="vida">Vida</SelectItem>
                      <SelectItem value="odonto">Odonto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Beneficiários</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis.titulares} titulares, {kpis.dependentes} dependentes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                  <UserCheck className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.ativos}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis.total > 0 ? ((kpis.ativos / kpis.total) * 100).toFixed(1) : 0}% do total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Plano Saúde</CardTitle>
                  <Heart className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.comSaude}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis.total > 0 ? ((kpis.comSaude / kpis.total) * 100).toFixed(1) : 0}% do total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Plano Vida</CardTitle>
                  <Shield className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.comVida}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis.total > 0 ? ((kpis.comVida / kpis.total) * 100).toFixed(1) : 0}% do total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Plano Odonto</CardTitle>
                  <Smile className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.comOdonto}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis.total > 0 ? ((kpis.comOdonto / kpis.total) * 100).toFixed(1) : 0}% do total
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Distribuição por Plano */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Plano</CardTitle>
                  <CardDescription>Total de beneficiários por tipo de plano</CardDescription>
                </CardHeader>
                <CardContent>
                  {kpis.total === 0 ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={planoDistribuicao}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {planoDistribuicao.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Distribuição Titular vs Dependente */}
              <Card>
                <CardHeader>
                  <CardTitle>Titulares vs Dependentes</CardTitle>
                  <CardDescription>Proporção de titulares e dependentes</CardDescription>
                </CardHeader>
                <CardContent>
                  {kpis.total === 0 ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={tipoDistribuicao}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {tipoDistribuicao.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Beneficiários por Cidade */}
              <Card>
                <CardHeader>
                  <CardTitle>Beneficiários por Cidade</CardTitle>
                  <CardDescription>Top 5 cidades</CardDescription>
                </CardHeader>
                <CardContent>
                  {cidadeDistribuicao.length === 0 ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={cidadeDistribuicao}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="cidade" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Distribuição por Faixa Etária */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Faixa Etária</CardTitle>
                  <CardDescription>Quantidade de beneficiários por idade</CardDescription>
                </CardHeader>
                <CardContent>
                  {kpis.total === 0 ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={faixaEtariaDistribuicao} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="faixa" type="category" width={60} />
                        <Tooltip />
                        <Bar dataKey="total" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Lista de beneficiários */}
            <Card>
              <CardHeader>
                <CardTitle>Lista de Beneficiários</CardTitle>
                <CardDescription>
                  {filteredBeneficiarios.length} beneficiários encontrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredBeneficiarios.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum beneficiário encontrado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Planos</TableHead>
                        <TableHead>Cidade/UF</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBeneficiarios.slice(0, 10).map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.nome_completo}</TableCell>
                          <TableCell>{b.cpf}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{b.tipo}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {b.plano_saude && <Badge variant="secondary" className="text-xs">Saúde</Badge>}
                              {b.plano_vida && <Badge variant="secondary" className="text-xs">Vida</Badge>}
                              {b.plano_odonto && <Badge variant="secondary" className="text-xs">Odonto</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>{b.cidade && b.uf ? `${b.cidade}/${b.uf}` : "-"}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[b.status]}>
                              {statusLabels[b.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(b)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => openDeleteDialog(b)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saude" className="mt-6">
            {renderBeneficiariosList(beneficiariosSaude, "saúde")}
          </TabsContent>

          <TabsContent value="vida" className="mt-6">
            {renderBeneficiariosList(beneficiariosVida, "vida")}
          </TabsContent>

          <TabsContent value="odonto" className="mt-6">
            {renderBeneficiariosList(beneficiariosOdonto, "odonto")}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
