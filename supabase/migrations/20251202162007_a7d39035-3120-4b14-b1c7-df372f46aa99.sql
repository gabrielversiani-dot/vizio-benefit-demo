-- Criar enum para tipo de demanda
CREATE TYPE public.tipo_demanda AS ENUM (
  'certificado',
  'carteirinha',
  'alteracao_cadastral',
  'reembolso',
  'autorizacao',
  'agendamento',
  'outro'
);

-- Criar enum para status de demanda
CREATE TYPE public.status_demanda AS ENUM (
  'pendente',
  'em_andamento',
  'aguardando_documentacao',
  'concluido',
  'cancelado'
);

-- Criar enum para prioridade
CREATE TYPE public.prioridade_demanda AS ENUM (
  'baixa',
  'media',
  'alta',
  'urgente'
);

-- Criar tabela de demandas
CREATE TABLE public.demandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo tipo_demanda NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status status_demanda NOT NULL DEFAULT 'pendente',
  prioridade prioridade_demanda NOT NULL DEFAULT 'media',
  prazo DATE,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  responsavel_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de histórico/timeline das demandas
CREATE TABLE public.demandas_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demanda_id UUID NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  status_anterior status_demanda,
  status_novo status_demanda,
  comentario TEXT,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandas_historico ENABLE ROW LEVEL SECURITY;

-- Políticas para demandas: Admin Vizio pode tudo
CREATE POLICY "Admin Vizio can manage all demandas"
ON public.demandas
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

-- Empresas podem visualizar suas demandas
CREATE POLICY "Users can view their company demandas"
ON public.demandas
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Políticas para histórico: Admin Vizio pode tudo
CREATE POLICY "Admin Vizio can manage all demandas_historico"
ON public.demandas_historico
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

-- Empresas podem visualizar histórico de suas demandas
CREATE POLICY "Users can view their company demandas_historico"
ON public.demandas_historico
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_id
    AND d.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_demandas_updated_at
BEFORE UPDATE ON public.demandas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();