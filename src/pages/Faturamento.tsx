import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Calendar, CheckCircle, Clock, AlertCircle, Building2, TrendingUp, Users, FileText } from "lucide-react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Faturamento = {
  id: string;
  empresa_id: string;
  competencia: string;
  categoria: string;
  valor_mensalidade: number;
  valor_coparticipacao: number | null;
  valor_reembolsos: number | null;
  valor_total: number;
  total_vidas: number;
  total_titulares: number;
  total_dependentes: number;
  status: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
};

type Empresa = {
  id: string;
  nome: string;
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pago: { label: "Pago", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", icon: AlertCircle },
};

const categoriaLabels: Record<string, string> = {
  saude: "Saúde",
  vida: "Vida",
  odonto: "Odonto",
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function Faturamento() {
  const { empresaSelecionada } = useEmpresa();
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas");
  const [periodoFilter, setPeriodoFilter] = useState<string>("12");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("todas");

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

  // Fetch faturamento
  const { data: faturamento = [], isLoading } = useQuery({
    queryKey: ["faturamento", empresaSelecionada, periodoFilter],
    queryFn: async () => {
      const mesesAtras = new Date();
      mesesAtras.setMonth(mesesAtras.getMonth() - parseInt(periodoFilter));
      
      let query = supabase
        .from("faturamento")
        .select("*")
        .gte("competencia", mesesAtras.toISOString().split('T')[0])
        .order("competencia", { ascending: false });
      
      if (empresaSelecionada) {
        query = query.eq("empresa_id", empresaSelecionada);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Faturamento[];
    },
  });

  // Filter data
  const filteredData = useMemo(() => {
    let data = faturamento;
    if (empresaFilter !== "todas") {
      data = data.filter(f => f.empresa_id === empresaFilter);
    }
    if (categoriaFilter !== "todas") {
      data = data.filter(f => f.categoria === categoriaFilter);
    }
    return data;
  }, [faturamento, empresaFilter, categoriaFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const totalFaturado = filteredData
      .filter(f => f.status === "pago")
      .reduce((acc, f) => acc + Number(f.valor_total), 0);
    
    const totalPendente = filteredData
      .filter(f => f.status === "pendente")
      .reduce((acc, f) => acc + Number(f.valor_total), 0);
    
    const totalVencido = filteredData
      .filter(f => f.status === "vencido")
      .reduce((acc, f) => acc + Number(f.valor_total), 0);
    
    const totalVidas = filteredData.length > 0 
      ? Math.max(...filteredData.map(f => f.total_vidas))
      : 0;

    const faturaspagas = filteredData.filter(f => f.status === "pago").length;
    const faturasPendentes = filteredData.filter(f => f.status === "pendente").length;
    const faturasVencidas = filteredData.filter(f => f.status === "vencido").length;

    // Ticket médio por vida
    const ultimaCompetencia = filteredData[0];
    const ticketMedio = ultimaCompetencia && ultimaCompetencia.total_vidas > 0
      ? Number(ultimaCompetencia.valor_total) / ultimaCompetencia.total_vidas
      : 0;

    return { 
      totalFaturado, 
      totalPendente, 
      totalVencido, 
      totalVidas,
      faturaspagas,
      faturasPendentes,
      faturasVencidas,
      ticketMedio
    };
  }, [filteredData]);

  // Chart data - Evolução mensal
  const evolucaoMensal = useMemo(() => {
    const grouped: Record<string, { mes: string; mensalidade: number; coparticipacao: number; reembolsos: number; total: number }> = {};
    
    filteredData.forEach(f => {
      const mes = format(new Date(f.competencia), "MMM/yy", { locale: ptBR });
      if (!grouped[f.competencia]) {
        grouped[f.competencia] = { mes, mensalidade: 0, coparticipacao: 0, reembolsos: 0, total: 0 };
      }
      grouped[f.competencia].mensalidade += Number(f.valor_mensalidade);
      grouped[f.competencia].coparticipacao += Number(f.valor_coparticipacao || 0);
      grouped[f.competencia].reembolsos += Number(f.valor_reembolsos || 0);
      grouped[f.competencia].total += Number(f.valor_total);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([, v]) => v);
  }, [filteredData]);

  // Chart data - Evolução de vidas
  const evolucaoVidas = useMemo(() => {
    const grouped: Record<string, { mes: string; titulares: number; dependentes: number; total: number }> = {};
    
    filteredData.forEach(f => {
      const mes = format(new Date(f.competencia), "MMM/yy", { locale: ptBR });
      if (!grouped[f.competencia]) {
        grouped[f.competencia] = { mes, titulares: 0, dependentes: 0, total: 0 };
      }
      grouped[f.competencia].titulares = Math.max(grouped[f.competencia].titulares, f.total_titulares);
      grouped[f.competencia].dependentes = Math.max(grouped[f.competencia].dependentes, f.total_dependentes);
      grouped[f.competencia].total = Math.max(grouped[f.competencia].total, f.total_vidas);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([, v]) => v);
  }, [filteredData]);

  // Dados por empresa para tabela
  const dadosPorEmpresa = useMemo(() => {
    if (empresaSelecionada || empresaFilter !== "todas") return [];
    
    const grouped: Record<string, { empresa: string; faturado: number; pendente: number; vencido: number; vidas: number }> = {};
    
    faturamento.forEach(f => {
      const empresa = empresas.find(e => e.id === f.empresa_id);
      if (!grouped[f.empresa_id]) {
        grouped[f.empresa_id] = { 
          empresa: empresa?.nome || "Desconhecida", 
          faturado: 0, 
          pendente: 0, 
          vencido: 0,
          vidas: 0
        };
      }
      if (f.status === "pago") grouped[f.empresa_id].faturado += Number(f.valor_total);
      if (f.status === "pendente") grouped[f.empresa_id].pendente += Number(f.valor_total);
      if (f.status === "vencido") grouped[f.empresa_id].vencido += Number(f.valor_total);
      grouped[f.empresa_id].vidas = Math.max(grouped[f.empresa_id].vidas, f.total_vidas);
    });

    return Object.values(grouped).sort((a, b) => b.faturado - a.faturado);
  }, [faturamento, empresas, empresaSelecionada, empresaFilter]);

  // Faturas recentes
  const faturasRecentes = useMemo(() => {
    return filteredData.slice(0, 10).map(f => ({
      ...f,
      empresaNome: empresas.find(e => e.id === f.empresa_id)?.nome || "Desconhecida"
    }));
  }, [filteredData, empresas]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </AppLayout>
    );
  }

  if (faturamento.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Faturamento</h1>
            <p className="mt-2 text-muted-foreground">
              Gestão completa de faturas e recebíveis
            </p>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma fatura cadastrada</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Importe os dados de faturamento para visualizar as análises e estatísticas.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Faturamento</h1>
            <p className="mt-1 text-muted-foreground">
              Gestão completa de faturas e recebíveis
            </p>
          </div>
          <div className="flex gap-3">
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
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Categorias</SelectItem>
                <SelectItem value="saude">Saúde</SelectItem>
                <SelectItem value="vida">Vida</SelectItem>
                <SelectItem value="odonto">Odonto</SelectItem>
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
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total Faturado</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalFaturado)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {kpis.faturaspagas} faturas pagas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">A Receber</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalPendente)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {kpis.faturasPendentes} faturas pendentes
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
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalVencido)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {kpis.faturasVencidas} faturas vencidas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.ticketMedio)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Por vida/mês
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Evolução do Faturamento */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Evolução do Faturamento</CardTitle>
              <CardDescription>Composição mensal do faturamento</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        mensalidade: "Mensalidade",
                        coparticipacao: "Coparticipação",
                        reembolsos: "Reembolsos",
                        total: "Total"
                      };
                      return [formatCurrency(value), labels[name] || name];
                    }}
                  />
                  <Legend 
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        mensalidade: "Mensalidade",
                        coparticipacao: "Coparticipação",
                        reembolsos: "Reembolsos"
                      };
                      return labels[value] || value;
                    }}
                  />
                  <Area type="monotone" dataKey="mensalidade" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="coparticipacao" stackId="1" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="reembolsos" stackId="1" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Evolução de Vidas */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Vidas</CardTitle>
              <CardDescription>Total de beneficiários por mês</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={evolucaoVidas}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend 
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        titulares: "Titulares",
                        dependentes: "Dependentes"
                      };
                      return labels[value] || value;
                    }}
                  />
                  <Bar dataKey="titulares" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="dependentes" stackId="a" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Ticket médio por mês */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Médio por Vida</CardTitle>
              <CardDescription>Evolução do custo por beneficiário</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolucaoMensal.map((m, i) => ({
                  mes: m.mes,
                  ticket: evolucaoVidas[i]?.total > 0 ? m.total / evolucaoVidas[i].total : 0
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => `R$ ${v.toFixed(0)}`} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), "Ticket Médio"]} />
                  <Line type="monotone" dataKey="ticket" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela por Empresa */}
        {!empresaSelecionada && empresaFilter === "todas" && dadosPorEmpresa.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Faturamento por Empresa</CardTitle>
              <CardDescription>Resumo consolidado por empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Faturado</TableHead>
                    <TableHead className="text-right">Pendente</TableHead>
                    <TableHead className="text-right">Vencido</TableHead>
                    <TableHead className="text-right">Vidas</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosPorEmpresa.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.empresa}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(row.faturado)}</TableCell>
                      <TableCell className="text-right text-yellow-600">{formatCurrency(row.pendente)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(row.vencido)}</TableCell>
                      <TableCell className="text-right">{row.vidas.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">
                        {row.vidas > 0 ? formatCurrency((row.faturado + row.pendente) / row.vidas / 12) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Faturas Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Faturas Recentes</CardTitle>
            <CardDescription>Últimas faturas registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Vidas</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturasRecentes.map((fatura) => {
                  const config = statusConfig[fatura.status] || statusConfig.pendente;
                  const StatusIcon = config.icon;
                  
                  return (
                    <TableRow key={fatura.id}>
                      <TableCell className="font-medium">
                        {format(new Date(fatura.competencia), "MMM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{fatura.empresaNome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{categoriaLabels[fatura.categoria] || fatura.categoria}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(fatura.valor_total))}
                      </TableCell>
                      <TableCell className="text-right">{fatura.total_vidas.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        {fatura.data_vencimento 
                          ? format(new Date(fatura.data_vencimento), "dd/MM/yyyy")
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                          {config.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
