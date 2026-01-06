-- Table to store RD Station sinistro pipeline configuration per company
CREATE TABLE IF NOT EXISTS public.empresa_rd_sinistro_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  sinistro_pipeline_id TEXT NOT NULL,
  sinistro_pipeline_name TEXT,
  sinistro_stage_inicial_id TEXT NOT NULL,
  sinistro_stage_inicial_name TEXT,
  sinistro_stage_em_andamento_id TEXT,
  sinistro_stage_em_andamento_name TEXT,
  sinistro_stage_concluido_id TEXT,
  sinistro_stage_concluido_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id)
);

-- Enable RLS
ALTER TABLE public.empresa_rd_sinistro_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin Vizio can manage all configs"
ON public.empresa_rd_sinistro_config
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin_vizio'
  )
);

CREATE POLICY "Users can view their company config"
ON public.empresa_rd_sinistro_config
FOR SELECT
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_empresa_rd_sinistro_config_updated_at
BEFORE UPDATE ON public.empresa_rd_sinistro_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();