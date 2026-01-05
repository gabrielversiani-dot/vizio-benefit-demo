-- Verificar e ajustar policies de Storage para bucket imports
-- Remover policies antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Admin Vizio can manage all imports files" ON storage.objects;
DROP POLICY IF EXISTS "Admin Empresa can manage their company imports files" ON storage.objects;

-- Policy: Admin Vizio tem acesso total ao bucket imports
CREATE POLICY "Admin Vizio full access imports"
ON storage.objects FOR ALL
USING (
  bucket_id = 'imports' 
  AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
)
WITH CHECK (
  bucket_id = 'imports' 
  AND public.has_role(auth.uid(), 'admin_vizio'::app_role)
);

-- Policy: Admin Empresa pode fazer upload no path da sua empresa
CREATE POLICY "Admin Empresa upload imports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'imports' 
  AND public.has_role(auth.uid(), 'admin_empresa'::app_role)
  AND (string_to_array(name, '/'))[1] = public.get_user_empresa_id(auth.uid())::text
);

-- Policy: Admin Empresa pode ver/baixar arquivos da sua empresa
CREATE POLICY "Admin Empresa select imports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'imports' 
  AND public.has_role(auth.uid(), 'admin_empresa'::app_role)
  AND (string_to_array(name, '/'))[1] = public.get_user_empresa_id(auth.uid())::text
);

-- Policy: Admin Empresa pode deletar arquivos da sua empresa
CREATE POLICY "Admin Empresa delete imports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'imports' 
  AND public.has_role(auth.uid(), 'admin_empresa'::app_role)
  AND (string_to_array(name, '/'))[1] = public.get_user_empresa_id(auth.uid())::text
);