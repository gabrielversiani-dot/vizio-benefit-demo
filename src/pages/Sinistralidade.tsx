import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingDown, AlertTriangle, FileText } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const statusConfig = {
  aprovado: { label: "Aprovado", color: "bg-success text-success-foreground" },
  em_analise: { label: "Em Análise", color: "bg-warning text-warning-foreground" },
  negado: { label: "Negado", color: "bg-destructive text-destructive-foreground" },
};

export default function Sinistralidade() {
  // TODO: Buscar dados reais do banco de dados
  const claimsData: any[] = [];
  const recentClaims: any[] = [];

  const totalClaims = recentClaims.reduce((acc, claim) => acc + claim.valor, 0);
  const approvedClaims = recentClaims.filter(c => c.status === "aprovado").length;

  // Estado vazio - aguardando importação de dados
  if (claimsData.length === 0 && recentClaims.length === 0) {
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
              <p className="text-3xl font-bold">-</p>
              <p className="text-sm text-muted-foreground mt-2">
                Aguardando dados
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
              <p className="text-sm text-muted-foreground mt-2">{recentClaims.length} ocorrências</p>
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
              <p className="text-3xl font-bold">
                {recentClaims.length > 0 
                  ? `${((approvedClaims / recentClaims.length) * 100).toFixed(0)}%`
                  : '-'
                }
              </p>
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
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">Nenhum dado disponível</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas e Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">Nenhum alerta no momento</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sinistros Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Nenhum sinistro registrado</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}