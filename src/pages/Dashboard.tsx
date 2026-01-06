import { useState } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { DashboardFilters } from "@/components/Dashboard/DashboardFilters";
import { KPICards } from "@/components/Dashboard/KPICards";
import { DashboardCharts } from "@/components/Dashboard/DashboardCharts";
import { PendenciasList } from "@/components/Dashboard/PendenciasList";
import { QuickActions } from "@/components/Dashboard/QuickActions";
import { ActivityFeed } from "@/components/Dashboard/ActivityFeed";
import { ComingSoonCard } from "@/components/Dashboard/ComingSoonCard";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useDashboardKPIs,
  useDashboardCharts,
  useDashboardPendencias,
  useDashboardFeed,
  PeriodFilter,
  ProductFilter,
} from "@/hooks/useDashboardData";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Sparkles } from "lucide-react";

export default function Dashboard() {
  const { empresaSelecionada } = useEmpresa();
  const { isAdmin, isClient } = usePermissions();
  
  const [period, setPeriod] = useState<PeriodFilter>("12");
  const [product, setProduct] = useState<ProductFilter>("todos");

  const filters = { period, product };

  const { data: kpiData, isLoading: loadingKPIs } = useDashboardKPIs(filters);
  const { data: chartData, isLoading: loadingCharts } = useDashboardCharts(filters);
  const { data: pendenciasData, isLoading: loadingPendencias } = useDashboardPendencias();
  const { data: feedData, isLoading: loadingFeed } = useDashboardFeed();

  if (!empresaSelecionada) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">Selecione uma empresa para visualizar o dashboard</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Visão geral da gestão de benefícios
            </p>
          </div>
          <DashboardFilters
            period={period}
            product={product}
            onPeriodChange={setPeriod}
            onProductChange={setProduct}
          />
        </div>

        {/* KPI Cards */}
        <KPICards data={kpiData} isLoading={loadingKPIs} />

        {/* Charts */}
        <DashboardCharts data={chartData} isLoading={loadingCharts} />

        {/* Bottom Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Pendências + Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <PendenciasList data={pendenciasData} isLoading={loadingPendencias} />
            
            {isAdmin && <QuickActions />}

            {/* AI Recommendations placeholder */}
            <Card className="border-dashed">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">Recomendações com IA</h3>
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      <Sparkles className="h-2.5 w-2.5" />
                      Em breve
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Estamos preparando insights personalizados para sua empresa 🚀
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Feed */}
          <div className="space-y-6">
            <ActivityFeed data={feedData} isLoading={loadingFeed} />
            
            {isClient && (
              <ComingSoonCard 
                title="Gestão Avançada de Demandas" 
                description="Acompanhamento detalhado e SLA em tempo real"
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
