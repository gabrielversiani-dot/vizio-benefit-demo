-- 1. Add missing columns to demandas_historico table
ALTER TABLE public.demandas_historico 
ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'system';

-- 2. Add concluida_em to demandas table
ALTER TABLE public.demandas 
ADD COLUMN IF NOT EXISTS concluida_em timestamptz NULL;

-- 3. Create index for efficient history queries
CREATE INDEX IF NOT EXISTS idx_demandas_historico_empresa_demanda_created 
ON public.demandas_historico(empresa_id, demanda_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demandas_historico_empresa_created 
ON public.demandas_historico(empresa_id, created_at DESC);

-- 4. Create function to calculate SLA and format it
CREATE OR REPLACE FUNCTION public.format_sla_duration(seconds numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  days integer;
  hours integer;
  minutes integer;
  result text := '';
BEGIN
  IF seconds IS NULL OR seconds < 0 THEN
    RETURN NULL;
  END IF;
  
  days := floor(seconds / 86400)::integer;
  hours := floor((seconds - (days * 86400)) / 3600)::integer;
  minutes := floor((seconds - (days * 86400) - (hours * 3600)) / 60)::integer;
  
  IF days > 0 THEN
    result := days || 'd ';
  END IF;
  
  IF hours > 0 OR days > 0 THEN
    result := result || hours || 'h ';
  END IF;
  
  result := result || minutes || 'm';
  
  RETURN trim(result);
END;
$$;

-- 5. Create trigger function for demanda creation
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

-- 6. Create trigger function for status changes and completion
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
BEGIN
  -- Only proceed if status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get user name
  SELECT nome_completo INTO user_name 
  FROM public.profiles 
  WHERE id = auth.uid();
  
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
    sla_human := public.format_sla_duration(sla_seconds);
    
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
      auth.uid(),
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
      auth.uid(),
      COALESCE(user_name, 'Sistema'),
      'system',
      jsonb_build_object('from_status', OLD.status, 'to_status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. Create triggers (drop if exists first)
DROP TRIGGER IF EXISTS trigger_demanda_created ON public.demandas;
CREATE TRIGGER trigger_demanda_created
AFTER INSERT ON public.demandas
FOR EACH ROW
EXECUTE FUNCTION public.log_demanda_created();

DROP TRIGGER IF EXISTS trigger_demanda_status_change ON public.demandas;
CREATE TRIGGER trigger_demanda_status_change
BEFORE UPDATE ON public.demandas
FOR EACH ROW
EXECUTE FUNCTION public.log_demanda_status_change();

-- 8. Ensure RLS policies exist for demandas_historico (already exist based on context)
-- The existing policies should work: admin_vizio sees all, users see their empresa