-- Criar políticas de storage para o bucket 'movimentacoes'
-- Admin Vizio pode ver todos os arquivos
CREATE POLICY "Admin Vizio can view all movimentacoes files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'movimentacoes' 
  AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
);

-- Admin Vizio pode fazer upload de arquivos
CREATE POLICY "Admin Vizio can upload movimentacoes files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'movimentacoes' 
  AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
);

-- Admin Vizio pode deletar arquivos
CREATE POLICY "Admin Vizio can delete movimentacoes files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'movimentacoes' 
  AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
);

-- Usuários da empresa podem ver arquivos da sua empresa (path: userId/...)
CREATE POLICY "Users can view their company movimentacoes files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'movimentacoes' 
  AND EXISTS (
    SELECT 1 FROM public.movimentacoes_vidas mv
    WHERE mv.arquivo_url = name
    AND mv.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

-- Usuários podem fazer upload (path: userId/...)
CREATE POLICY "Users can upload their own movimentacoes files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'movimentacoes' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Admin Empresa pode ver arquivos da sua empresa
CREATE POLICY "Admin Empresa can view company movimentacoes files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'movimentacoes' 
  AND public.has_role(auth.uid(), 'admin_empresa'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.movimentacoes_vidas mv
    WHERE mv.arquivo_url = name
    AND mv.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);