-- Add columns for manual priority tracking
ALTER TABLE public.demandas 
ADD COLUMN IF NOT EXISTS prioridade_manual boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS prioridade_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS prioridade_updated_by uuid;

-- Create function to log priority changes
CREATE OR REPLACE FUNCTION public.log_demanda_prioridade_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_name text;
  current_user_id uuid;
  priority_label_old text;
  priority_label_new text;
BEGIN
  -- Only proceed if prioridade actually changed
  IF OLD.prioridade IS NOT DISTINCT FROM NEW.prioridade THEN
    RETURN NEW;
  END IF;
  
  -- Get current user
  current_user_id := auth.uid();
  
  -- Get user name
  SELECT nome_completo INTO user_name 
  FROM public.profiles 
  WHERE id = current_user_id;
  
  -- Map priority values to labels
  priority_label_old := CASE OLD.prioridade::text
    WHEN 'baixa' THEN 'Baixa'
    WHEN 'media' THEN 'Média'
    WHEN 'alta' THEN 'Alta'
    WHEN 'urgente' THEN 'Urgente'
    ELSE OLD.prioridade::text
  END;
  
  priority_label_new := CASE NEW.prioridade::text
    WHEN 'baixa' THEN 'Baixa'
    WHEN 'media' THEN 'Média'
    WHEN 'alta' THEN 'Alta'
    WHEN 'urgente' THEN 'Urgente'
    ELSE NEW.prioridade::text
  END;
  
  -- Update tracking columns
  NEW.prioridade_updated_at := now();
  NEW.prioridade_updated_by := current_user_id;
  NEW.prioridade_manual := true;
  
  -- Insert priority change event
  INSERT INTO public.demandas_historico (
    demanda_id,
    empresa_id,
    tipo_evento,
    descricao,
    criado_por,
    usuario_nome,
    source,
    meta
  ) VALUES (
    NEW.id,
    NEW.empresa_id,
    'priority_changed',
    'Prioridade alterada de "' || priority_label_old || '" para "' || priority_label_new || '"',
    current_user_id,
    COALESCE(user_name, 'Sistema'),
    'manual',
    jsonb_build_object(
      'from', OLD.prioridade,
      'to', NEW.prioridade,
      'from_label', priority_label_old,
      'to_label', priority_label_new
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Create trigger for priority changes (if not exists)
DROP TRIGGER IF EXISTS log_demanda_prioridade_change ON public.demandas;
CREATE TRIGGER log_demanda_prioridade_change
  BEFORE UPDATE OF prioridade ON public.demandas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_demanda_prioridade_change();

-- Add RLS policy for admin_empresa to update demandas prioridade
CREATE POLICY "Admin Empresa can update demandas prioridade"
ON public.demandas
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin_empresa'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin_empresa'::app_role) 
  AND empresa_id = get_user_empresa_id(auth.uid())
);