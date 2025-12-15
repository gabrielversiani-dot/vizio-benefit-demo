
-- Criar tabela de faturamento
CREATE TABLE public.faturamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,
  categoria categoria_beneficio NOT NULL,
  
  -- Valores
  valor_mensalidade NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_coparticipacao NUMERIC(12,2) DEFAULT 0,
  valor_reembolsos NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Vidas
  total_vidas INTEGER NOT NULL DEFAULT 0,
  total_titulares INTEGER NOT NULL DEFAULT 0,
  total_dependentes INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido', 'cancelado')),
  data_vencimento DATE,
  data_pagamento DATE,
  
  -- Auditoria
  criado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(empresa_id, competencia, categoria)
);

-- Criar tabela de sinistralidade
CREATE TABLE public.sinistralidade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,
  categoria categoria_beneficio NOT NULL,
  
  -- Valores de prêmio/mensalidade
  valor_premio NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Sinistros
  valor_sinistros NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_sinistros INTEGER NOT NULL DEFAULT 0,
  
  -- Índice de sinistralidade
  indice_sinistralidade NUMERIC(5,2),
  
  -- Detalhamento por tipo
  sinistros_consultas NUMERIC(12,2) DEFAULT 0,
  sinistros_exames NUMERIC(12,2) DEFAULT 0,
  sinistros_internacoes NUMERIC(12,2) DEFAULT 0,
  sinistros_procedimentos NUMERIC(12,2) DEFAULT 0,
  sinistros_outros NUMERIC(12,2) DEFAULT 0,
  
  -- Auditoria
  criado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(empresa_id, competencia, categoria)
);

-- Criar tabela de sinistros de vida
CREATE TABLE public.sinistros_vida (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  beneficiario_nome TEXT NOT NULL,
  beneficiario_cpf TEXT,
  tipo_sinistro TEXT NOT NULL CHECK (tipo_sinistro IN ('morte', 'invalidez_permanente', 'invalidez_temporaria', 'doenca_grave')),
  data_ocorrencia DATE NOT NULL,
  data_comunicacao DATE,
  valor_indenizacao NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise', 'aprovado', 'negado', 'pago')),
  observacoes TEXT,
  criado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_faturamento_empresa ON public.faturamento(empresa_id);
CREATE INDEX idx_faturamento_competencia ON public.faturamento(competencia);
CREATE INDEX idx_sinistralidade_empresa ON public.sinistralidade(empresa_id);
CREATE INDEX idx_sinistralidade_competencia ON public.sinistralidade(competencia);
CREATE INDEX idx_sinistros_vida_empresa ON public.sinistros_vida(empresa_id);

-- Enable RLS
ALTER TABLE public.faturamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistralidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistros_vida ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para faturamento
CREATE POLICY "Admin Vizio can manage all faturamento"
ON public.faturamento FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'));

CREATE POLICY "Users can view their company faturamento"
ON public.faturamento FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Políticas RLS para sinistralidade
CREATE POLICY "Admin Vizio can manage all sinistralidade"
ON public.sinistralidade FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'));

CREATE POLICY "Users can view their company sinistralidade"
ON public.sinistralidade FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Políticas RLS para sinistros_vida
CREATE POLICY "Admin Vizio can manage all sinistros_vida"
ON public.sinistros_vida FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'));

CREATE POLICY "Users can view their company sinistros_vida"
ON public.sinistros_vida FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Triggers para updated_at
CREATE TRIGGER update_faturamento_updated_at
  BEFORE UPDATE ON public.faturamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sinistralidade_updated_at
  BEFORE UPDATE ON public.sinistralidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sinistros_vida_updated_at
  BEFORE UPDATE ON public.sinistros_vida
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
