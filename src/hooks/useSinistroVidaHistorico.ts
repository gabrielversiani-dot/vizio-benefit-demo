import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SinistroTimelineEvent {
  id: string;
  sinistro_id: string;
  empresa_id: string;
  tipo_evento: string;
  descricao: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  meta: Record<string, unknown> | null;
  source: string | null;
  usuario_nome: string | null;
  criado_por: string;
  created_at: string;
  rd_event_id: string | null;
  event_hash: string | null;
  sinistros_vida?: {
    beneficiario_nome: string;
    tipo_sinistro: string;
    status: string;
    created_at: string;
    concluido_em: string | null;
  } | null;
}

export function useSinistroVidaHistorico(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ["sinistro-vida-historico", sinistroId],
    queryFn: async () => {
      if (!sinistroId) return [];

      const { data, error } = await supabase
        .from("sinistros_vida_timeline")
        .select("*")
        .eq("sinistro_id", sinistroId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as SinistroTimelineEvent[];
    },
    enabled: !!sinistroId,
  });
}

export function useSinistroVidaHistoricoGeral(empresaId: string | undefined, limit = 500) {
  return useQuery({
    queryKey: ["sinistros-vida-historico-geral", empresaId, limit],
    queryFn: async () => {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("sinistros_vida_timeline")
        .select(`
          *,
          sinistros_vida:sinistro_id (
            beneficiario_nome,
            tipo_sinistro,
            status,
            created_at,
            concluido_em
          )
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as SinistroTimelineEvent[];
    },
    enabled: !!empresaId,
  });
}
