-- Create enums for visibility and material type (status already exists)
CREATE TYPE public.visibilidade_acao AS ENUM ('interna', 'cliente');
CREATE TYPE public.tipo_material_saude AS ENUM ('whatsapp', 'folder', 'cartaz', 'brinde', 'email', 'outro');

-- Alter existing acoes_saude table to add new columns
ALTER TABLE public.acoes_saude 
ADD COLUMN IF NOT EXISTS filial_id UUID REFERENCES public.faturamento_entidades(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS campanha_mes TEXT,
ADD COLUMN IF NOT EXISTS hora_inicio TIME,
ADD COLUMN IF NOT EXISTS hora_fim TIME,
ADD COLUMN IF NOT EXISTS publico_alvo TEXT,
ADD COLUMN IF NOT EXISTS responsavel TEXT,
ADD COLUMN IF NOT EXISTS visibilidade visibilidade_acao NOT NULL DEFAULT 'cliente';

-- Create promocao_saude_materiais table
CREATE TABLE public.promocao_saude_materiais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  acao_id UUID NOT NULL REFERENCES public.acoes_saude(id) ON DELETE CASCADE,
  tipo tipo_material_saude NOT NULL DEFAULT 'outro',
  titulo TEXT NOT NULL,
  descricao TEXT,
  storage_bucket TEXT NOT NULL DEFAULT 'promocao-saude',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho INTEGER,
  visivel_cliente BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_acoes_saude_empresa ON public.acoes_saude(empresa_id);
CREATE INDEX IF NOT EXISTS idx_acoes_saude_data ON public.acoes_saude(data_inicio);
CREATE INDEX IF NOT EXISTS idx_acoes_saude_status ON public.acoes_saude(status);
CREATE INDEX IF NOT EXISTS idx_acoes_saude_visibilidade ON public.acoes_saude(visibilidade);
CREATE INDEX idx_promocao_saude_materiais_acao ON public.promocao_saude_materiais(acao_id);
CREATE INDEX idx_promocao_saude_materiais_empresa ON public.promocao_saude_materiais(empresa_id);

-- Enable RLS on materiais
ALTER TABLE public.promocao_saude_materiais ENABLE ROW LEVEL SECURITY;

-- Drop old policies on acoes_saude to recreate with new visibility logic
DROP POLICY IF EXISTS "Admin Vizio has full access" ON public.acoes_saude;
DROP POLICY IF EXISTS "Admin Empresa has full access" ON public.acoes_saude;
DROP POLICY IF EXISTS "RH and Visualizador can view" ON public.acoes_saude;

-- RLS policies for acoes_saude

-- Admin Vizio: full access
CREATE POLICY "Admin Vizio full access acoes_saude"
ON public.acoes_saude
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (public.has_role(auth.uid(), 'admin_vizio'));

-- Admin Empresa: full access to own company
CREATE POLICY "Admin Empresa full access own company acoes_saude"
ON public.acoes_saude
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_empresa') 
  AND empresa_id = public.get_user_empresa_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin_empresa') 
  AND empresa_id = public.get_user_empresa_id(auth.uid())
);

-- RH Gestor and Visualizador: read only visible actions of own company
CREATE POLICY "RH Gestor view visible acoes_saude"
ON public.acoes_saude
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'rh_gestor') OR public.has_role(auth.uid(), 'visualizador'))
  AND empresa_id = public.get_user_empresa_id(auth.uid())
  AND visibilidade = 'cliente'
);

-- RLS policies for promocao_saude_materiais

-- Admin Vizio: full access
CREATE POLICY "Admin Vizio full access materiais"
ON public.promocao_saude_materiais
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin_vizio'))
WITH CHECK (public.has_role(auth.uid(), 'admin_vizio'));

-- Admin Empresa: full access to own company
CREATE POLICY "Admin Empresa full access own company materiais"
ON public.promocao_saude_materiais
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_empresa') 
  AND empresa_id = public.get_user_empresa_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin_empresa') 
  AND empresa_id = public.get_user_empresa_id(auth.uid())
);

-- RH Gestor and Visualizador: read only visible materials of visible actions
CREATE POLICY "RH Gestor view visible materiais"
ON public.promocao_saude_materiais
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'rh_gestor') OR public.has_role(auth.uid(), 'visualizador'))
  AND empresa_id = public.get_user_empresa_id(auth.uid())
  AND visivel_cliente = true
  AND EXISTS (
    SELECT 1 FROM public.acoes_saude a 
    WHERE a.id = acao_id AND a.visibilidade = 'cliente'
  )
);

-- Create storage bucket for promocao-saude
INSERT INTO storage.buckets (id, name, public) 
VALUES ('promocao-saude', 'promocao-saude', false);

-- Storage policies for promocao-saude bucket

-- Admin Vizio can do everything
CREATE POLICY "Admin Vizio full storage access promocao-saude"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'promocao-saude' 
  AND public.has_role(auth.uid(), 'admin_vizio')
)
WITH CHECK (
  bucket_id = 'promocao-saude' 
  AND public.has_role(auth.uid(), 'admin_vizio')
);

-- Admin Empresa can upload/delete to own company folder
CREATE POLICY "Admin Empresa storage access promocao-saude"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'promocao-saude'
  AND public.has_role(auth.uid(), 'admin_empresa')
  AND (storage.foldername(name))[1] = public.get_user_empresa_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'promocao-saude'
  AND public.has_role(auth.uid(), 'admin_empresa')
  AND (storage.foldername(name))[1] = public.get_user_empresa_id(auth.uid())::text
);

-- RH Gestor and Visualizador can only read files from own company
CREATE POLICY "Client read access promocao-saude"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'promocao-saude'
  AND (public.has_role(auth.uid(), 'rh_gestor') OR public.has_role(auth.uid(), 'visualizador'))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id(auth.uid())::text
);