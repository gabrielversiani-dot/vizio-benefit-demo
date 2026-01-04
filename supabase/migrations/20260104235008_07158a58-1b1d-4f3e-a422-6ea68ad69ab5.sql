-- Criar enum para status de import job
CREATE TYPE public.import_job_status AS ENUM ('pending', 'processing', 'ready_for_review', 'approved', 'rejected', 'completed', 'failed');

-- Criar enum para status de linha
CREATE TYPE public.import_row_status AS ENUM ('valid', 'warning', 'error', 'duplicate', 'updated');

-- Criar enum para tipo de dados importados
CREATE TYPE public.import_data_type AS ENUM ('beneficiarios', 'faturamento', 'sinistralidade', 'movimentacoes', 'contratos');

-- Tabela principal de jobs de importação
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_type import_data_type NOT NULL,
  status import_job_status NOT NULL DEFAULT 'pending',
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  warning_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  column_mapping JSONB,
  ai_summary TEXT,
  ai_suggestions JSONB,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  aprovado_por UUID REFERENCES auth.users(id),
  data_aprovacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de staging para linhas individuais
CREATE TABLE public.import_job_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  status import_row_status NOT NULL DEFAULT 'valid',
  original_data JSONB NOT NULL,
  mapped_data JSONB,
  validation_errors JSONB,
  validation_warnings JSONB,
  duplicate_of UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de logs de auditoria da IA
CREATE TABLE public.ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  model_used TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_import_jobs_empresa ON public.import_jobs(empresa_id);
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX idx_import_job_rows_job ON public.import_job_rows(job_id);
CREATE INDEX idx_import_job_rows_status ON public.import_job_rows(status);
CREATE INDEX idx_ai_audit_logs_empresa ON public.ai_audit_logs(empresa_id);
CREATE INDEX idx_ai_audit_logs_job ON public.ai_audit_logs(job_id);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_jobs
CREATE POLICY "Admin Vizio can manage all import_jobs"
ON public.import_jobs FOR ALL
USING (public.has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Empresa can manage their company import_jobs"
ON public.import_jobs FOR ALL
USING (public.has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = public.get_user_empresa_id(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = public.get_user_empresa_id(auth.uid()));

-- RLS Policies for import_job_rows
CREATE POLICY "Admin Vizio can manage all import_job_rows"
ON public.import_job_rows FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.import_jobs j 
  WHERE j.id = import_job_rows.job_id 
  AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.import_jobs j 
  WHERE j.id = import_job_rows.job_id 
  AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
));

CREATE POLICY "Admin Empresa can manage their company import_job_rows"
ON public.import_job_rows FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.import_jobs j 
  WHERE j.id = import_job_rows.job_id 
  AND j.empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin_empresa'::app_role)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.import_jobs j 
  WHERE j.id = import_job_rows.job_id 
  AND j.empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin_empresa'::app_role)
));

-- RLS Policies for ai_audit_logs
CREATE POLICY "Admin Vizio can view all ai_audit_logs"
ON public.ai_audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Empresa can view their company ai_audit_logs"
ON public.ai_audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "System can insert ai_audit_logs"
ON public.ai_audit_logs FOR INSERT
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_import_jobs_updated_at
BEFORE UPDATE ON public.import_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket de imports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('imports', 'imports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies para bucket imports
CREATE POLICY "Admin Vizio can manage all imports files"
ON storage.objects FOR ALL
USING (bucket_id = 'imports' AND public.has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (bucket_id = 'imports' AND public.has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Empresa can manage their company imports files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'imports' 
  AND public.has_role(auth.uid(), 'admin_empresa'::app_role)
  AND (string_to_array(name, '/'))[1] = public.get_user_empresa_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'imports' 
  AND public.has_role(auth.uid(), 'admin_empresa'::app_role)
  AND (string_to_array(name, '/'))[1] = public.get_user_empresa_id(auth.uid())::text
);