/**
 * Feature Flags centralizadas do sistema
 * 
 * Use estas flags para controlar funcionalidades em desenvolvimento
 * ou que precisam ser habilitadas/desabilitadas gradualmente.
 */

export const FEATURE_FLAGS = {
  /**
   * Habilita a funcionalidade de IA para geração de alertas e recomendações
   * na aba de Sinistralidade.
   * 
   * Quando FALSE:
   * - Mostra UI "Em breve" com botão desabilitado
   * - Não chama Edge Function
   * - Não consome créditos de IA
   * 
   * Quando TRUE:
   * - Habilita botão "Gerar Recomendações com IA"
   * - Chama Edge Function ai-alertas-recomendacoes
   * - Salva recomendações na tabela ai_recomendacoes
   */
  AI_ALERTAS: false,

  /**
   * Habilita modo debug na UI (logs, indicadores extras)
   */
  DEBUG_MODE: import.meta.env.DEV,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Verifica se uma feature flag está habilitada
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] === true;
}
