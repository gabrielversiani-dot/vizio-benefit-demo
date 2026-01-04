
-- Remover política antiga que só permite ver arquivos da própria empresa
DROP POLICY IF EXISTS "Users can view their company contratos files" ON storage.objects;

-- Criar nova política: Admin Vizio vê todos, outros veem só da própria empresa
CREATE POLICY "Users can view contratos files based on role"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'contratos' AND (
    has_role(auth.uid(), 'admin_vizio') OR
    (storage.foldername(name))[1] = (SELECT empresa_id::text FROM profiles WHERE id = auth.uid())
  )
);
