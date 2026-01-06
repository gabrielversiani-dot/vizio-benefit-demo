import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { subMonths, format, startOfMonth, endOfMonth, differenceInSeconds } from "date-fns";

export type PeriodFilter = "3" | "6" | "12" | "custom";
export type ProductFilter = "saude" | "odonto" | "vida" | "todos";

interface DashboardFilters {
  period: PeriodFilter;
  product: ProductFilter;
  customStart?: Date;
  customEnd?: Date;
}

function getDateRange(filters: DashboardFilters) {
  const now = new Date();
  const end = endOfMonth(now);
  let start: Date;

  if (filters.period === "custom" && filters.customStart) {
    start = startOfMonth(filters.customStart);
  } else {
    const months = parseInt(filters.period) || 12;
    start = startOfMonth(subMonths(now, months - 1));
  }

  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
    monthsCount: parseInt(filters.period) || 12,
  };
}

// Generate all months in range for 12-month chart
function generateMonthsRange(startDate: string, count: number = 12) {
  const months: string[] = [];
  const start = new Date(startDate);
  
  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setMonth(date.getMonth() + i);
    months.push(format(date, "yyyy-MM-dd"));
  }
  
  return months;
}

export function useDashboardKPIs(filters: DashboardFilters) {
  const { empresaSelecionada } = useEmpresa();
  const { startDate, endDate } = getDateRange(filters);

  return useQuery({
    queryKey: ["dashboard-kpis", empresaSelecionada, startDate, endDate, filters.product],
    queryFn: async () => {
      if (!empresaSelecionada) return null;

      // 1. Vidas ativas (beneficiários)
      let benefQuery = supabase
        .from("beneficiarios")
        .select("id, tipo, plano_saude, plano_vida, plano_odonto")
        .eq("empresa_id", empresaSelecionada)
        .eq("status", "ativo");

      const { data: beneficiarios = [] } = await benefQuery;

      const vidasAtivas = beneficiarios.length;
      const titulares = beneficiarios.filter((b) => b.tipo === "titular").length;
      const dependentes = beneficiarios.filter((b) => b.tipo === "dependente").length;

      // 2. Sinistralidade - buscar média do período (PDF importado) primeiro
      const { data: periodoData } = await supabase
        .from("sinistralidade_indicadores_periodo")
        .select("*")
        .eq("empresa_id", empresaSelecionada)
        .gte("periodo_inicio", startDate)
        .lte("periodo_fim", endDate)
        .order("created_at", { ascending: false })
        .limit(1);

      const periodoInfo = periodoData?.[0];
      const hasPDFData = !!periodoInfo;

      // 3. Sinistralidade mensal para cálculo fallback
      let sinistQuery = supabase
        .from("sinistralidade")
        .select("*")
        .eq("empresa_id", empresaSelecionada)
        .gte("competencia", startDate)
        .lte("competencia", endDate);

      if (filters.product !== "todos") {
        sinistQuery = sinistQuery.eq("categoria", filters.product);
      }

      const { data: sinistralidade = [] } = await sinistQuery;

      // Calcular médias
      let indiceMedio = 0;
      let premioMedio = 0;
      let sinistrosMedio = 0;
      let vidasAtivasMedia = vidasAtivas;
      let fonte = "Calculado";

      if (hasPDFData && periodoInfo) {
        // Usar dados do PDF importado
        indiceMedio = periodoInfo.media_periodo || 0;
        premioMedio = periodoInfo.premio_medio_periodo || 0;
        sinistrosMedio = periodoInfo.sinistros_medio_periodo || 0;
        vidasAtivasMedia = periodoInfo.vidas_ativas_media_periodo || vidasAtivas;
        fonte = `Relatório ${periodoInfo.operadora || "Unimed BH"}`;
      } else if (sinistralidade.length > 0) {
        // Calcular a partir dos dados mensais
        const totalPremio = sinistralidade.reduce((acc, s) => acc + (s.valor_premio || 0), 0);
        const totalSinistros = sinistralidade.reduce((acc, s) => acc + (s.valor_sinistros || 0), 0);
        const mesesComDados = sinistralidade.length;

        premioMedio = mesesComDados > 0 ? totalPremio / mesesComDados : 0;
        sinistrosMedio = mesesComDados > 0 ? totalSinistros / mesesComDados : 0;
        indiceMedio = totalPremio > 0 ? (totalSinistros / totalPremio) * 100 : 0;
      }

      // 4. Faturamento do período
      let faturaQuery = supabase
        .from("faturamentos")
        .select("*")
        .eq("empresa_id", empresaSelecionada)
        .gte("competencia", startDate)
        .lte("competencia", endDate);

      if (filters.product !== "todos") {
        faturaQuery = faturaQuery.eq("produto", filters.product);
      }

      const { data: faturas = [] } = await faturaQuery;

      const faturasTotal = faturas.reduce((acc, f) => acc + (f.valor_total || 0), 0);
      const faturasPago = faturas.filter((f) => f.status === "pago").reduce((acc, f) => acc + (f.valor_total || 0), 0);
      const faturasAguardando = faturas.filter((f) => f.status === "aguardando_pagamento").reduce((acc, f) => acc + (f.valor_total || 0), 0);
      const faturasAtraso = faturas.filter((f) => f.status === "atraso").reduce((acc, f) => acc + (f.valor_total || 0), 0);

      // 5. Demandas
      const { data: demandas = [] } = await supabase
        .from("demandas")
        .select("id, status, created_at, concluida_em")
        .eq("empresa_id", empresaSelecionada)
        .gte("created_at", startDate);

      const demandasTotal = demandas.length;
      const demandasConcluidas = demandas.filter((d) => d.status === "concluido");
      
      // Calcular SLA médio
      let slaMedioSegundos = 0;
      if (demandasConcluidas.length > 0) {
        const totalSegundos = demandasConcluidas.reduce((acc, d) => {
          if (d.concluida_em && d.created_at) {
            return acc + differenceInSeconds(new Date(d.concluida_em), new Date(d.created_at));
          }
          return acc;
        }, 0);
        slaMedioSegundos = totalSegundos / demandasConcluidas.length;
      }

      return {
        vidasAtivas,
        titulares,
        dependentes,
        indiceMedio,
        premioMedio,
        sinistrosMedio,
        vidasAtivasMedia,
        fonteSinistralidade: fonte,
        hasPDFData,
        faturasTotal,
        faturasPago,
        faturasAguardando,
        faturasAtraso,
        faturasCount: faturas.length,
        demandasTotal,
        demandasConcluidas: demandasConcluidas.length,
        demandasPendentes: demandas.filter((d) => d.status === "pendente").length,
        demandasEmAndamento: demandas.filter((d) => ["em_andamento", "aguardando_documentacao"].includes(d.status)).length,
        slaMedioSegundos,
      };
    },
    enabled: !!empresaSelecionada,
  });
}

