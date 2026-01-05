-- Create table for period-based sinistralidade indicators from PDFs
CREATE TABLE IF NOT EXISTS public.sinistralidade_indicadores_periodo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  tipo_relatorio TEXT NOT NULL, -- 'custo_assistencial', 'consultas', 'internacoes'
  operadora TEXT DEFAULT 'Unimed',
  produto TEXT,
  metricas JSONB DEFAULT '{}',
  quebras JSONB DEFAULT '{}',
  fonte_pdf_path TEXT,
  import_job_id UUID REFERENCES public.import_jobs(id),
  criado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add columns to sinistralidade table for PDF imports
ALTER TABLE public.sinistralidade 
ADD COLUMN IF NOT EXISTS operadora TEXT,
ADD COLUMN IF NOT EXISTS produto TEXT,
ADD COLUMN IF NOT EXISTS vidas INTEGER,
ADD COLUMN IF NOT EXISTS fonte_pdf_path TEXT,
ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES public.import_jobs(id);

-- Enable RLS
ALTER TABLE public.sinistralidade_indicadores_periodo ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sinistralidade_indicadores_periodo
CREATE POLICY "Users can view their own company indicators" 
ON public.sinistralidade_indicadores_periodo 
FOR SELECT 
USING (empresa_id IN (
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin_vizio'
));

CREATE POLICY "Users can insert indicators for their company" 
ON public.sinistralidade_indicadores_periodo 
FOR INSERT 
WITH CHECK (empresa_id IN (
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin_vizio'
));

CREATE POLICY "Users can update their own company indicators" 
ON public.sinistralidade_indicadores_periodo 
FOR UPDATE 
USING (empresa_id IN (
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin_vizio'
));

CREATE POLICY "Users can delete their own company indicators" 
ON public.sinistralidade_indicadores_periodo 
FOR DELETE 
USING (empresa_id IN (
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin_vizio'
));

-- Create trigger for updated_at
CREATE TRIGGER update_sinistralidade_indicadores_periodo_updated_at
BEFORE UPDATE ON public.sinistralidade_indicadores_periodo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add sinistralidade_pdf to import_data_type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sinistralidade_pdf' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'import_data_type')) THEN
    ALTER TYPE public.import_data_type ADD VALUE 'sinistralidade_pdf';
  END IF;
END$$;