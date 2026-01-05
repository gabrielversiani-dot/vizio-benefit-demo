
-- Create enums for faturamento module
CREATE TYPE public.faturamento_produto AS ENUM ('saude', 'vida', 'odonto');
CREATE TYPE public.faturamento_status AS ENUM ('aguardando_pagamento', 'pago', 'atraso', 'cancelado');
CREATE TYPE public.faturamento_entidade_tipo AS ENUM ('coligada', 'subestipulante');
CREATE TYPE public.faturamento_documento_tipo AS ENUM ('boleto', 'nf', 'demonstrativo', 'outro');

-- A) faturamentos (main billing table)
CREATE TABLE public.faturamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto faturamento_produto NOT NULL,
  competencia DATE NOT NULL,
  vencimento DATE NOT NULL,
  valor_total NUMERIC(12,2) NOT NULL,
  status faturamento_status NOT NULL DEFAULT 'aguardando_pagamento',
  pago_em DATE NULL,
  observacao TEXT NULL,
  criado_por UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for faturamentos
CREATE INDEX idx_faturamentos_empresa_produto_competencia ON public.faturamentos(empresa_id, produto, competencia);
CREATE INDEX idx_faturamentos_empresa_vencimento ON public.faturamentos(empresa_id, vencimento);
CREATE INDEX idx_faturamentos_status ON public.faturamentos(status);

-- Enable RLS
ALTER TABLE public.faturamentos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for faturamentos
CREATE POLICY "Admin Vizio can manage all faturamentos"
ON public.faturamentos FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'));

CREATE POLICY "Admin Empresa can manage their company faturamentos"
ON public.faturamentos FOR ALL
USING (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Users can view their company faturamentos"
ON public.faturamentos FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_faturamentos_updated_at
BEFORE UPDATE ON public.faturamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B) faturamento_entidades (subsidiaries/sub-stipulants)
CREATE TABLE public.faturamento_entidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo faturamento_entidade_tipo NOT NULL,
  cnpj TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faturamento_entidades
CREATE INDEX idx_faturamento_entidades_empresa_tipo ON public.faturamento_entidades(empresa_id, tipo);

-- Enable RLS
ALTER TABLE public.faturamento_entidades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for faturamento_entidades
CREATE POLICY "Admin Vizio can manage all faturamento_entidades"
ON public.faturamento_entidades FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'));

CREATE POLICY "Admin Empresa can manage their company faturamento_entidades"
ON public.faturamento_entidades FOR ALL
USING (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Users can view their company faturamento_entidades"
ON public.faturamento_entidades FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_faturamento_entidades_updated_at
BEFORE UPDATE ON public.faturamento_entidades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- C) faturamento_subfaturas (sub-invoices)
CREATE TABLE public.faturamento_subfaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faturamento_id UUID NOT NULL REFERENCES public.faturamentos(id) ON DELETE CASCADE,
  entidade_id UUID NULL REFERENCES public.faturamento_entidades(id) ON DELETE SET NULL,
  descricao TEXT NULL,
  valor NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faturamento_subfaturas
CREATE INDEX idx_faturamento_subfaturas_faturamento ON public.faturamento_subfaturas(faturamento_id);

-- Enable RLS
ALTER TABLE public.faturamento_subfaturas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for faturamento_subfaturas (via join with faturamentos)
CREATE POLICY "Admin Vizio can manage all faturamento_subfaturas"
ON public.faturamento_subfaturas FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'));

CREATE POLICY "Admin Empresa can manage their company faturamento_subfaturas"
ON public.faturamento_subfaturas FOR ALL
USING (
  has_role(auth.uid(), 'admin_empresa') AND 
  EXISTS (
    SELECT 1 FROM public.faturamentos f 
    WHERE f.id = faturamento_subfaturas.faturamento_id 
    AND f.empresa_id = get_user_empresa_id(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin_empresa') AND 
  EXISTS (
    SELECT 1 FROM public.faturamentos f 
    WHERE f.id = faturamento_subfaturas.faturamento_id 
    AND f.empresa_id = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Users can view their company faturamento_subfaturas"
ON public.faturamento_subfaturas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.faturamentos f 
    WHERE f.id = faturamento_subfaturas.faturamento_id 
    AND f.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_faturamento_subfaturas_updated_at
BEFORE UPDATE ON public.faturamento_subfaturas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- D) faturamento_documentos (documents)
CREATE TABLE public.faturamento_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faturamento_id UUID NOT NULL REFERENCES public.faturamentos(id) ON DELETE CASCADE,
  tipo faturamento_documento_tipo NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for faturamento_documentos
CREATE INDEX idx_faturamento_documentos_faturamento ON public.faturamento_documentos(faturamento_id);
CREATE INDEX idx_faturamento_documentos_uploaded_by ON public.faturamento_documentos(uploaded_by);

-- Enable RLS
ALTER TABLE public.faturamento_documentos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for faturamento_documentos (via join with faturamentos)
CREATE POLICY "Admin Vizio can manage all faturamento_documentos"
ON public.faturamento_documentos FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'));

CREATE POLICY "Admin Empresa can manage their company faturamento_documentos"
ON public.faturamento_documentos FOR ALL
USING (
  has_role(auth.uid(), 'admin_empresa') AND 
  EXISTS (
    SELECT 1 FROM public.faturamentos f 
    WHERE f.id = faturamento_documentos.faturamento_id 
    AND f.empresa_id = get_user_empresa_id(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin_empresa') AND 
  EXISTS (
    SELECT 1 FROM public.faturamentos f 
    WHERE f.id = faturamento_documentos.faturamento_id 
    AND f.empresa_id = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Users can view their company faturamento_documentos"
ON public.faturamento_documentos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.faturamentos f 
    WHERE f.id = faturamento_documentos.faturamento_id 
    AND f.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- Storage bucket for faturamento documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('faturamento_docs', 'faturamento_docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for faturamento_docs bucket
CREATE POLICY "Users can view their company faturamento docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'faturamento_docs' AND
  (
    has_role(auth.uid(), 'admin_vizio') OR
    (storage.foldername(name))[1]::uuid = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Admins can upload faturamento docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'faturamento_docs' AND
  (
    has_role(auth.uid(), 'admin_vizio') OR
    (
      has_role(auth.uid(), 'admin_empresa') AND
      (storage.foldername(name))[1]::uuid = get_user_empresa_id(auth.uid())
    )
  )
);

CREATE POLICY "Admins can delete faturamento docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'faturamento_docs' AND
  (
    has_role(auth.uid(), 'admin_vizio') OR
    (
      has_role(auth.uid(), 'admin_empresa') AND
      (storage.foldername(name))[1]::uuid = get_user_empresa_id(auth.uid())
    )
  )
);
