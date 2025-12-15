
-- Criar enums para beneficiários
CREATE TYPE public.status_beneficiario AS ENUM ('ativo', 'inativo', 'suspenso');
CREATE TYPE public.tipo_beneficiario AS ENUM ('titular', 'dependente');
CREATE TYPE public.grau_parentesco AS ENUM ('conjuge', 'filho', 'pai', 'mae', 'outro');

-- Criar tabela de beneficiários
CREATE TABLE public.beneficiarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  cpf TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  sexo TEXT CHECK (sexo IN ('M', 'F')),
  email TEXT,
  telefone TEXT,
  
  -- Endereço
  cep TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  
  -- Vínculo
  tipo tipo_beneficiario NOT NULL DEFAULT 'titular',
  titular_id UUID REFERENCES public.beneficiarios(id) ON DELETE SET NULL,
  grau_parentesco grau_parentesco,
  matricula TEXT,
  cargo TEXT,
  departamento TEXT,
  
  -- Planos
  plano_saude BOOLEAN DEFAULT false,
  plano_vida BOOLEAN DEFAULT false,
  plano_odonto BOOLEAN DEFAULT false,
  
  -- Status e datas
  status status_beneficiario NOT NULL DEFAULT 'ativo',
  data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_exclusao DATE,
  motivo_exclusao TEXT,
  
  -- Auditoria
  criado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_beneficiarios_empresa ON public.beneficiarios(empresa_id);
CREATE INDEX idx_beneficiarios_cpf ON public.beneficiarios(cpf);
CREATE INDEX idx_beneficiarios_titular ON public.beneficiarios(titular_id);
CREATE INDEX idx_beneficiarios_status ON public.beneficiarios(status);

-- Enable RLS
ALTER TABLE public.beneficiarios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admin Vizio can manage all beneficiarios"
ON public.beneficiarios
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'));

CREATE POLICY "Users can view their company beneficiarios"
ON public.beneficiarios
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Admin Empresa can manage their company beneficiarios"
ON public.beneficiarios
FOR ALL
USING (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin_empresa') AND empresa_id = get_user_empresa_id(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_beneficiarios_updated_at
  BEFORE UPDATE ON public.beneficiarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
