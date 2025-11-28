-- Create enum for movement types
CREATE TYPE tipo_movimentacao AS ENUM ('inclusao', 'exclusao', 'alteracao_cadastral', 'mudanca_plano');

-- Create enum for movement status
CREATE TYPE status_movimentacao AS ENUM ('pendente', 'aprovada', 'rejeitada', 'processada');

-- Create enum for benefit category
CREATE TYPE categoria_beneficio AS ENUM ('saude', 'vida', 'odonto');

-- Create table for movements
CREATE TABLE public.movimentacoes_vidas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo tipo_movimentacao NOT NULL,
  categoria categoria_beneficio NOT NULL,
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  status status_movimentacao NOT NULL DEFAULT 'pendente',
  total_registros INTEGER NOT NULL DEFAULT 0,
  registros_processados INTEGER NOT NULL DEFAULT 0,
  dados_json JSONB,
  observacoes TEXT,
  motivo_rejeicao TEXT,
  data_upload TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_processamento TIMESTAMP WITH TIME ZONE,
  empresa_id UUID NOT NULL,
  criado_por UUID NOT NULL,
  aprovado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.movimentacoes_vidas ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their company movements"
ON public.movimentacoes_vidas
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Users can create movements for their company"
ON public.movimentacoes_vidas
FOR INSERT
WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND criado_por = auth.uid());

CREATE POLICY "Admin Empresa can manage movements from their company"
ON public.movimentacoes_vidas
FOR ALL
USING (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Admin Vizio can view all movements"
ON public.movimentacoes_vidas
FOR SELECT
USING (has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Vizio can manage all movements"
ON public.movimentacoes_vidas
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_movimentacoes_vidas_updated_at
BEFORE UPDATE ON public.movimentacoes_vidas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for movement files
INSERT INTO storage.buckets (id, name, public)
VALUES ('movimentacoes', 'movimentacoes', false);

-- Create storage policies
CREATE POLICY "Users can upload files for their company"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'movimentacoes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view files from their company"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'movimentacoes' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin_vizio'::app_role)
  )
);

CREATE POLICY "Admin can delete movement files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'movimentacoes' 
  AND (
    has_role(auth.uid(), 'admin_empresa'::app_role)
    OR has_role(auth.uid(), 'admin_vizio'::app_role)
  )
);