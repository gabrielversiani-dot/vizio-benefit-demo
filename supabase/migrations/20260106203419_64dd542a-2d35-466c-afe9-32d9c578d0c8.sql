-- Add unique index for rd_deal_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_sinistros_vida_rd_deal_id_unique 
ON public.sinistros_vida (rd_deal_id) 
WHERE rd_deal_id IS NOT NULL;

-- Add rd_event_id column to timeline for idempotency
ALTER TABLE public.sinistros_vida_timeline 
ADD COLUMN IF NOT EXISTS rd_event_id TEXT;

-- Create unique index for timeline idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_sinistros_vida_timeline_rd_event_unique 
ON public.sinistros_vida_timeline (rd_event_id) 
WHERE rd_event_id IS NOT NULL;

-- Add event_hash column as fallback idempotency key
ALTER TABLE public.sinistros_vida_timeline 
ADD COLUMN IF NOT EXISTS event_hash TEXT;

-- Create unique index for event_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_sinistros_vida_timeline_event_hash_unique 
ON public.sinistros_vida_timeline (event_hash) 
WHERE event_hash IS NOT NULL;

-- Add RLS policy for RH Gestor to insert documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sinistro_documentos' 
    AND policyname = 'RH Gestor can insert sinistro_documentos'
  ) THEN
    CREATE POLICY "RH Gestor can insert sinistro_documentos"
    ON public.sinistro_documentos
    FOR INSERT
    WITH CHECK (
      has_role(auth.uid(), 'rh_gestor'::app_role) 
      AND empresa_id = get_user_empresa_id(auth.uid())
    );
  END IF;
END $$;

-- Add RLS policy for RH Gestor to delete their own documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sinistro_documentos' 
    AND policyname = 'RH Gestor can delete own sinistro_documentos'
  ) THEN
    CREATE POLICY "RH Gestor can delete own sinistro_documentos"
    ON public.sinistro_documentos
    FOR DELETE
    USING (
      has_role(auth.uid(), 'rh_gestor'::app_role) 
      AND empresa_id = get_user_empresa_id(auth.uid())
      AND uploaded_by = auth.uid()
    );
  END IF;
END $$;