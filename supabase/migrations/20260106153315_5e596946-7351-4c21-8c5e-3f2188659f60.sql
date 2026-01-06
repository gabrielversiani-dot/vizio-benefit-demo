-- Add RD Station sync fields to demandas
ALTER TABLE public.demandas
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS rd_task_id TEXT,
ADD COLUMN IF NOT EXISTS rd_deal_id TEXT,
ADD COLUMN IF NOT EXISTS rd_deal_name TEXT,
ADD COLUMN IF NOT EXISTS responsavel_nome TEXT,
ADD COLUMN IF NOT EXISTS raw_payload JSONB;