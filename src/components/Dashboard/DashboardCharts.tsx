import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

interface ChartData {
  sinistralityChartData: Array<{
    month: string;
    premio: number | null;
    sinistros: number | null;
    iu: number | null;
    iuFonte: string;
  }>;
  faturamentoByStatus: Array<{
    status: string;
    valor: number;
    color: string;
  }>;
  demandasByStatus: Array<{
    status: string;
    count: number;
    color: string;
  }>;
}

interface DashboardChartsProps {
  data: ChartData | null | undefined;
  isLoading: boolean;
}

// Custom tooltip for sinistralidade chart
function SinistralityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const premio = payload.find((p: any) => p.dataKey === "premio")?.value;
  const sinistros = payload.find((p: any) => p.dataKey === "sinistros")?.value;
  const dataPoint = payload[0]?.payload;
  const iu = dataPoint?.iu;
  const iuFonte = dataPoint?.iuFonte;

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        {premio !== null && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Prêmio:</span>
            <span className="font-medium text-chart-2">
              {premio?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        )}
        {sinistros !== null && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Sinistros:</span>
            <span className="font-medium text-warning">
              {sinistros?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        )}
        {iu !== null && (
          <div className="flex justify-between gap-4 pt-1 border-t border-border">
            <span className="text-muted-foreground">
              IU ({iuFonte}):
            </span>
            <span className={`font-bold ${iu > 85 ? "text-destructive" : iu > 70 ? "text-warning" : "text-success"}`}>
              {iu?.toFixed(1)}%
            </span>
          </div>
        )}
        {premio === null && sinistros === null && (
          <p className="text-muted-foreground italic">Sem dados neste mês</p>
        )}
      </div>
    </div>
  );
}

export function DashboardCharts({ data, isLoading }: DashboardChartsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const hasChartData = data?.sinistralityChartData?.some(
    (d) => d.premio !== null || d.sinistros !== null
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Evolução da Sinistralidade - 12 meses fixos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução da Sinistralidade</CardTitle>
          <p className="text-xs text-muted-foreground">
            Prêmio vs Sinistros (últimos 12 meses)
          </p>
        </CardHeader>
        <CardContent>
          {!hasChartData ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p>Nenhum dado de sinistralidade disponível</p>
                <p className="text-xs mt-1">Importe um relatório para visualizar</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data?.sinistralityChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickMargin={8}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                  }
                />
                <Tooltip content={<SinistralityTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="premio"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  name="Prêmio"
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="sinistros"
                  stroke="hsl(var(--warning))"
                  strokeWidth={2}
                  name="Sinistros"
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Faturamento por Status + Demandas por Status */}
      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Faturamento por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.faturamentoByStatus?.length ? (
              <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhuma fatura no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={data.faturamentoByStatus} layout="vertical">
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="status"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                      "Valor",
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {data.faturamentoByStatus.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Demandas por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.demandasByStatus?.length ? (
              <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhuma demanda no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={data.demandasByStatus} layout="vertical">
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                  />
                  <YAxis
                    type="category"
                    dataKey="status"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, "Demandas"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.demandasByStatus.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
