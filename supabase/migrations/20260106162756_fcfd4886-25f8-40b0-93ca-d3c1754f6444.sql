-- Create rd_empresa_integrations table for multi-tenant RD Station config
CREATE TABLE IF NOT EXISTS public.rd_empresa_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rd_organization_id text NOT NULL,
  rd_organization_name text,
  ativo boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT unique_empresa_rd_integration UNIQUE (empresa_id)
);

-- Index for fast lookups by organization
CREATE INDEX IF NOT EXISTS idx_rd_empresa_integrations_org 
ON public.rd_empresa_integrations (rd_organization_id);

-- Index for active integrations
CREATE INDEX IF NOT EXISTS idx_rd_empresa_integrations_ativo 
ON public.rd_empresa_integrations (empresa_id, ativo) WHERE ativo = true;

-- Trigger for updated_at
CREATE TRIGGER update_rd_empresa_integrations_updated_at
  BEFORE UPDATE ON public.rd_empresa_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.rd_empresa_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin Vizio can manage all rd_empresa_integrations"
  ON public.rd_empresa_integrations
  FOR ALL
  USING (has_role(auth.uid(), 'admin_vizio'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Empresa can manage their company rd_empresa_integrations"
  ON public.rd_empresa_integrations
  FOR ALL
  USING (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Users can view their company rd_empresa_integrations"
  ON public.rd_empresa_integrations
  FOR SELECT
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Migrate existing data from empresas table
INSERT INTO public.rd_empresa_integrations (empresa_id, rd_organization_id, rd_organization_name, ativo, last_sync_at)
SELECT id, rd_station_organization_id, rd_station_org_name_snapshot, rd_station_enabled, rd_station_last_sync
FROM public.empresas
WHERE rd_station_organization_id IS NOT NULL
ON CONFLICT (empresa_id) DO NOTHING;