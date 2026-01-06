-- Drop the old table (1:1 relationship)
DROP TABLE IF EXISTS public.rd_empresa_integrations;

-- Create new table for N:N relationship (empresa → multiple RD orgs)
CREATE TABLE IF NOT EXISTS public.empresa_rd_organizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rd_organization_id text NOT NULL,
  rd_organization_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT unique_empresa_rd_org UNIQUE (empresa_id, rd_organization_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_empresa_rd_orgs_empresa 
ON public.empresa_rd_organizacoes (empresa_id, active);

CREATE INDEX IF NOT EXISTS idx_empresa_rd_orgs_rd_org 
ON public.empresa_rd_organizacoes (rd_organization_id);

-- Trigger for updated_at
CREATE TRIGGER update_empresa_rd_organizacoes_updated_at
  BEFORE UPDATE ON public.empresa_rd_organizacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.empresa_rd_organizacoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin Vizio can manage all empresa_rd_organizacoes"
  ON public.empresa_rd_organizacoes
  FOR ALL
  USING (has_role(auth.uid(), 'admin_vizio'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Empresa can manage their company empresa_rd_organizacoes"
  ON public.empresa_rd_organizacoes
  FOR ALL
  USING (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Users can view their company empresa_rd_organizacoes"
  ON public.empresa_rd_organizacoes
  FOR SELECT
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Migrate existing data from empresas table
INSERT INTO public.empresa_rd_organizacoes (empresa_id, rd_organization_id, rd_organization_name, active)
SELECT id, rd_station_organization_id, rd_station_org_name_snapshot, rd_station_enabled
FROM public.empresas
WHERE rd_station_organization_id IS NOT NULL
ON CONFLICT (empresa_id, rd_organization_id) DO NOTHING;

-- Add rd_organization_id to demandas for tracking source org
ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS rd_organization_id text;