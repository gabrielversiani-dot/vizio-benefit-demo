-- Index for efficient pagination and filtering on import_job_rows
CREATE INDEX IF NOT EXISTS idx_import_job_rows_job_status_row 
ON public.import_job_rows (job_id, status, row_number);

-- Index for CPF search (expression index on JSONB)
CREATE INDEX IF NOT EXISTS idx_import_job_rows_cpf 
ON public.import_job_rows ((mapped_data->>'cpf'));

-- Index for name search (expression index on JSONB)
CREATE INDEX IF NOT EXISTS idx_import_job_rows_nome 
ON public.import_job_rows ((mapped_data->>'nome_completo'));