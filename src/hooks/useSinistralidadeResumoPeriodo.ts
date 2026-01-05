import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PeriodoSource = "pdf_media" | "calculated";

export interface SinistralidadeResumoPeriodo {
  media_periodo: number | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  operadora: string | null;
  import_job_id: string | null;
  source: PeriodoSource;
  // Fallback calculated values
  calculated_media: number;
  calculated_premio: number;
  calculated_sinistros: number;
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
        .select("*")
        .eq("empresa_id", empresaId)
        .not("media_periodo", "is", null)
        .order("periodo_fim", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[useSinistralidadeResumoPeriodo] Error fetching indicador:", error);
        throw error;
      }

      return data;
    },
    enabled: !!empresaId,
  });

  // Fetch monthly data for fallback calculation
  const monthlyQuery = useQuery({
    queryKey: ["sinistralidade-monthly-fallback", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];

      const mesesAtras = new Date();
      mesesAtras.setMonth(mesesAtras.getMonth() - 12);

      const { data, error } = await supabase
        .from("sinistralidade")
        .select("valor_premio, valor_sinistros, indice_sinistralidade, competencia")
        .eq("empresa_id", empresaId)
        .gte("competencia", mesesAtras.toISOString().split("T")[0])
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
  const totalPremio = monthlyData.reduce((acc, s) => acc + Number(s.valor_premio || 0), 0);
  const totalSinistros = monthlyData.reduce((acc, s) => acc + Number(s.valor_sinistros || 0), 0);
  const calculatedMedia = totalPremio > 0 ? (totalSinistros / totalPremio) * 100 : 0;

  // Determine which source to use
  const indicador = indicadorQuery.data;
  const hasPdfMedia = indicador?.media_periodo != null;

  const resumo: SinistralidadeResumoPeriodo = {
    media_periodo: hasPdfMedia ? indicador.media_periodo : null,
    periodo_inicio: indicador?.periodo_inicio || null,
    periodo_fim: indicador?.periodo_fim || null,
    operadora: indicador?.operadora || null,
    import_job_id: indicador?.import_job_id || null,
    source: hasPdfMedia && usePdfMedia ? "pdf_media" : "calculated",
    calculated_media: calculatedMedia,
    calculated_premio: totalPremio,
    calculated_sinistros: totalSinistros,
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
