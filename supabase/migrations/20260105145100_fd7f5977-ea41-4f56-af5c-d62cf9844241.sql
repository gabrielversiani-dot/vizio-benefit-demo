-- 1) Create table for sinistralidade documents
CREATE TABLE public.sinistralidade_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  operadora text NOT NULL DEFAULT 'Unimed BH',
  tipo_relatorio text, -- demonstrativo_resultado, custo_assistencial, consultas, internacoes
  periodo_inicio date,
  periodo_fim date,
  competencias text[], -- array of YYYY-MM for multi-competence docs
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  status text NOT NULL DEFAULT 'uploaded', -- uploaded, analyzing, analyzed, applied, failed
  import_job_id uuid REFERENCES public.import_jobs(id),
  ai_summary text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2) Enable RLS
ALTER TABLE public.sinistralidade_documentos ENABLE ROW LEVEL SECURITY;

-- 3) RLS Policies
CREATE POLICY "Admin Vizio can manage all sinistralidade_documentos"
ON public.sinistralidade_documentos
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Empresa can manage their company sinistralidade_documentos"
ON public.sinistralidade_documentos
FOR ALL
USING (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Users can view their company sinistralidade_documentos"
ON public.sinistralidade_documentos
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- 4) Create updated_at trigger
CREATE TRIGGER update_sinistralidade_documentos_updated_at
  BEFORE UPDATE ON public.sinistralidade_documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Create storage bucket for sinistralidade PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sinistralidade_pdfs',
  'sinistralidade_pdfs',
  false,
  20971520, -- 20MB
  ARRAY['application/pdf']
);

-- 6) Storage policies
CREATE POLICY "Admin Vizio can manage all sinistralidade_pdfs"
ON storage.objects
FOR ALL
USING (bucket_id = 'sinistralidade_pdfs' AND has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (bucket_id = 'sinistralidade_pdfs' AND has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Empresa can manage their company sinistralidade_pdfs"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'sinistralidade_pdfs' 
  AND has_role(auth.uid(), 'admin_empresa'::app_role)
  AND (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'sinistralidade_pdfs' 
  AND has_role(auth.uid(), 'admin_empresa'::app_role)
  AND (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
);

CREATE POLICY "Users can view their company sinistralidade_pdfs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'sinistralidade_pdfs' 
  AND (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
);