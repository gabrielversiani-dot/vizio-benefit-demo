import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HistoricoEvent {
  id: string;
  demanda_id: string;
  empresa_id: string | null;
  tipo_evento: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  descricao: string | null;
  comentario: string | null;
  usuario_nome: string | null;
  criado_por: string;
  created_at: string;
  source?: string;
  meta?: {
    sla_seconds?: number;
    sla_human?: string;
    from_status?: string;
    to_status?: string;
    titulo?: string;
    tipo?: string;
    prioridade?: string;
    concluida_em?: string;
  } | null;
  demandas?: { 
    titulo: string;
    created_at: string;
    concluida_em: string | null;
  } | null;
}

interface UseDemandaHistoricoOptions {
  demandaId?: string;
  empresaId?: string;
  limit?: number;
  eventTypes?: string[];
}

export function useDemandaHistorico(options: UseDemandaHistoricoOptions) {
  const { demandaId, empresaId, limit = 200, eventTypes } = options;

  return useQuery({
    queryKey: ["demanda-historico", demandaId, empresaId, limit, eventTypes],
    queryFn: async () => {
      let query = supabase
        .from("demandas_historico")
        .select("*, demandas(titulo, created_at, concluida_em)")
        .order("created_at", { ascending: true });

      if (demandaId) {
        query = query.eq("demanda_id", demandaId);
      }

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      if (eventTypes && eventTypes.length > 0) {
        query = query.in("tipo_evento", eventTypes);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Cast the data to include the meta field which was added in migration
      return (data || []) as HistoricoEvent[];
    },
    enabled: !!(demandaId || empresaId),
  });
}

export function useDemandaHistoricoGeral(empresaId: string | undefined, limit = 200) {
  return useQuery({
    queryKey: ["demandas-historico-geral", empresaId, limit],
    queryFn: async () => {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("demandas_historico")
        .select("*, demandas(titulo, created_at, concluida_em)")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as HistoricoEvent[];
    },
    enabled: !!empresaId,
  });
}
