-- Add vidas_ativas and media columns to sinistralidade table
ALTER TABLE public.sinistralidade 
ADD COLUMN IF NOT EXISTS vidas_ativas integer,
ADD COLUMN IF NOT EXISTS media numeric;

-- Add comment for clarity
COMMENT ON COLUMN public.sinistralidade.vidas_ativas IS 'Vidas ativas (contingente) - número de beneficiários ativos no período';
COMMENT ON COLUMN public.sinistralidade.media IS 'Média do período conforme relatório (última coluna do demonstrativo)';