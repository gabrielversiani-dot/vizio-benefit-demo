-- Create unique constraint for RD Station tasks per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_demandas_rd_task_unique 
ON public.demandas (empresa_id, rd_task_id) 
WHERE rd_task_id IS NOT NULL;