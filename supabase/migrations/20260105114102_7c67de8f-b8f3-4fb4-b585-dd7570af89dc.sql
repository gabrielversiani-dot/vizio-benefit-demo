-- Add parent_job_id for reimport tracking
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES public.import_jobs(id) ON DELETE SET NULL;

-- Add applied_by and applied_at for audit
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS applied_by uuid,
ADD COLUMN IF NOT EXISTS applied_at timestamptz;

-- Create indexes for reimport queries
CREATE INDEX IF NOT EXISTS idx_import_jobs_parent_job_id 
ON public.import_jobs (parent_job_id) WHERE parent_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_jobs_empresa_created 
ON public.import_jobs (empresa_id, created_at DESC);