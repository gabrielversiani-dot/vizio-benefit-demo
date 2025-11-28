-- Criar enum para tipos de documento
CREATE TYPE tipo_documento_contrato AS ENUM ('contrato', 'aditivo', 'renovacao');

-- Criar enum para status do contrato
CREATE TYPE status_contrato AS ENUM ('ativo', 'vencido', 'em_renovacao', 'suspenso', 'cancelado');

-- Criar tabela de contratos
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo tipo_documento_contrato NOT NULL DEFAULT 'contrato',
  numero_contrato TEXT,
  status status_contrato NOT NULL DEFAULT 'ativo',
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  valor_mensal DECIMAL(10, 2),
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  contrato_pai_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  observacoes TEXT,
  assinado BOOLEAN NOT NULL DEFAULT false,
  data_assinatura DATE,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_contratos_empresa_id ON public.contratos(empresa_id);
CREATE INDEX idx_contratos_status ON public.contratos(status);
CREATE INDEX idx_contratos_data_fim ON public.contratos(data_fim);
CREATE INDEX idx_contratos_tipo ON public.contratos(tipo);

-- Criar trigger para updated_at
CREATE TRIGGER update_contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- RLS Policies para contratos
-- Admin Vizio pode ver e gerenciar todos os contratos
CREATE POLICY "Admin Vizio can view all contratos"
  ON public.contratos
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Vizio can insert contratos"
  ON public.contratos
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Vizio can update contratos"
  ON public.contratos
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Admin Vizio can delete contratos"
  ON public.contratos
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin_vizio'::app_role));

-- Admin Empresa pode ver contratos da sua empresa
CREATE POLICY "Admin Empresa can view their company contratos"
  ON public.contratos
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin_empresa'::app_role) 
    AND empresa_id = public.get_user_empresa_id(auth.uid())
  );

-- Usuários podem ver contratos da sua empresa
CREATE POLICY "Users can view their company contratos"
  ON public.contratos
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Criar bucket de storage para contratos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contratos', 'contratos', false);

-- Políticas de storage para contratos
-- Admin Vizio pode fazer upload
CREATE POLICY "Admin Vizio can upload contratos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'contratos' 
    AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
  );

-- Admin Vizio pode atualizar arquivos
CREATE POLICY "Admin Vizio can update contratos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'contratos' 
    AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
  );

-- Admin Vizio pode deletar arquivos
CREATE POLICY "Admin Vizio can delete contratos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'contratos' 
    AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
  );

-- Usuários podem visualizar contratos da sua empresa
-- O path dos arquivos será: empresa_id/arquivo_nome
CREATE POLICY "Users can view their company contratos files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'contratos' 
    AND (storage.foldername(name))[1] = (
      SELECT empresa_id::text 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Comentários nas tabelas
COMMENT ON TABLE public.contratos IS 'Armazena contratos, aditivos e renovações';
COMMENT ON COLUMN public.contratos.contrato_pai_id IS 'Referência ao contrato original para aditivos e renovações';
COMMENT ON COLUMN public.contratos.versao IS 'Versão do documento para histórico';
COMMENT ON COLUMN public.contratos.assinado IS 'Indica se o contrato foi assinado digitalmente';