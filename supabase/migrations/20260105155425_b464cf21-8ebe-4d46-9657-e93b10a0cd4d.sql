-- Add media_periodo as first-class column to sinistralidade_indicadores_periodo
ALTER TABLE public.sinistralidade_indicadores_periodo 
ADD COLUMN IF NOT EXISTS media_periodo numeric;