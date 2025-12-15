import { AppLayout } from "@/components/Layout/AppLayout";
import { StatCard } from "@/components/Dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, DollarSign, TrendingUp, Heart, Smile, Shield } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

export default function Dashboard() {
  const { empresaSelecionada } = useEmpresa();

  // Fetch beneficiários count
  const { data: beneficiarios = [], isLoading: loadingBeneficiarios } = useQuery({
    queryKey: ['dashboard-beneficiarios', empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from('beneficiarios')
        .select('id, status, plano_saude, plano_vida, plano_odonto, tipo')
        .eq('status', 'ativo');

      if (empresaSelecionada) {
        query = query.eq('empresa_id', empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch faturamento
  const { data: faturamento = [], isLoading: loadingFaturamento } = useQuery({
    queryKey: ['dashboard-faturamento', empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from('faturamento')
        .select('*')
        .order('competencia', { ascending: true });

      if (empresaSelecionada) {
        query = query.eq('empresa_id', empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch sinistralidade
  const { data: sinistralidade = [], isLoading: loadingSinistralidade } = useQuery({
    queryKey: ['dashboard-sinistralidade', empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from('sinistralidade')
        .select('*')
        .order('competencia', { ascending: true });

      if (empresaSelecionada) {
        query = query.eq('empresa_id', empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingBeneficiarios || loadingFaturamento || loadingSinistralidade;

  // Calculate KPIs
  const vidasAtivas = beneficiarios.length;
  const titulares = beneficiarios.filter(b => b.tipo === 'titular').length;
  const dependentes = beneficiarios.filter(b => b.tipo === 'dependente').length;

  const faturamentoTotal = faturamento.reduce((acc, f) => acc + (f.valor_total || 0), 0);
  const faturamentoMedio = faturamento.length > 0 ? faturamentoTotal / faturamento.length : 0;
  
  const sinistrosTotal = sinistralidade.reduce((acc, s) => acc + (s.valor_sinistros || 0), 0);
  const premioTotal = sinistralidade.reduce((acc, s) => acc + (s.valor_premio || 0), 0);
  const taxaSinistralidade = premioTotal > 0 ? (sinistrosTotal / premioTotal) * 100 : 0;

  // Monthly evolution data
  const monthlyData = faturamento.slice(-12).map((f) => {
    const competencia = new Date(f.competencia);
    const sinistroMes = sinistralidade.find(s => 
      new Date(s.competencia).getMonth() === competencia.getMonth() &&
      new Date(s.competencia).getFullYear() === competencia.getFullYear()
    );
    
    return {
      month: competencia.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      faturamento: f.valor_total || 0,
      sinistros: sinistroMes?.valor_sinistros || 0,
    };
  });

  // Sinistralidade by type
  const sinistrosPorTipo = sinistralidade.reduce((acc, s) => {
    acc.consultas += s.sinistros_consultas || 0;
    acc.exames += s.sinistros_exames || 0;
    acc.procedimentos += s.sinistros_procedimentos || 0;
    acc.internacoes += s.sinistros_internacoes || 0;
    acc.outros += s.sinistros_outros || 0;
    return acc;
  }, { consultas: 0, exames: 0, procedimentos: 0, internacoes: 0, outros: 0 });

  const totalSinistrosTipo = Object.values(sinistrosPorTipo).reduce((a, b) => a + b, 0);
  
  const sinistralityData = totalSinistrosTipo > 0 ? [
    { tipo: 'Consultas', valor: (sinistrosPorTipo.consultas / totalSinistrosTipo) * 100 },
    { tipo: 'Exames', valor: (sinistrosPorTipo.exames / totalSinistrosTipo) * 100 },
    { tipo: 'Procedimentos', valor: (sinistrosPorTipo.procedimentos / totalSinistrosTipo) * 100 },
    { tipo: 'Internações', valor: (sinistrosPorTipo.internacoes / totalSinistrosTipo) * 100 },
    { tipo: 'Outros', valor: (sinistrosPorTipo.outros / totalSinistrosTipo) * 100 },
  ].filter(d => d.valor > 0) : [];

  // Benefícios ativos data
  const beneficiosData = [
    { name: 'Saúde', value: beneficiarios.filter(b => b.plano_saude).length },
    { name: 'Vida', value: beneficiarios.filter(b => b.plano_vida).length },
    { name: 'Odonto', value: beneficiarios.filter(b => b.plano_odonto).length },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Visão geral da gestão de benefícios corporativos
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Vidas Ativas"
            value={vidasAtivas.toLocaleString('pt-BR')}
            change={`${titulares} titulares, ${dependentes} dependentes`}
            changeType="neutral"
            icon={Users}
            iconColor="bg-success/10 text-success"
          />
          <StatCard
            title="Faturamento Mensal"
            value={faturamentoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            change={faturamento.length > 0 ? `Média de ${faturamento.length} meses` : "Sem dados"}
            changeType="neutral"
            icon={DollarSign}
            iconColor="bg-chart-2/10 text-chart-2"
          />
          <StatCard
            title="Taxa de Sinistralidade"
            value={`${taxaSinistralidade.toFixed(1)}%`}
            change={taxaSinistralidade > 75 ? "Atenção: acima do ideal" : taxaSinistralidade > 0 ? "Dentro do esperado" : "Sem dados"}
            changeType={taxaSinistralidade > 75 ? "negative" : taxaSinistralidade > 0 ? "positive" : "neutral"}
            icon={Activity}
            iconColor="bg-warning/10 text-warning"
          />
          <StatCard
            title="Ticket Médio"
            value={vidasAtivas > 0 
              ? (faturamentoMedio / vidasAtivas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : "R$ 0,00"
            }
            change="Por vida ativa"
            changeType="neutral"
            icon={TrendingUp}
            iconColor="bg-chart-4/10 text-chart-4"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Faturamento vs Sinistros</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="faturamento" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      name="Faturamento"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sinistros" 
                      stroke="hsl(var(--warning))" 
                      strokeWidth={2}
                      name="Sinistros"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sinistralidade por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              {sinistralityData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sinistralityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="tipo" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `${value.toFixed(0)}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Participação']}
                    />
                    <Bar 
                      dataKey="valor" 
                      fill="hsl(var(--chart-1))"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumo de Benefícios Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            {beneficiosData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Nenhum benefício cadastrado
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-chart-1/10">
                  <div className="h-12 w-12 rounded-full bg-chart-1/20 flex items-center justify-center">
                    <Heart className="h-6 w-6 text-chart-1" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Plano Saúde</p>
                    <p className="text-2xl font-bold">{beneficiarios.filter(b => b.plano_saude).length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-chart-2/10">
                  <div className="h-12 w-12 rounded-full bg-chart-2/20 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-chart-2" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Seguro Vida</p>
                    <p className="text-2xl font-bold">{beneficiarios.filter(b => b.plano_vida).length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-chart-3/10">
                  <div className="h-12 w-12 rounded-full bg-chart-3/20 flex items-center justify-center">
                    <Smile className="h-6 w-6 text-chart-3" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Plano Odonto</p>
                    <p className="text-2xl font-bold">{beneficiarios.filter(b => b.plano_odonto).length}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
