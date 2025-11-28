import { AppLayout } from "@/components/Layout/AppLayout";
import { StatCard } from "@/components/Dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const mockMonthlyData = [
  { month: "Jan", faturamento: 45000, sinistros: 12000 },
  { month: "Fev", faturamento: 52000, sinistros: 15000 },
  { month: "Mar", faturamento: 48000, sinistros: 13500 },
  { month: "Abr", faturamento: 61000, sinistros: 18000 },
  { month: "Mai", faturamento: 55000, sinistros: 16000 },
  { month: "Jun", faturamento: 67000, sinistros: 19500 },
];

const mockSinistralityData = [
  { tipo: "Saúde", valor: 45 },
  { tipo: "Odonto", valor: 28 },
  { tipo: "Vida", valor: 12 },
];

export default function Dashboard() {
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
            value="1,248"
            change="+12% vs mês anterior"
            changeType="positive"
            icon={Users}
            iconColor="bg-success/10 text-success"
          />
          <StatCard
            title="Faturamento Mensal"
            value="R$ 67.000"
            change="+8.2% vs mês anterior"
            changeType="positive"
            icon={DollarSign}
            iconColor="bg-chart-2/10 text-chart-2"
          />
          <StatCard
            title="Taxa de Sinistralidade"
            value="29.1%"
            change="-3.5% vs mês anterior"
            changeType="positive"
            icon={Activity}
            iconColor="bg-warning/10 text-warning"
          />
          <StatCard
            title="Ticket Médio"
            value="R$ 53,69"
            change="+2.1% vs mês anterior"
            changeType="positive"
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
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockMonthlyData}>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sinistralidade por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockSinistralityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="tipo" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => [`${value}%`, 'Taxa']}
                  />
                  <Bar 
                    dataKey="valor" 
                    fill="hsl(var(--chart-1))"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumo de Benefícios Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">Plano de Saúde</p>
                    <p className="text-sm text-muted-foreground">842 vidas ativas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">R$ 42.100</p>
                  <p className="text-sm text-muted-foreground">Faturamento mensal</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-chart-2" />
                  </div>
                  <div>
                    <p className="font-medium">Plano Odontológico</p>
                    <p className="text-sm text-muted-foreground">1,052 vidas ativas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">R$ 15.780</p>
                  <p className="text-sm text-muted-foreground">Faturamento mensal</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-chart-4" />
                  </div>
                  <div>
                    <p className="font-medium">Seguro de Vida</p>
                    <p className="text-sm text-muted-foreground">1,248 vidas ativas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">R$ 9.120</p>
                  <p className="text-sm text-muted-foreground">Faturamento mensal</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
