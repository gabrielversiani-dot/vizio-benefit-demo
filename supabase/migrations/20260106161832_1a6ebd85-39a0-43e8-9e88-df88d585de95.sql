-- Add unique constraint on demandas for (empresa_id, rd_task_id) to prevent duplicates per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_demandas_empresa_rd_task 
ON public.demandas (empresa_id, rd_task_id) 
WHERE rd_task_id IS NOT NULL;

-- Add composite indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_demandas_empresa_filters 
ON public.demandas (empresa_id, status, tipo, source);

CREATE INDEX IF NOT EXISTS idx_demandas_historico_empresa_created 
ON public.demandas_historico (empresa_id, created_at DESC);

-- Add index for sync lookups
CREATE INDEX IF NOT EXISTS idx_rd_station_sync_logs_empresa 
ON public.rd_station_sync_logs (empresa_id, started_at DESC);