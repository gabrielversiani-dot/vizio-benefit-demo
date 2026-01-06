-- Create sync log table
CREATE TABLE IF NOT EXISTS public.rd_station_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  tasks_imported INTEGER DEFAULT 0,
  tasks_updated INTEGER DEFAULT 0,
  tasks_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  request_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS on sync logs
ALTER TABLE public.rd_station_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync logs
CREATE POLICY "Admin Vizio can manage sync logs"
ON public.rd_station_sync_logs
FOR ALL
USING (public.has_role(auth.uid(), 'admin_vizio'));

CREATE POLICY "Users can view their company sync logs"
ON public.rd_station_sync_logs
FOR SELECT
USING (public.rd_station_sync_logs.empresa_id = public.get_user_empresa_id(auth.uid()));

-- Index for sync logs
CREATE INDEX IF NOT EXISTS idx_rd_sync_logs_empresa 
ON public.rd_station_sync_logs(empresa_id);

-- Index for demandas_historico
CREATE INDEX IF NOT EXISTS idx_demandas_historico_empresa 
ON public.demandas_historico(empresa_id);