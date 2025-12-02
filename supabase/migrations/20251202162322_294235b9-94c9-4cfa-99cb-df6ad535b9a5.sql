-- Criar enum para tipo de ação de saúde
CREATE TYPE public.tipo_acao_saude AS ENUM (
  'campanha',
  'programa',
  'evento',
  'treinamento'
);

-- Criar enum para categoria de ação de saúde
CREATE TYPE public.categoria_acao_saude AS ENUM (
  'vacinacao',
  'checkup',
  'bem_estar',
  'nutricional',
  'atividade_fisica',
  'saude_mental',
  'prevencao',
  'outro'
);

-- Criar enum para status de ação de saúde
CREATE TYPE public.status_acao_saude AS ENUM (
  'planejada',
  'em_andamento',
  'concluida',
  'cancelada'
);

-- Criar tabela de ações de saúde
CREATE TABLE public.acoes_saude (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo tipo_acao_saude NOT NULL,
  categoria categoria_acao_saude NOT NULL,
  status status_acao_saude NOT NULL DEFAULT 'planejada',
  data_inicio DATE NOT NULL,
  data_fim DATE,
  local TEXT,
  capacidade_maxima INTEGER,
  material_url TEXT,
  material_nome TEXT,
  observacoes TEXT,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de indicadores de saúde
CREATE TABLE public.indicadores_saude (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  acao_id UUID NOT NULL REFERENCES public.acoes_saude(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  total_convidados INTEGER NOT NULL DEFAULT 0,
  total_participantes INTEGER NOT NULL DEFAULT 0,
  taxa_adesao NUMERIC(5,2),
  observacoes TEXT,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.acoes_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicadores_saude ENABLE ROW LEVEL SECURITY;

-- Políticas para acoes_saude: Admin Vizio pode tudo
CREATE POLICY "Admin Vizio can manage all acoes_saude"
ON public.acoes_saude
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

-- Empresas podem visualizar ações gerais (sem empresa_id) ou da sua empresa
CREATE POLICY "Users can view acoes_saude"
ON public.acoes_saude
FOR SELECT
USING (
  empresa_id IS NULL 
  OR empresa_id = get_user_empresa_id(auth.uid())
);

-- Políticas para indicadores_saude: Admin Vizio pode tudo
CREATE POLICY "Admin Vizio can manage all indicadores_saude"
ON public.indicadores_saude
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

-- Empresas podem visualizar seus indicadores
CREATE POLICY "Users can view their company indicadores_saude"
ON public.indicadores_saude
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Triggers para atualizar updated_at
CREATE TRIGGER update_acoes_saude_updated_at
BEFORE UPDATE ON public.acoes_saude
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_indicadores_saude_updated_at
BEFORE UPDATE ON public.indicadores_saude
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();