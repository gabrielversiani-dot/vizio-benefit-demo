-- Fix: Add policy to allow triggers to insert into demandas_historico
-- Triggers run with SECURITY DEFINER or need special handling

-- First, let's modify the trigger functions to use SECURITY DEFINER
-- This ensures they can insert regardless of RLS

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_demanda_created ON public.demandas;
DROP TRIGGER IF EXISTS trigger_demanda_status_change ON public.demandas;

-- Recreate functions with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.log_demanda_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
BEGIN
  -- Get user name if available
  SELECT nome_completo INTO user_name 
  FROM public.profiles 
  WHERE id = NEW.criado_por;
  
  INSERT INTO public.demandas_historico (
    demanda_id,
    empresa_id,
    tipo_evento,
    status_novo,
    descricao,
    criado_por,
    usuario_nome,
    source,
    meta
  ) VALUES (
    NEW.id,
    NEW.empresa_id,
    'created',
    NEW.status,
    'Demanda registrada no sistema',
    NEW.criado_por,
    COALESCE(user_name, 'Sistema'),
    COALESCE(NEW.source, 'manual'),
    jsonb_build_object('titulo', NEW.titulo, 'tipo', NEW.tipo, 'prioridade', NEW.prioridade)
  );
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_demanda_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
  sla_seconds numeric;
  sla_human text;
  event_description text;
  current_user_id uuid;
BEGIN
  -- Only proceed if status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get current user
  current_user_id := auth.uid();
  
  -- Get user name
  SELECT nome_completo INTO user_name 
  FROM public.profiles 
  WHERE id = current_user_id;
  
  -- Build description
  event_description := 'De "' || COALESCE(OLD.status::text, 'pendente') || '" para "' || NEW.status::text || '"';
  
  -- Check if being completed
  IF NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM 'concluido' THEN
    -- Set concluida_em if not already set
    IF NEW.concluida_em IS NULL THEN
      NEW.concluida_em := now();
    END IF;
    
    -- Calculate SLA
    sla_seconds := EXTRACT(EPOCH FROM (NEW.concluida_em - NEW.created_at));
    sla_human := public.format_sla_duration(sla_seconds::integer);
    
    -- Insert completion event
    INSERT INTO public.demandas_historico (
      demanda_id,
      empresa_id,
      tipo_evento,
      status_anterior,
      status_novo,
      descricao,
      criado_por,
      usuario_nome,
      source,
      meta
    ) VALUES (
      NEW.id,
      NEW.empresa_id,
      'completed',
      OLD.status,
      NEW.status,
      'Demanda concluída. SLA: ' || COALESCE(sla_human, 'N/A'),
      current_user_id,
      COALESCE(user_name, 'Sistema'),
      'system',
      jsonb_build_object(
        'sla_seconds', sla_seconds,
        'sla_human', sla_human,
        'from_status', OLD.status,
        'to_status', NEW.status,
        'concluida_em', NEW.concluida_em
      )
    );
  ELSE
    -- Insert regular status change event
    INSERT INTO public.demandas_historico (
      demanda_id,
      empresa_id,
      tipo_evento,
      status_anterior,
      status_novo,
      descricao,
      criado_por,
      usuario_nome,
      source,
      meta
    ) VALUES (
      NEW.id,
      NEW.empresa_id,
      'status_changed',
      OLD.status,
      NEW.status,
      event_description,
      current_user_id,
      COALESCE(user_name, 'Sistema'),
      'system',
      jsonb_build_object('from_status', OLD.status, 'to_status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER trigger_demanda_created
  AFTER INSERT ON public.demandas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_demanda_created();

CREATE TRIGGER trigger_demanda_status_change
  BEFORE UPDATE ON public.demandas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_demanda_status_change();

-- Backfill: Create history events for existing demandas that don't have any
INSERT INTO public.demandas_historico (
  demanda_id,
  empresa_id,
  tipo_evento,
  status_novo,
  descricao,
  criado_por,
  usuario_nome,
  source,
  meta,
  created_at
)
SELECT 
  d.id,
  d.empresa_id,
  'created',
  d.status,
  'Demanda registrada no sistema (backfill)',
  d.criado_por,
  COALESCE(p.nome_completo, 'Sistema'),
  COALESCE(d.source, 'manual'),
  jsonb_build_object('titulo', d.titulo, 'tipo', d.tipo, 'prioridade', d.prioridade, 'backfill', true),
  d.created_at
FROM public.demandas d
LEFT JOIN public.profiles p ON p.id = d.criado_por
WHERE NOT EXISTS (
  SELECT 1 FROM public.demandas_historico h 
  WHERE h.demanda_id = d.id AND h.tipo_evento = 'created'
);

-- Also fix demandas with status='concluido' but concluida_em IS NULL
UPDATE public.demandas
SET concluida_em = updated_at
WHERE status = 'concluido' AND concluida_em IS NULL;

-- Insert completion events for completed demandas that don't have one
INSERT INTO public.demandas_historico (
  demanda_id,
  empresa_id,
  tipo_evento,
  status_novo,
  descricao,
  criado_por,
  usuario_nome,
  source,
  meta,
  created_at
)
SELECT 
  d.id,
  d.empresa_id,
  'completed',
  d.status,
  'Demanda concluída. SLA: ' || COALESCE(public.format_sla_duration(EXTRACT(EPOCH FROM (d.concluida_em - d.created_at))::integer), 'N/A'),
  d.criado_por,
  COALESCE(p.nome_completo, 'Sistema'),
  'system',
  jsonb_build_object(
    'sla_seconds', EXTRACT(EPOCH FROM (d.concluida_em - d.created_at)),
    'sla_human', public.format_sla_duration(EXTRACT(EPOCH FROM (d.concluida_em - d.created_at))::integer),
    'to_status', 'concluido',
    'concluida_em', d.concluida_em,
    'backfill', true
  ),
  d.concluida_em
FROM public.demandas d
LEFT JOIN public.profiles p ON p.id = d.criado_por
WHERE d.status = 'concluido'
AND NOT EXISTS (
  SELECT 1 FROM public.demandas_historico h 
  WHERE h.demanda_id = d.id AND h.tipo_evento = 'completed'
);