import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, Activity, DollarSign, TrendingUp, FileText, ClipboardList, Info } from "lucide-react";
import { formatSLA } from "@/hooks/useDashboardData";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface KPIData {
  vidasAtivas: number;
  titulares: number;
  dependentes: number;
  indiceMedio: number;
  premioMedio: number;
  sinistrosMedio: number;
  fonteSinistralidade: string;
  hasPDFData: boolean;
  faturasTotal: number;
  faturasPago: number;
  faturasAguardando: number;
  faturasAtraso: number;
  demandasTotal: number;
  demandasConcluidas: number;
  slaMedioSegundos: number;
}

interface KPICardsProps {
  data: KPIData | null | undefined;
  isLoading: boolean;
}

export function KPICards({ data, isLoading }: KPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="text-center text-muted-foreground text-sm">
              Sem dados
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      title: "Vidas Ativas",
      value: data.vidasAtivas.toLocaleString("pt-BR"),
      subtitle: `${data.titulares} tit. | ${data.dependentes} dep.`,
      icon: Users,
      iconColor: "text-chart-1 bg-chart-1/10",
    },
    {
      title: "Índice Médio (IU)",
      value: `${data.indiceMedio.toFixed(1)}%`,
      subtitle: data.fonteSinistralidade,
      icon: Activity,
      iconColor: data.indiceMedio > 85 ? "text-destructive bg-destructive/10" : "text-warning bg-warning/10",
      tooltip: data.hasPDFData ? "Média do período importada do PDF" : "Calculado: Sinistros ÷ Prêmio × 100",
    },
    {
      title: "Prêmio Médio",
      value: data.premioMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
      subtitle: "Média mensal",
      icon: DollarSign,
      iconColor: "text-chart-2 bg-chart-2/10",
    },
    {
      title: "Sinistros Médio",
      value: data.sinistrosMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
      subtitle: "Média mensal",
      icon: TrendingUp,
      iconColor: "text-chart-3 bg-chart-3/10",
    },
    {
      title: "Faturas do Período",
      value: data.faturasTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
      subtitle: (
        <div className="flex flex-wrap gap-1 mt-1">
          {data.faturasPago > 0 && <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Pago</Badge>}
          {data.faturasAguardando > 0 && <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">Aguardando</Badge>}
          {data.faturasAtraso > 0 && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Atraso</Badge>}
        </div>
      ),
      icon: FileText,
      iconColor: "text-chart-4 bg-chart-4/10",
    },
    {
      title: "Demandas",
      value: data.demandasTotal.toString(),
      subtitle: `${data.demandasConcluidas} concluídas • SLA: ${formatSLA(data.slaMedioSegundos)}`,
      icon: ClipboardList,
      iconColor: "text-chart-5 bg-chart-5/10",
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {kpi.title}
                    </p>
                    {kpi.tooltip && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{kpi.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-xl font-bold mt-1 truncate">{kpi.value}</p>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {typeof kpi.subtitle === "string" ? kpi.subtitle : kpi.subtitle}
                  </div>
                </div>
                <div className={`p-2 rounded-lg ${kpi.iconColor}`}>
                  <kpi.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
