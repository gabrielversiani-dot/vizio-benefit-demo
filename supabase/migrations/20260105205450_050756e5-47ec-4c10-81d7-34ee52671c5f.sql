
-- Corrigir RLS de contratos: Adicionar policies para admin_empresa e rh_gestor fazerem INSERT/UPDATE/DELETE
-- Também corrigir a tabela contrato_documentos

-- =====================
-- CONTRATOS TABLE
-- =====================

-- Adicionar INSERT para admin_empresa
CREATE POLICY "Admin Empresa can insert contratos"
ON public.contratos FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin_empresa'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

-- Adicionar UPDATE para admin_empresa
CREATE POLICY "Admin Empresa can update their company contratos"
ON public.contratos FOR UPDATE
USING (
  has_role(auth.uid(), 'admin_empresa'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

-- Adicionar DELETE para admin_empresa
CREATE POLICY "Admin Empresa can delete their company contratos"
ON public.contratos FOR DELETE
USING (
  has_role(auth.uid(), 'admin_empresa'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

-- Adicionar INSERT para rh_gestor
CREATE POLICY "RH Gestor can insert contratos"
ON public.contratos FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'rh_gestor'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

-- Adicionar UPDATE para rh_gestor
CREATE POLICY "RH Gestor can update their company contratos"
ON public.contratos FOR UPDATE
USING (
  has_role(auth.uid(), 'rh_gestor'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

-- Adicionar SELECT para rh_gestor (caso não exista específico)
CREATE POLICY "RH Gestor can view their company contratos"
ON public.contratos FOR SELECT
USING (
  has_role(auth.uid(), 'rh_gestor'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

-- =====================
-- CONTRATO_DOCUMENTOS TABLE
-- =====================

-- Remover policy de INSERT sem check
DROP POLICY IF EXISTS "RH Gestor can upload contrato_documentos" ON public.contrato_documentos;

-- Recriar com WITH CHECK correto
CREATE POLICY "RH Gestor can insert contrato_documentos"
ON public.contrato_documentos FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'rh_gestor'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);
