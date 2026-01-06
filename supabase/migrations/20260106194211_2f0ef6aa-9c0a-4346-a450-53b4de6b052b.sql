-- Add missing columns to sinistros_vida for RD Station integration
ALTER TABLE public.sinistros_vida
ADD COLUMN IF NOT EXISTS subestipulante_filial_id uuid REFERENCES public.faturamento_entidades(id),
ADD COLUMN IF NOT EXISTS prioridade text DEFAULT 'media',
ADD COLUMN IF NOT EXISTS valor_estimado numeric,
ADD COLUMN IF NOT EXISTS responsavel_id uuid,
ADD COLUMN IF NOT EXISTS aberto_por_role text DEFAULT 'vizio',
ADD COLUMN IF NOT EXISTS rd_org_id text,
ADD COLUMN IF NOT EXISTS rd_deal_id text,
ADD COLUMN IF NOT EXISTS rd_pipeline_id text,
ADD COLUMN IF NOT EXISTS rd_stage_id text,
ADD COLUMN IF NOT EXISTS rd_owner_id text,
ADD COLUMN IF NOT EXISTS rd_last_sync_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rd_sync_status text,
ADD COLUMN IF NOT EXISTS rd_sync_error text,
ADD COLUMN IF NOT EXISTS concluido_em timestamp with time zone,
ADD COLUMN IF NOT EXISTS sla_minutos integer;

-- Create rd_webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS public.rd_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'rd',
  event_id text NOT NULL,
  event_type text,
  payload jsonb NOT NULL,
  processed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);

-- Create sinistros_vida_timeline table for history
CREATE TABLE IF NOT EXISTS public.sinistros_vida_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistros_vida(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  tipo_evento text NOT NULL,
  descricao text,
  status_anterior text,
  status_novo text,
  meta jsonb,
  source text DEFAULT 'sistema',
  criado_por uuid NOT NULL,
  usuario_nome text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.rd_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistros_vida_timeline ENABLE ROW LEVEL SECURITY;

-- RLS policies for rd_webhook_events (only admin_vizio can manage)
CREATE POLICY "Admin Vizio can manage rd_webhook_events"
ON public.rd_webhook_events
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

-- RLS policies for sinistros_vida_timeline
CREATE POLICY "Admin Vizio can manage all sinistros_vida_timeline"
ON public.sinistros_vida_timeline
FOR ALL
USING (has_role(auth.uid(), 'admin_vizio'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_vizio'::app_role));

CREATE POLICY "Users can view their company sinistros_vida_timeline"
ON public.sinistros_vida_timeline
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Users can insert timeline for their company"
ON public.sinistros_vida_timeline
FOR INSERT
WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

-- Add policy for empresa users to create sinistros
CREATE POLICY "Admin Empresa can manage their company sinistros_vida"
ON public.sinistros_vida
FOR ALL
USING (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin_empresa'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "RH Gestor can create sinistros_vida"
ON public.sinistros_vida
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'rh_gestor'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "RH Gestor can view their company sinistros_vida"
ON public.sinistros_vida
FOR SELECT
USING (has_role(auth.uid(), 'rh_gestor'::app_role) AND empresa_id = get_user_empresa_id(auth.uid()));

-- Trigger to create timeline entry on sinistro status change
CREATE OR REPLACE FUNCTION public.log_sinistro_vida_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name text;
BEGIN
  -- Get user name
  SELECT nome_completo INTO v_user_name FROM public.profiles WHERE id = auth.uid();
  
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.sinistros_vida_timeline (
      sinistro_id,
      empresa_id,
      tipo_evento,
      descricao,
      status_anterior,
      status_novo,
      source,
      criado_por,
      usuario_nome
    ) VALUES (
      NEW.id,
      NEW.empresa_id,
      'status_changed',
      'Status alterado de ' || COALESCE(OLD.status, 'novo') || ' para ' || NEW.status,
      OLD.status,
      NEW.status,
      'sistema',
      COALESCE(auth.uid(), NEW.criado_por),
      v_user_name
    );
    
    -- Calculate SLA if completed
    IF NEW.status IN ('concluido', 'pago') AND NEW.concluido_em IS NULL THEN
      NEW.concluido_em := now();
      NEW.sla_minutos := EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 60;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER sinistro_vida_status_change_trigger
BEFORE UPDATE ON public.sinistros_vida
FOR EACH ROW
EXECUTE FUNCTION public.log_sinistro_vida_status_change();

-- Create index for RD deal lookup
CREATE INDEX IF NOT EXISTS idx_sinistros_vida_rd_deal_id ON public.sinistros_vida(rd_deal_id);
CREATE INDEX IF NOT EXISTS idx_sinistros_vida_empresa_id ON public.sinistros_vida(empresa_id);
CREATE INDEX IF NOT EXISTS idx_rd_webhook_events_event_id ON public.rd_webhook_events(provider, event_id);