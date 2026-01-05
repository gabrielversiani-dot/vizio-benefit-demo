import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, TrendingDown, TrendingUp, AlertTriangle, FileText, Building2, Stethoscope, FlaskConical, BedDouble, Scissors, Upload } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImportPDFModal } from "@/components/Sinistralidade/ImportPDFModal";

type Sinistralidade = {
  id: string;
  empresa_id: string;
  competencia: string;
  categoria: string;
  valor_premio: number;
  valor_sinistros: number;
  quantidade_sinistros: number;
  indice_sinistralidade: number | null;
  sinistros_consultas: number | null;
  sinistros_exames: number | null;
  sinistros_internacoes: number | null;
  sinistros_procedimentos: number | null;
  sinistros_outros: number | null;
};

type Empresa = {
  id: string;
  nome: string;
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export default function Sinistralidade() {
  const queryClient = useQueryClient();
  const { empresaSelecionada } = useEmpresa();
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas");
  const [periodoFilter, setPeriodoFilter] = useState<string>("12");
  const [importModalOpen, setImportModalOpen] = useState(false);

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

  // Fetch sinistralidade
  const { data: sinistralidade = [], isLoading } = useQuery({
    queryKey: ["sinistralidade", empresaSelecionada, periodoFilter],
    queryFn: async () => {
      const mesesAtras = new Date();
      mesesAtras.setMonth(mesesAtras.getMonth() - parseInt(periodoFilter));
      
      let query = supabase
        .from("sinistralidade")
        .select("*")
        .gte("competencia", mesesAtras.toISOString().split('T')[0])
        .order("competencia", { ascending: true });
      
      if (empresaSelecionada) {
        query = query.eq("empresa_id", empresaSelecionada);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Sinistralidade[];
    },
  });

  // Filter by empresa
  const filteredData = useMemo(() => {
    if (empresaFilter === "todas") return sinistralidade;
    return sinistralidade.filter(s => s.empresa_id === empresaFilter);
  }, [sinistralidade, empresaFilter]);

  // KPIs
  const kpis = useMemo(() => {
    if (filteredData.length === 0) return {
      totalPremio: 0,
      totalSinistros: 0,
      mediaSinistralidade: 0,
      totalQuantidade: 0,
      tendencia: 0,
    };

    const totalPremio = filteredData.reduce((acc, s) => acc + Number(s.valor_premio), 0);
    const totalSinistros = filteredData.reduce((acc, s) => acc + Number(s.valor_sinistros), 0);
    const totalQuantidade = filteredData.reduce((acc, s) => acc + s.quantidade_sinistros, 0);
    const mediaSinistralidade = totalPremio > 0 ? (totalSinistros / totalPremio) * 100 : 0;

    // Calcular tendência (comparar últimos 3 meses com 3 meses anteriores)
    const sorted = [...filteredData].sort((a, b) => new Date(b.competencia).getTime() - new Date(a.competencia).getTime());
    const ultimos3 = sorted.slice(0, 3);
    const anteriores3 = sorted.slice(3, 6);
    
    const mediaUltimos = ultimos3.length > 0 
      ? ultimos3.reduce((acc, s) => acc + Number(s.indice_sinistralidade || 0), 0) / ultimos3.length 
      : 0;
    const mediaAnteriores = anteriores3.length > 0 
      ? anteriores3.reduce((acc, s) => acc + Number(s.indice_sinistralidade || 0), 0) / anteriores3.length 
      : 0;
    
    const tendencia = mediaAnteriores > 0 ? ((mediaUltimos - mediaAnteriores) / mediaAnteriores) * 100 : 0;

    return { totalPremio, totalSinistros, mediaSinistralidade, totalQuantidade, tendencia };
  }, [filteredData]);

  // Chart data - Evolução mensal
  const evolucaoMensal = useMemo(() => {
    const grouped: Record<string, { mes: string; premio: number; sinistros: number; indice: number; count: number }> = {};
    
    filteredData.forEach(s => {
      const mes = format(new Date(s.competencia), "MMM/yy", { locale: ptBR });
      if (!grouped[s.competencia]) {
        grouped[s.competencia] = { mes, premio: 0, sinistros: 0, indice: 0, count: 0 };
      }
      grouped[s.competencia].premio += Number(s.valor_premio);
      grouped[s.competencia].sinistros += Number(s.valor_sinistros);
      grouped[s.competencia].indice += Number(s.indice_sinistralidade || 0);
      grouped[s.competencia].count += 1;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([, v]) => ({
        mes: v.mes,
        premio: v.premio,
        sinistros: v.sinistros,
        indice: v.count > 0 ? v.indice / v.count : 0,
      }));
  }, [filteredData]);

  // Chart data - Distribuição por tipo de sinistro
  const distribuicaoTipo = useMemo(() => {
    const totals = filteredData.reduce((acc, s) => ({
      consultas: acc.consultas + Number(s.sinistros_consultas || 0),
      exames: acc.exames + Number(s.sinistros_exames || 0),
      internacoes: acc.internacoes + Number(s.sinistros_internacoes || 0),
      procedimentos: acc.procedimentos + Number(s.sinistros_procedimentos || 0),
      outros: acc.outros + Number(s.sinistros_outros || 0),
    }), { consultas: 0, exames: 0, internacoes: 0, procedimentos: 0, outros: 0 });

    return [
      { name: "Consultas", value: totals.consultas, icon: Stethoscope },
      { name: "Exames", value: totals.exames, icon: FlaskConical },
      { name: "Internações", value: totals.internacoes, icon: BedDouble },
      { name: "Procedimentos", value: totals.procedimentos, icon: Scissors },
      { name: "Outros", value: totals.outros, icon: FileText },
    ].filter(d => d.value > 0);
  }, [filteredData]);

  // Alertas
  const alertas = useMemo(() => {
    const alerts: { tipo: string; mensagem: string; severidade: "warning" | "error" | "info" }[] = [];
    
    if (kpis.mediaSinistralidade > 85) {
      alerts.push({
        tipo: "Sinistralidade Alta",
        mensagem: `Índice de sinistralidade em ${kpis.mediaSinistralidade.toFixed(1)}% - acima do limite recomendado de 85%`,
        severidade: "error"
      });
    } else if (kpis.mediaSinistralidade > 75) {
      alerts.push({
        tipo: "Atenção",
        mensagem: `Índice de sinistralidade em ${kpis.mediaSinistralidade.toFixed(1)}% - próximo do limite`,
        severidade: "warning"
      });
    }

    if (kpis.tendencia > 10) {
      alerts.push({
        tipo: "Tendência de Alta",
        mensagem: `Sinistralidade crescendo ${kpis.tendencia.toFixed(1)}% nos últimos 3 meses`,
        severidade: "warning"
      });
    } else if (kpis.tendencia < -5) {
      alerts.push({
        tipo: "Melhoria",
        mensagem: `Sinistralidade reduzindo ${Math.abs(kpis.tendencia).toFixed(1)}% nos últimos 3 meses`,
        severidade: "info"
      });
    }

    return alerts;
  }, [kpis]);

  // Dados por empresa para tabela
  const dadosPorEmpresa = useMemo(() => {
    const grouped: Record<string, { empresa: string; premio: number; sinistros: number; quantidade: number }> = {};
    
    sinistralidade.forEach(s => {
      const empresa = empresas.find(e => e.id === s.empresa_id);
      if (!grouped[s.empresa_id]) {
        grouped[s.empresa_id] = { 
          empresa: empresa?.nome || "Desconhecida", 
          premio: 0, 
          sinistros: 0, 
          quantidade: 0 
        };
      }
      grouped[s.empresa_id].premio += Number(s.valor_premio);
      grouped[s.empresa_id].sinistros += Number(s.valor_sinistros);
      grouped[s.empresa_id].quantidade += s.quantidade_sinistros;
    });

    return Object.values(grouped)
      .map(d => ({
        ...d,
        indice: d.premio > 0 ? (d.sinistros / d.premio) * 100 : 0
      }))
      .sort((a, b) => b.sinistros - a.sinistros);
  }, [sinistralidade, empresas]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </AppLayout>
    );
  }

  if (sinistralidade.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Sinistralidade</h1>
            <p className="mt-2 text-muted-foreground">
              Análise detalhada de sinistros e utilização de benefícios
            </p>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhum dado de sinistralidade</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Importe os dados de sinistros para visualizar as análises e estatísticas.
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
            <h1 className="text-3xl font-bold tracking-tight">Sinistralidade</h1>
            <p className="mt-1 text-muted-foreground">
              Análise detalhada de sinistros e utilização de benefícios
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setImportModalOpen(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar PDF (Unimed)
            </Button>
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
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Índice Médio</p>
              </div>
              <p className="text-3xl font-bold">{formatPercent(kpis.mediaSinistralidade)}</p>
              <div className="flex items-center gap-1 mt-2">
                {kpis.tendencia > 0 ? (
                  <TrendingUp className="h-4 w-4 text-destructive" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                )}
                <p className={`text-sm ${kpis.tendencia > 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {kpis.tendencia > 0 ? '+' : ''}{kpis.tendencia.toFixed(1)}% vs período anterior
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total Prêmio</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalPremio)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Receita no período
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total Sinistros</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalSinistros)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {kpis.totalQuantidade.toLocaleString('pt-BR')} ocorrências
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Margem</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(kpis.totalPremio - kpis.totalSinistros)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Prêmio - Sinistros
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Evolução da Sinistralidade */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Evolução da Sinistralidade</CardTitle>
              <CardDescription>Comparativo mensal de prêmio vs sinistros</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === "indice") return [`${value.toFixed(1)}%`, "Índice"];
                      return [formatCurrency(value), name === "premio" ? "Prêmio" : "Sinistros"];
                    }}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="premio" name="Prêmio" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  <Area yAxisId="left" type="monotone" dataKey="sinistros" name="Sinistros" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} />
                  <Line yAxisId="right" type="monotone" dataKey="indice" name="Índice %" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribuição por Tipo */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Tipo</CardTitle>
              <CardDescription>Sinistros por categoria de utilização</CardDescription>
            </CardHeader>
            <CardContent>
              {distribuicaoTipo.length === 0 ? (
                <div className="flex items-center justify-center h-[300px]">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={distribuicaoTipo}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {distribuicaoTipo.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Alertas e Recomendações */}
          <Card>
            <CardHeader>
              <CardTitle>Alertas e Recomendações</CardTitle>
              <CardDescription>Pontos de atenção identificados</CardDescription>
            </CardHeader>
            <CardContent>
              {alertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[260px]">
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3">
                    <TrendingDown className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-muted-foreground">Nenhum alerta no momento</p>
                  <p className="text-sm text-muted-foreground">Indicadores dentro dos parâmetros</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertas.map((alerta, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border ${
                        alerta.severidade === 'error' 
                          ? 'bg-destructive/10 border-destructive/20' 
                          : alerta.severidade === 'warning'
                          ? 'bg-orange-500/10 border-orange-500/20'
                          : 'bg-blue-500/10 border-blue-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className={`h-4 w-4 ${
                          alerta.severidade === 'error' 
                            ? 'text-destructive' 
                            : alerta.severidade === 'warning'
                            ? 'text-orange-500'
                            : 'text-blue-500'
                        }`} />
                        <span className="font-medium">{alerta.tipo}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela por Empresa */}
        {!empresaSelecionada && empresaFilter === "todas" && (
          <Card>
            <CardHeader>
              <CardTitle>Sinistralidade por Empresa</CardTitle>
              <CardDescription>Comparativo de indicadores entre empresas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Prêmio Total</TableHead>
                    <TableHead className="text-right">Sinistros Total</TableHead>
                    <TableHead className="text-right">Qtd. Ocorrências</TableHead>
                    <TableHead className="text-right">Índice</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosPorEmpresa.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.empresa}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.premio)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.sinistros)}</TableCell>
                      <TableCell className="text-right">{row.quantidade.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right font-medium">{formatPercent(row.indice)}</TableCell>
                      <TableCell>
                        <Badge className={
                          row.indice > 85 
                            ? 'bg-destructive/10 text-destructive' 
                            : row.indice > 75 
                            ? 'bg-orange-500/10 text-orange-600'
                            : 'bg-green-500/10 text-green-600'
                        }>
                          {row.indice > 85 ? 'Crítico' : row.indice > 75 ? 'Atenção' : 'Normal'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Detalhamento por Tipo de Sinistro */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Tipo de Utilização</CardTitle>
            <CardDescription>Valores totais por categoria de sinistro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              {distribuicaoTipo.map((tipo, index) => {
                const Icon = tipo.icon;
                return (
                  <div key={tipo.name} className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${COLORS[index]}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: COLORS[index] }} />
                      </div>
                      <span className="text-sm font-medium">{tipo.name}</span>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency(tipo.value)}</p>
                    <p className="text-xs text-muted-foreground">
                      {kpis.totalSinistros > 0 ? ((tipo.value / kpis.totalSinistros) * 100).toFixed(1) : 0}% do total
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <ImportPDFModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImportComplete={() => queryClient.invalidateQueries({ queryKey: ["sinistralidade"] })}
      />
    </AppLayout>
  );
}
