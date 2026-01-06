-- Add RD Station integration fields to empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS rd_station_organization_id TEXT,
ADD COLUMN IF NOT EXISTS rd_station_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS rd_station_org_name_snapshot TEXT,
ADD COLUMN IF NOT EXISTS rd_station_last_sync TIMESTAMPTZ;