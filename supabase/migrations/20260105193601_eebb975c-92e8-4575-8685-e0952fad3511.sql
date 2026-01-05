-- Add filial_id to faturamentos table (references faturamento_entidades)
ALTER TABLE public.faturamentos
ADD COLUMN filial_id uuid REFERENCES public.faturamento_entidades(id) ON DELETE SET NULL;

-- Create index for filial_id
CREATE INDEX idx_faturamentos_filial_id ON public.faturamentos(filial_id);