export function useDashboardCharts(filters: DashboardFilters) {
  const { empresaSelecionada } = useEmpresa();
  const { startDate, monthsCount } = getDateRange(filters);

  return useQuery({
    queryKey: ["dashboard-charts", empresaSelecionada, startDate, monthsCount, filters.product],
    queryFn: async () => {
      if (!empresaSelecionada) return null;

      const allMonths = generateMonthsRange(startDate, monthsCount);
      const endDate = allMonths[allMonths.length - 1];

      // Sinistralidade
      let sinistQuery = supabase
        .from("sinistralidade")
        .select("*")
        .eq("empresa_id", empresaSelecionada)
        .gte("competencia", startDate)
        .lte("competencia", endDate)
        .order("competencia");

      if (filters.product !== "todos") {
        sinistQuery = sinistQuery.eq("categoria", filters.product);
      }

      const { data: sinistralidade = [] } = await sinistQuery;

      // Mapear para todos os 12 meses
      const sinistralityChartData = allMonths.map((month) => {
        const monthData = sinistralidade.find((s) => {
          const compDate = s.competencia?.substring(0, 7);
          const targetDate = month.substring(0, 7);
          return compDate === targetDate;
        });

        const premio = monthData?.valor_premio || null;
        const sinistros = monthData?.valor_sinistros || null;
        const iuInformado = monthData?.indice_sinistralidade;
        const iuCalculado = premio && sinistros && premio > 0 ? (sinistros / premio) * 100 : null;

        return {
          month: new Date(month).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          competencia: month,
          premio,
          sinistros,
          iu: iuInformado ?? iuCalculado,
          iuFonte: iuInformado ? "PDF" : "Calculado",
        };
      });

      // Faturamento por status
      let faturaQuery = supabase
        .from("faturamentos")
        .select("status, valor_total")
        .eq("empresa_id", empresaSelecionada)
        .gte("competencia", startDate)
        .lte("competencia", endDate);

      if (filters.product !== "todos") {
        faturaQuery = faturaQuery.eq("produto", filters.product);
      }

      const { data: faturas = [] } = await faturaQuery;

      const faturamentoByStatus = [
        { status: "Pago", valor: faturas.filter((f) => f.status === "pago").reduce((a, f) => a + (f.valor_total || 0), 0), color: "hsl(var(--success))" },
        { status: "Aguardando", valor: faturas.filter((f) => f.status === "aguardando_pagamento").reduce((a, f) => a + (f.valor_total || 0), 0), color: "hsl(var(--warning))" },
        { status: "Em Atraso", valor: faturas.filter((f) => f.status === "atraso").reduce((a, f) => a + (f.valor_total || 0), 0), color: "hsl(var(--destructive))" },
      ].filter((d) => d.valor > 0);

      // Demandas por status
      const { data: demandas = [] } = await supabase
        .from("demandas")
        .select("status")
        .eq("empresa_id", empresaSelecionada)
        .gte("created_at", startDate);

      const demandasByStatus = [
        { status: "Pendente", count: demandas.filter((d) => d.status === "pendente").length, color: "hsl(var(--muted-foreground))" },
        { status: "Em Andamento", count: demandas.filter((d) => ["em_andamento", "aguardando_documentacao"].includes(d.status)).length, color: "hsl(var(--chart-2))" },
        { status: "Concluído", count: demandas.filter((d) => d.status === "concluido").length, color: "hsl(var(--success))" },
      ].filter((d) => d.count > 0);

      return {
        sinistralityChartData,
        faturamentoByStatus,
        demandasByStatus,
      };
    },
    enabled: !!empresaSelecionada,
  });
}

