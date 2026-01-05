import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PeriodoSource = "pdf_media" | "calculated";

export interface SinistralidadeResumoPeriodo {
  indicador_id: string | null;
  media_periodo: number | null;
  premio_medio_periodo: number | null;
  sinistros_medio_periodo: number | null;
  vidas_ativas_media_periodo: number | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  operadora: string | null;
  import_job_id: string | null;
  source: PeriodoSource;
  // Fallback calculated values
  calculated_media: number;
  calculated_premio: number;
  calculated_sinistros: number;
  calculated_vidas: number;
}

export function useSinistralidadeResumoPeriodo(
  empresaId: string | null,
  usePdfMedia: boolean = true
) {
  // Fetch the latest indicador de período with media_periodo
  const indicadorQuery = useQuery({
    queryKey: ["sinistralidade-resumo-periodo", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;

      const { data, error } = await supabase
        .from("sinistralidade_indicadores_periodo")
        .select(
          "id, empresa_id, created_at, periodo_inicio, periodo_fim, operadora, media_periodo, premio_medio_periodo, sinistros_medio_periodo, vidas_ativas_media_periodo, metricas, import_job_id"
        )
        .eq("empresa_id", empresaId)
        .not("media_periodo", "is", null)
        .order("periodo_fim", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[useSinistralidadeResumoPeriodo] Error fetching indicador:", error);
        throw error;
      }

      if (import.meta.env.DEV) {
        console.log("[useSinistralidadeResumoPeriodo] indicador:", data);
      }

      return data;
    },
    enabled: !!empresaId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch monthly data for fallback calculation
  const monthlyQuery = useQuery({
    queryKey: ["sinistralidade-monthly-fallback", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];

      const mesesAtras = new Date();
      mesesAtras.setMonth(mesesAtras.getMonth() - 12);
      // Formato YYYY-MM-01 para comparar com coluna competencia (tipo DATE)
      const competenciaMinima = `${mesesAtras.getFullYear()}-${String(mesesAtras.getMonth() + 1).padStart(2, '0')}-01`;

      const { data, error } = await supabase
        .from("sinistralidade")
        .select("valor_premio, valor_sinistros, indice_sinistralidade, competencia, vidas_ativas")
        .eq("empresa_id", empresaId)
        .gte("competencia", competenciaMinima)
        .order("competencia", { ascending: true });

      if (error) {
        console.error("[useSinistralidadeResumoPeriodo] Error fetching monthly:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!empresaId,
  });

  // Calculate fallback values from monthly data
  const monthlyData = monthlyQuery.data || [];
  const totalPremio = monthlyData.reduce((acc, s) => acc + Number((s as any).valor_premio || 0), 0);
  const totalSinistros = monthlyData.reduce((acc, s) => acc + Number((s as any).valor_sinistros || 0), 0);
  const calculatedMedia = totalPremio > 0 ? (totalSinistros / totalPremio) * 100 : 0;
  const avgPremio = monthlyData.length > 0 ? totalPremio / monthlyData.length : 0;
  const avgSinistros = monthlyData.length > 0 ? totalSinistros / monthlyData.length : 0;

  const vidasVals = monthlyData
    .map((s) => (s as any).vidas_ativas)
    .filter((v) => v != null)
    .map((v) => Number(v));
  const avgVidasAtivas = vidasVals.length > 0 ? vidasVals.reduce((acc, v) => acc + v, 0) / vidasVals.length : 0;

  // Determine which source to use
  const indicador = indicadorQuery.data as {
    id?: string;
    created_at?: string;
    media_periodo?: number | null;
    premio_medio_periodo?: number | null;
    sinistros_medio_periodo?: number | null;
    vidas_ativas_media_periodo?: number | null;
    metricas?: unknown | null;
    periodo_inicio?: string | null;
    periodo_fim?: string | null;
    operadora?: string | null;
    import_job_id?: string | null;
  } | null;
  const hasPdfMedia = indicador?.media_periodo != null;

  const vidasAtivasMedia =
    indicador?.vidas_ativas_media_periodo ??
    (typeof indicador?.metricas === "object" && indicador?.metricas != null
      ? (indicador.metricas as any)?.vidas_ativas_media_periodo ?? null
      : null);

  const resumo: SinistralidadeResumoPeriodo = {
    indicador_id: indicador?.id ?? null,
    media_periodo: indicador?.media_periodo ?? null,
    premio_medio_periodo: indicador?.premio_medio_periodo ?? null,
    sinistros_medio_periodo: indicador?.sinistros_medio_periodo ?? null,
    vidas_ativas_media_periodo: vidasAtivasMedia,
    periodo_inicio: indicador?.periodo_inicio || null,
    periodo_fim: indicador?.periodo_fim || null,
    operadora: indicador?.operadora || null,
    import_job_id: indicador?.import_job_id || null,
    source: hasPdfMedia && usePdfMedia ? "pdf_media" : "calculated",
    calculated_media: calculatedMedia,
    calculated_premio: avgPremio,
    calculated_sinistros: avgSinistros,
    calculated_vidas: avgVidasAtivas,
  };

  // Final media value to use
  const mediaFinal = 
    usePdfMedia && hasPdfMedia 
      ? indicador.media_periodo! 
      : calculatedMedia;

  return {
    resumo,
    mediaFinal,
    hasPdfMedia,
    isLoading: indicadorQuery.isLoading || monthlyQuery.isLoading,
    isError: indicadorQuery.isError || monthlyQuery.isError,
  };
}
