-- 1) Create table for sinistro documents
CREATE TABLE public.sinistro_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistros_vida(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome_arquivo text NOT NULL,
  tipo_mime text NOT NULL,
  tamanho integer NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2) Enable RLS
ALTER TABLE public.sinistro_documentos ENABLE ROW LEVEL SECURITY;

-- 3) RLS Policies
CREATE POLICY "Admin Vizio can manage all sinistro_documentos"
ON public.sinistro_documentos
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Empresa can manage their company sinistro_documentos"
ON public.sinistro_documentos
FOR ALL
USING (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Users can view their company sinistro_documentos"
ON public.sinistro_documentos
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- 4) Create storage bucket for sinistros
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sinistros',
  'sinistros',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- 5) Storage policies
CREATE POLICY "Admin Vizio can manage all sinistros files"
ON storage.objects
FOR ALL
USING (bucket_id = 'sinistros' AND has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (bucket_id = 'sinistros' AND has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Empresa can manage their company sinistros files"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'sinistros' 
  AND has_role(auth.uid(), 'admin_empresa'::app_role)
  AND (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'sinistros' 
  AND has_role(auth.uid(), 'admin_empresa'::app_role)
  AND (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
);

CREATE POLICY "Users can view their company sinistros files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'sinistros' 
  AND (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
);