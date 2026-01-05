import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Edge Function: ai-alertas-recomendacoes
 * 
 * STUB - Preparado para futura integração com IA.
 * 
 * Quando FEATURE_AI_ALERTAS estiver habilitado:
 * 1. Receber empresaId, periodoInicio, periodoFim
 * 2. Buscar dados de sinistralidade do período
 * 3. Chamar OpenAI para gerar insights/recomendações
 * 4. Salvar recomendações na tabela ai_recomendacoes
 * 5. Retornar as recomendações geradas
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { empresaId, periodoInicio, periodoFim } = await req.json();

    console.log("[ai-alertas-recomendacoes] Request received:", {
      empresaId,
      periodoInicio,
      periodoFim,
    });

    // STUB: Retornar 501 Not Implemented
    // TODO: Quando ativar a feature:
    // 1. Criar cliente Supabase com service role
    // 2. Buscar dados de sinistralidade do período
    // 3. Montar prompt com histórico de sinistros, tendências, alertas
    // 4. Chamar OpenAI GPT-4o-mini para análise
    // 5. Parsear resposta e salvar em ai_recomendacoes
    // 6. Retornar recomendações

    return new Response(
      JSON.stringify({
        code: "NOT_IMPLEMENTED",
        message: "Funcionalidade de IA em desenvolvimento. Em breve você poderá gerar recomendações inteligentes baseadas no histórico de sinistralidade.",
        empresaId,
        periodoInicio,
        periodoFim,
      }),
      {
        status: 501,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[ai-alertas-recomendacoes] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({
        code: "ERROR",
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
