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
   * - Mostra UI "Em breve" com botão desabilitado (para admins)
   * - Para clientes: oculta totalmente a seção
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
   * Apenas para admin_vizio - clientes nunca veem
   */
  DEBUG_MODE: import.meta.env.DEV,
  
  /**
   * Funcionalidades "Em breve" - oculta completamente para clientes
   */
  SHOW_COMING_SOON: true, // Admins veem "Em breve", clientes não veem nada
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Verifica se uma feature flag está habilitada
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] === true;
}

/**
 * Verifica se deve mostrar seção "Em breve" para o usuário
 * Para clientes (não-admin): sempre retorna false
 * Para admins: retorna o valor da flag SHOW_COMING_SOON
 */
export function shouldShowComingSoon(isAdmin: boolean): boolean {
  if (!isAdmin) return false;
  return FEATURE_FLAGS.SHOW_COMING_SOON === true;
}