export function useDashboardPendencias() {
  const { empresaSelecionada } = useEmpresa();
  const today = format(new Date(), "yyyy-MM-dd");
  const in30Days = format(subMonths(new Date(), -1), "yyyy-MM-dd");
  const in60Days = format(subMonths(new Date(), -2), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["dashboard-pendencias", empresaSelecionada, today],
    queryFn: async () => {
      if (!empresaSelecionada) return null;

      // 1. Faturas vencidas (em atraso)
      const { data: faturasVencidas = [] } = await supabase
        .from("faturamentos")
        .select("id, competencia, valor_total, vencimento, produto")
        .eq("empresa_id", empresaSelecionada)
        .eq("status", "atraso")
        .order("vencimento")
        .limit(5);

      // 2. Contratos próximos do vencimento
      const { data: contratosVencendo = [] } = await supabase
        .from("contratos")
        .select("id, titulo, data_fim, operadora, status")
        .eq("empresa_id", empresaSelecionada)
        .in("status", ["ativo", "em_renovacao"])
        .gte("data_fim", today)
        .lte("data_fim", in60Days)
        .order("data_fim")
        .limit(5);

      // 3. Demandas pendentes sem atualização
      const { data: demandasPendentes = [] } = await supabase
        .from("demandas")
        .select("id, titulo, status, updated_at, prioridade")
        .eq("empresa_id", empresaSelecionada)
        .in("status", ["pendente", "em_andamento", "aguardando_documentacao"])
        .order("updated_at")
        .limit(5);

      // 4. Import jobs com erro
      const { data: importJobs = [] } = await supabase
        .from("import_jobs")
        .select("id, arquivo_nome, status, data_type, created_at")
        .eq("empresa_id", empresaSelecionada)
        .in("status", ["failed", "ready_for_review"])
        .order("created_at", { ascending: false })
        .limit(5);

      // 5. Sinistralidade alta (último mês > 85%)
      const { data: sinistAltaData = [] } = await supabase
        .from("sinistralidade")
        .select("id, competencia, indice_sinistralidade, categoria")
        .eq("empresa_id", empresaSelecionada)
        .gt("indice_sinistralidade", 85)
        .order("competencia", { ascending: false })
        .limit(3);

      return {
        faturasVencidas,
        contratosVencendo,
        demandasPendentes,
        importJobs,
        sinistralidade85: sinistAltaData,
      };
    },
    enabled: !!empresaSelecionada,
  });
}

export function useDashboardFeed() {
  const { empresaSelecionada } = useEmpresa();

  return useQuery({
    queryKey: ["dashboard-feed", empresaSelecionada],
    queryFn: async () => {
      if (!empresaSelecionada) return [];

      // Últimos eventos de demandas_historico
      const { data: historico = [] } = await supabase
        .from("demandas_historico")
        .select("id, tipo_evento, descricao, created_at, usuario_nome, demanda_id, meta")
        .eq("empresa_id", empresaSelecionada)
        .order("created_at", { ascending: false })
        .limit(10);

      // Formattar como feed
      return historico.map((h) => ({
        id: h.id,
        type: h.tipo_evento || "update",
        description: h.descricao || "Atualização",
        timestamp: h.created_at,
        user: h.usuario_nome || "Sistema",
        entityId: h.demanda_id,
        meta: h.meta,
      }));
    },
    enabled: !!empresaSelecionada,
  });
}

// Helper para formatar SLA
export function formatSLA(segundos: number): string {
  if (segundos <= 0) return "—";
  
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);

  if (dias > 0) {
    return `${dias}d ${horas}h`;
  } else if (horas > 0) {
    return `${horas}h ${minutos}m`;
  } else {
    return `${minutos}m`;
  }
}
