-- Fix RLS policies for sinistralidade_indicadores_periodo to restrict client DELETE/UPDATE
-- Drop existing policies and recreate with proper restrictions
DROP POLICY IF EXISTS "Users can delete their own company indicators" ON public.sinistralidade_indicadores_periodo;
DROP POLICY IF EXISTS "Users can update their own company indicators" ON public.sinistralidade_indicadores_periodo;

-- Admins only can delete indicators
CREATE POLICY "Admins can delete indicators"
ON public.sinistralidade_indicadores_periodo
FOR DELETE
USING (
  has_role(auth.uid(), 'admin_vizio'::app_role) OR 
  has_role(auth.uid(), 'admin_empresa'::app_role)
);

-- Admins only can update indicators
CREATE POLICY "Admins can update indicators"
ON public.sinistralidade_indicadores_periodo
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin_vizio'::app_role) OR 
  (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()))
);

-- Fix RLS policies for promocao_saude_materiais to restrict client CRUD
-- Clients can already only SELECT via existing policies, this is good

-- Add policy for clients to be able to download from storage (if bucket allows)
-- Storage policies are managed separately, but table RLS is already correct