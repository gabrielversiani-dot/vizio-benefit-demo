-- Add missing columns to demandas_historico
ALTER TABLE public.demandas_historico
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS tipo_evento TEXT,
ADD COLUMN IF NOT EXISTS descricao TEXT,
ADD COLUMN IF NOT EXISTS usuario_nome TEXT;

-- Update empresa_id from demandas for existing records
UPDATE public.demandas_historico dh
SET empresa_id = d.empresa_id
FROM public.demandas d
WHERE dh.demanda_id = d.id AND dh.empresa_id IS NULL;