import { AppLayout } from "@/components/Layout/AppLayout";
import { StatCard } from "@/components/Dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, DollarSign, TrendingUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Dados reais virão do banco de dados
const monthlyData: { month: string; faturamento: number; sinistros: number }[] = [];
const sinistralityData: { tipo: string; valor: number }[] = [];

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
            value="0"
            change="Aguardando dados"
            changeType="neutral"
            icon={Users}
            iconColor="bg-success/10 text-success"
          />
          <StatCard
            title="Faturamento Mensal"
            value="R$ 0"
            change="Aguardando dados"
            changeType="neutral"
            icon={DollarSign}
            iconColor="bg-chart-2/10 text-chart-2"
          />
          <StatCard
            title="Taxa de Sinistralidade"
            value="0%"
            change="Aguardando dados"
            changeType="neutral"
            icon={Activity}
            iconColor="bg-warning/10 text-warning"
          />
          <StatCard
            title="Ticket Médio"
            value="R$ 0,00"
            change="Aguardando dados"
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
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumo de Benefícios Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Nenhum benefício cadastrado
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
