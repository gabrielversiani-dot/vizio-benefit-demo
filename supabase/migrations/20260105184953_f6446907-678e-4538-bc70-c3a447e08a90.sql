-- Tabela para armazenar recomendações geradas pela IA
CREATE TABLE public.ai_recomendacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  categoria text NOT NULL DEFAULT 'sinistralidade',
  severidade text NOT NULL DEFAULT 'medium' CHECK (severidade IN ('low', 'medium', 'high')),
  titulo text NOT NULL,
  descricao text NOT NULL,
  evidencias jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'applied', 'dismissed')),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_recomendacoes ENABLE ROW LEVEL SECURITY;

-- Admin Vizio pode ver e gerenciar todas as recomendações
CREATE POLICY "Admin Vizio can manage all ai_recomendacoes"
ON public.ai_recomendacoes
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

-- Admin Empresa pode ver e gerenciar recomendações da sua empresa
CREATE POLICY "Admin Empresa can manage their company ai_recomendacoes"
ON public.ai_recomendacoes
FOR ALL
USING (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()));

-- Usuários podem ver recomendações da sua empresa
CREATE POLICY "Users can view their company ai_recomendacoes"
ON public.ai_recomendacoes
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ai_recomendacoes_updated_at
BEFORE UPDATE ON public.ai_recomendacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_ai_recomendacoes_empresa_id ON public.ai_recomendacoes(empresa_id);
CREATE INDEX idx_ai_recomendacoes_status ON public.ai_recomendacoes(status);
CREATE INDEX idx_ai_recomendacoes_categoria ON public.ai_recomendacoes(categoria);