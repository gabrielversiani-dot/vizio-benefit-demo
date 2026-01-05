-- Add period average columns to sinistralidade_indicadores_periodo
ALTER TABLE public.sinistralidade_indicadores_periodo
ADD COLUMN IF NOT EXISTS premio_medio_periodo numeric,
ADD COLUMN IF NOT EXISTS sinistros_medio_periodo numeric,
ADD COLUMN IF NOT EXISTS vidas_ativas_media_periodo numeric;

COMMENT ON COLUMN public.sinistralidade_indicadores_periodo.premio_medio_periodo IS 'Receita Total Média do período (coluna Média do relatório Unimed BH)';
COMMENT ON COLUMN public.sinistralidade_indicadores_periodo.sinistros_medio_periodo IS 'Custo Assistencial Total Média do período (coluna Média do relatório Unimed BH)';
COMMENT ON COLUMN public.sinistralidade_indicadores_periodo.vidas_ativas_media_periodo IS 'Contingente Média do período (coluna Média do relatório Unimed BH)';