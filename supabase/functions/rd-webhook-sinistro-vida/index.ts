import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rd-signature',
};

// Stage to status mapping (reverse of sync function)
const STAGE_INDEX_TO_STATUS: Record<number, string> = {
  0: 'em_analise',
  1: 'pendente_documentos',
  2: 'em_andamento',
  3: 'enviado_operadora',
  4: 'aprovado', // Could also be 'negado' - we'll check deal properties
  5: 'concluido', // Could also be 'pago'
};

interface RDWebhookPayload {
  event_uuid: string;
  event_type: string;
  event_timestamp: string;
  entity: string;
  entity_id: string;
  data: {
    deal?: {
      _id: string;
      name: string;
      deal_stage?: {
        _id: string;
        name: string;
        order: number;
      };
      user?: {
        _id: string;
        name: string;
        email: string;
      };
      organization?: {
        _id: string;
        name: string;
      };
      custom_fields?: Array<{
        label: string;
        value: unknown;
      }>;
    };
    previous_data?: Record<string, unknown>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const payload: RDWebhookPayload = await req.json();
    console.log('Received webhook:', JSON.stringify(payload, null, 2));

    const eventId = payload.event_uuid;
    const eventType = payload.event_type;
    const deal = payload.data?.deal;

    if (!deal?._id) {
      console.log('No deal ID in payload, ignoring');
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check idempotency
    const { data: existingEvent } = await adminClient
      .from('rd_webhook_events')
      .select('id')
      .eq('provider', 'rd')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      console.log(`Event ${eventId} already processed, ignoring`);
      return new Response(JSON.stringify({ success: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store event for idempotency
    await adminClient
      .from('rd_webhook_events')
      .insert({
        provider: 'rd',
        event_id: eventId,
        event_type: eventType,
        payload: payload as unknown as Record<string, unknown>,
        status: 'processing',
      });

    // Find sinistro by rd_deal_id
    const { data: sinistro, error: sinistroError } = await adminClient
      .from('sinistros_vida')
      .select('*')
      .eq('rd_deal_id', deal._id)
      .single();

    if (sinistroError || !sinistro) {
      console.log(`No sinistro found for deal ${deal._id}`);
      
      // Mark event as ignored
      await adminClient
        .from('rd_webhook_events')
        .update({ status: 'ignored', processed_at: new Date().toISOString() })
        .eq('event_id', eventId);

      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'no_sinistro' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates: Record<string, unknown> = {
      rd_last_sync_at: new Date().toISOString(),
      rd_sync_status: 'ok',
    };

    let timelineDescription = '';
    let oldStatus = sinistro.status;
    let newStatus = sinistro.status;

    // Handle stage change
    if (deal.deal_stage) {
      const stageOrder = deal.deal_stage.order || 0;
      newStatus = STAGE_INDEX_TO_STATUS[stageOrder] || sinistro.status;
      
      // Check stage name for more specific status
      const stageName = deal.deal_stage.name?.toLowerCase() || '';
      if (stageName.includes('negado') || stageName.includes('recusado')) {
        newStatus = 'negado';
      } else if (stageName.includes('pago')) {
        newStatus = 'pago';
      } else if (stageName.includes('conclu')) {
        newStatus = 'concluido';
      }

      if (newStatus !== sinistro.status) {
        updates.status = newStatus;
        updates.rd_stage_id = deal.deal_stage._id;
        timelineDescription = `Status alterado para "${newStatus}" via RD Station`;

        // Set completion time if completing
        if (['concluido', 'pago'].includes(newStatus) && !sinistro.concluido_em) {
          updates.concluido_em = new Date().toISOString();
          const createdAt = new Date(sinistro.created_at).getTime();
          const now = Date.now();
          updates.sla_minutos = Math.round((now - createdAt) / 60000);
        }
      }
    }

    // Handle owner change
    if (deal.user && deal.user._id !== sinistro.rd_owner_id) {
      updates.rd_owner_id = deal.user._id;
      if (!timelineDescription) {
        timelineDescription = `Responsável alterado para "${deal.user.name}" via RD Station`;
      }
    }

    // Apply updates
    if (Object.keys(updates).length > 1) { // More than just rd_last_sync_at
      const { error: updateError } = await adminClient
        .from('sinistros_vida')
        .update(updates)
        .eq('id', sinistro.id);

      if (updateError) {
        throw updateError;
      }

      // Create timeline entry
      if (timelineDescription) {
        const slaMinutos = updates.sla_minutos as number | undefined;
        const slaHuman = slaMinutos 
          ? `${Math.floor(slaMinutos / 60)}h ${slaMinutos % 60}m`
          : undefined;

        await adminClient
          .from('sinistros_vida_timeline')
          .insert({
            sinistro_id: sinistro.id,
            empresa_id: sinistro.empresa_id,
            tipo_evento: updates.status ? 'status_changed' : 'sync',
            descricao: timelineDescription,
            status_anterior: oldStatus,
            status_novo: newStatus,
            source: 'rd_station',
            criado_por: sinistro.criado_por,
            usuario_nome: deal.user?.name || 'RD Station',
            meta: { 
              rd_deal_id: deal._id,
              sla_minutos: slaMinutos,
              sla_human: slaHuman,
            },
          });
      }
    }

    // Mark event as processed
    await adminClient
      .from('rd_webhook_events')
      .update({ status: 'ok', processed_at: new Date().toISOString() })
      .eq('event_id', eventId);

    return new Response(JSON.stringify({ 
      success: true, 
      updated: Object.keys(updates).length > 1,
      sinistroId: sinistro.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('rd-webhook-sinistro-vida error:', errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
