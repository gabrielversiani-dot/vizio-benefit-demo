import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const mockClaimsData = [
  { name: "Saúde", value: 45, color: "hsl(var(--chart-1))" },
  { name: "Odonto", value: 28, color: "hsl(var(--chart-2))" },
  { name: "Vida", value: 12, color: "hsl(var(--chart-4))" },
  { name: "Outros", value: 15, color: "hsl(var(--chart-3))" },
];

const mockRecentClaims = [
  { 
    id: "SIN-2024-045", 
    beneficiario: "João Silva", 
    empresa: "Empresa Alpha Ltda",
    tipo: "Saúde", 
    valor: 3500, 
    status: "aprovado",
    data: "2024-11-25"
  },
  { 
    id: "SIN-2024-046", 
    beneficiario: "Maria Santos", 
    empresa: "Beta Tecnologia S.A.",
    tipo: "Odonto", 
    valor: 850, 
    status: "em_analise",
    data: "2024-11-26"
  },
  { 
    id: "SIN-2024-047", 
    beneficiario: "Pedro Costa", 
    empresa: "Gamma Indústria",
    tipo: "Saúde", 
    valor: 12000, 
    status: "aprovado",
    data: "2024-11-24"
  },
  { 
    id: "SIN-2024-048", 
    beneficiario: "Ana Oliveira", 
    empresa: "Delta Comércio",
    tipo: "Vida", 
    valor: 25000, 
    status: "negado",
    data: "2024-11-23"
  },
];

const statusConfig = {
  aprovado: { label: "Aprovado", color: "bg-success text-success-foreground" },
  em_analise: { label: "Em Análise", color: "bg-warning text-warning-foreground" },
  negado: { label: "Negado", color: "bg-destructive text-destructive-foreground" },
};

export default function Sinistralidade() {
  const totalClaims = mockRecentClaims.reduce((acc, claim) => acc + claim.valor, 0);
  const approvedClaims = mockRecentClaims.filter(c => c.status === "aprovado").length;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Sinistralidade</h1>
          <p className="mt-2 text-muted-foreground">
            Análise detalhada de sinistros e utilização de benefícios
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-warning" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Taxa Média</p>
              </div>
              <p className="text-3xl font-bold">29.1%</p>
              <p className="text-sm text-success mt-2 flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                -3.5% vs mês anterior
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-chart-1/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-chart-1" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total Sinistros</p>
              </div>
              <p className="text-3xl font-bold">R$ {totalClaims.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground mt-2">{mockRecentClaims.length} ocorrências</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-chart-2" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Aprovação</p>
              </div>
              <p className="text-3xl font-bold">{((approvedClaims / mockRecentClaims.length) * 100).toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground mt-2">{approvedClaims} aprovados</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={mockClaimsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {mockClaimsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => [`${value}%`, 'Taxa']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas e Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3 p-4 rounded-lg bg-success/10">
                  <TrendingDown className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <p className="font-medium text-success">Sinistralidade em queda</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      A taxa de sinistralidade diminuiu 3.5% em relação ao mês anterior. Continue monitorando.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-4 rounded-lg bg-warning/10">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium text-warning">Alta em Planos Odontológicos</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Detectado aumento de 15% nos sinistros odontológicos. Recomenda-se revisão de coberturas.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-4 rounded-lg bg-chart-2/10">
                  <Activity className="h-5 w-5 text-chart-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-chart-2">Análise de tendências</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Padrão sazonal identificado para Q4. Esperado aumento nos próximos 2 meses.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sinistros Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentClaims.map((claim) => {
                const config = statusConfig[claim.status as keyof typeof statusConfig];
                
                return (
                  <div
                    key={claim.id}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-semibold">{claim.beneficiario}</p>
                          <Badge variant="secondary" className="text-xs">
                            {claim.tipo}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{claim.id}</span>
                          <span>{claim.empresa}</span>
                          <span>{new Date(claim.data).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xl font-bold">
                          R$ {claim.valor.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Badge className={config.color}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
