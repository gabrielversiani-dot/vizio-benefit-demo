-- ============================================
-- CONTRATOS MODULE EVOLUTION
-- Adds: produto, filial_id, operadora, reajuste fields, contrato_documentos table
-- ============================================

-- 1) Add new columns to contratos table
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS produto text NULL,
  ADD COLUMN IF NOT EXISTS filial_id uuid NULL,
  ADD COLUMN IF NOT EXISTS operadora text NULL,
  ADD COLUMN IF NOT EXISTS competencia_referencia date NULL,
  ADD COLUMN IF NOT EXISTS reajuste_percentual numeric NULL;

-- 2) Add foreign key constraint for filial_id to faturamento_entidades
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_filial_id_fkey 
  FOREIGN KEY (filial_id) 
  REFERENCES public.faturamento_entidades(id) 
  ON DELETE SET NULL;

-- 3) Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contratos_empresa_produto ON public.contratos(empresa_id, produto);
CREATE INDEX IF NOT EXISTS idx_contratos_empresa_filial ON public.contratos(empresa_id, filial_id);

-- 4) Create contrato_documentos table
CREATE TABLE IF NOT EXISTS public.contrato_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL DEFAULT 'outros',
  arquivo_nome text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'contratos',
  storage_path text NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  uploaded_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5) Add indexes for contrato_documentos
CREATE INDEX IF NOT EXISTS idx_contrato_docs_empresa_contrato ON public.contrato_documentos(empresa_id, contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_docs_contrato_versao ON public.contrato_documentos(contrato_id, versao);
CREATE INDEX IF NOT EXISTS idx_contrato_docs_empresa_created ON public.contrato_documentos(empresa_id, created_at DESC);

-- 6) Enable RLS on contrato_documentos
ALTER TABLE public.contrato_documentos ENABLE ROW LEVEL SECURITY;

-- 7) RLS Policies for contrato_documentos
-- Admin Vizio can manage all
CREATE POLICY "Admin Vizio can manage all contrato_documentos"
ON public.contrato_documentos
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

-- Admin Empresa can manage their company's documents
CREATE POLICY "Admin Empresa can manage their company contrato_documentos"
ON public.contrato_documentos
FOR ALL
USING (
  has_role(auth.uid(), 'admin_empresa'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin_empresa'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

-- RH Gestor can view and upload (SELECT + INSERT)
CREATE POLICY "RH Gestor can view their company contrato_documentos"
ON public.contrato_documentos
FOR SELECT
USING (
  has_role(auth.uid(), 'rh_gestor'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

CREATE POLICY "RH Gestor can upload contrato_documentos"
ON public.contrato_documentos
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'rh_gestor'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

-- Visualizador can only view
CREATE POLICY "Visualizador can view their company contrato_documentos"
ON public.contrato_documentos
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- 8) Update storage policies for contratos bucket to allow more roles
-- First drop existing policies (they're too restrictive)
DROP POLICY IF EXISTS "Admin Vizio can delete contratos" ON storage.objects;
DROP POLICY IF EXISTS "Admin Vizio can update contratos" ON storage.objects;
DROP POLICY IF EXISTS "Admin Vizio can upload contratos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view contratos files based on role" ON storage.objects;

-- Create new storage policies
-- SELECT: Users can view their company's files
CREATE POLICY "Users can view contratos files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'contratos' 
  AND (
    has_role(auth.uid(), 'admin_vizio'::app_role)
    OR (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
  )
);

-- INSERT: Admins and RH Gestor can upload
CREATE POLICY "Admins and RH can upload contratos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'contratos'
  AND (
    has_role(auth.uid(), 'admin_vizio'::app_role)
    OR has_role(auth.uid(), 'admin_empresa'::app_role)
    OR has_role(auth.uid(), 'rh_gestor'::app_role)
  )
  AND (
    has_role(auth.uid(), 'admin_vizio'::app_role)
    OR (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
  )
);

-- UPDATE: Admins can update
CREATE POLICY "Admins can update contratos files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'contratos'
  AND (
    has_role(auth.uid(), 'admin_vizio'::app_role)
    OR (
      has_role(auth.uid(), 'admin_empresa'::app_role)
      AND (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
    )
  )
);

-- DELETE: Only admins can delete
CREATE POLICY "Admins can delete contratos files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'contratos'
  AND (
    has_role(auth.uid(), 'admin_vizio'::app_role)
    OR (
      has_role(auth.uid(), 'admin_empresa'::app_role)
      AND (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
    )
  )
);