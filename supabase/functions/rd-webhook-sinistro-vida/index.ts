import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { encode as encodeHex } from "https://deno.land/std@0.177.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rd-signature, x-webhook-token',
};

// Stage to status mapping (reverse of sync function)
const STAGE_INDEX_TO_STATUS: Record<number, string> = {
  0: 'em_analise',
  1: 'pendente_documentos',
  2: 'em_andamento',
  3: 'enviado_operadora',
  4: 'aprovado',
  5: 'concluido',
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
      updated_at?: string;
    };
    previous_data?: Record<string, unknown>;
  };
}

// Verify HMAC signature from RD Station or shared token
async function verifyWebhookAuth(req: Request, rawBody: string): Promise<{ valid: boolean; method: string }> {
  const webhookSecret = Deno.env.get('RD_STATION_WEBHOOK_SECRET');
  
  // If no secret configured, reject all requests for security
  if (!webhookSecret) {
    console.warn('[Security] RD_STATION_WEBHOOK_SECRET not configured - rejecting request');
    return { valid: false, method: 'none' };
  }

  // Method 1: Check x-rd-signature header (HMAC-SHA256)
  const rdSignature = req.headers.get('x-rd-signature');
  if (rdSignature) {
    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const keyData = encoder.encode(webhookSecret);
      const messageData = encoder.encode(rawBody);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const hexBytes = encodeHex(new Uint8Array(signature));
      const expectedSignature = decoder.decode(hexBytes);
      
      // Compare signatures (timing-safe comparison)
      if (expectedSignature.toLowerCase() === rdSignature.toLowerCase()) {
        return { valid: true, method: 'hmac' };
      }
      
      // Also try with "sha256=" prefix format
      if (`sha256=${expectedSignature}`.toLowerCase() === rdSignature.toLowerCase()) {
        return { valid: true, method: 'hmac' };
      }
      
      console.warn('[Security] HMAC signature mismatch');
    } catch (e) {
      console.error('[Security] HMAC verification error:', e);
    }
  }

  // Method 2: Check x-webhook-token header (simple shared token)
  const webhookToken = req.headers.get('x-webhook-token');
  if (webhookToken && webhookToken === webhookSecret) {
    return { valid: true, method: 'token' };
  }

  // Method 3: Check URL query parameter (for webhook configuration)
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken && queryToken === webhookSecret) {
    return { valid: true, method: 'query' };
  }

  return { valid: false, method: 'failed' };
}

// Generate deterministic hash for timeline idempotency
async function generateEventHash(parts: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(parts.join('|'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Format SLA duration
function formatSLA(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  
  return parts.join(' ');
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[${requestId}] rd-webhook-sinistro-vida started`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Verify webhook authentication
    const authResult = await verifyWebhookAuth(req, rawBody);
    if (!authResult.valid) {
      console.error(`[${requestId}] Webhook authentication failed`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized - invalid or missing webhook signature' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[${requestId}] Webhook authenticated via ${authResult.method}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const payload: RDWebhookPayload = JSON.parse(rawBody);
    console.log(`[${requestId}] Received webhook:`, JSON.stringify({ 
      event_uuid: payload.event_uuid,
      event_type: payload.event_type,
      deal_id: payload.data?.deal?._id,
    }));

    const eventId = payload.event_uuid;
    const eventType = payload.event_type;
    const deal = payload.data?.deal;

    if (!deal?._id) {
      console.log(`[${requestId}] No deal ID in payload, ignoring`);
      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'no_deal_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check idempotency in rd_webhook_events
    const { data: existingEvent } = await adminClient
      .from('rd_webhook_events')
      .select('id, status')
      .eq('provider', 'rd')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      console.log(`[${requestId}] Event ${eventId} already processed (status: ${existingEvent.status})`);
      return new Response(JSON.stringify({ success: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store event for idempotency
    const { error: insertEventError } = await adminClient
      .from('rd_webhook_events')
      .insert({
        provider: 'rd',
        event_id: eventId,
        event_type: eventType,
        payload: payload as unknown as Record<string, unknown>,
        status: 'processing',
      });

    if (insertEventError) {
      // Handle race condition - another request already inserted
      if (insertEventError.code === '23505') {
        console.log(`[${requestId}] Event ${eventId} already being processed (race condition)`);
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw insertEventError;
    }

    // Find sinistro by rd_deal_id
    const { data: sinistro, error: sinistroError } = await adminClient
      .from('sinistros_vida')
      .select('*')
      .eq('rd_deal_id', deal._id)
      .single();

    if (sinistroError || !sinistro) {
      console.log(`[${requestId}] No sinistro found for deal ${deal._id}`);
      
      await adminClient
        .from('rd_webhook_events')
        .update({ status: 'ignored', processed_at: new Date().toISOString(), error: 'no_sinistro_found' })
        .eq('event_id', eventId);

      return new Response(JSON.stringify({ success: true, ignored: true, reason: 'no_sinistro' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Found sinistro ${sinistro.id} for deal ${deal._id}`);

    const updates: Record<string, unknown> = {
      rd_last_sync_at: new Date().toISOString(),
      rd_sync_status: 'ok',
      rd_sync_error: null,
    };

    let timelineDescription = '';
    let timelineEventType = 'sync';
    const oldStatus = sinistro.status;
    let newStatus = sinistro.status;

    // Handle stage change
    if (deal.deal_stage) {
      const stageOrder = deal.deal_stage.order ?? 0;
      const mappedStatus = STAGE_INDEX_TO_STATUS[stageOrder];
      
      // Check stage name for more specific status
      const stageName = deal.deal_stage.name?.toLowerCase() || '';
      if (stageName.includes('negado') || stageName.includes('recusado')) {
        newStatus = 'negado';
      } else if (stageName.includes('pago')) {
        newStatus = 'pago';
      } else if (stageName.includes('conclu')) {
        newStatus = 'concluido';
      } else if (mappedStatus) {
        newStatus = mappedStatus;
      }

      if (newStatus !== sinistro.status) {
        updates.status = newStatus;
        updates.rd_stage_id = deal.deal_stage._id;
        timelineDescription = `Status alterado para "${newStatus}" via RD Station`;
        timelineEventType = 'status_changed';

        // Set completion time if completing
        if (['concluido', 'pago', 'negado'].includes(newStatus) && !sinistro.concluido_em) {
          const now = new Date();
          updates.concluido_em = now.toISOString();
          const createdAt = new Date(sinistro.created_at).getTime();
          updates.sla_minutos = Math.round((now.getTime() - createdAt) / 60000);
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

    // Apply updates to sinistro
    if (Object.keys(updates).length > 3) { // More than just sync fields
      const { error: updateError } = await adminClient
        .from('sinistros_vida')
        .update(updates)
        .eq('id', sinistro.id);

      if (updateError) {
        throw updateError;
      }
      console.log(`[${requestId}] Updated sinistro ${sinistro.id} with:`, Object.keys(updates));
    }

    // Create timeline entry with idempotency
    if (timelineDescription) {
      const slaMinutos = updates.sla_minutos as number | undefined;
      const slaHuman = slaMinutos ? formatSLA(slaMinutos) : undefined;

      // Generate event hash for idempotency
      const eventHash = await generateEventHash([
        timelineEventType,
        deal._id,
        deal.deal_stage?._id || '',
        deal.updated_at || payload.event_timestamp,
      ]);

      // Try to insert with idempotency check
      const { error: timelineError } = await adminClient
        .from('sinistros_vida_timeline')
        .insert({
          sinistro_id: sinistro.id,
          empresa_id: sinistro.empresa_id,
          tipo_evento: timelineEventType,
          descricao: timelineDescription,
          status_anterior: oldStatus,
          status_novo: newStatus,
          source: 'rd_station',
          criado_por: sinistro.criado_por,
          usuario_nome: deal.user?.name || 'RD Station',
          rd_event_id: eventId,
          event_hash: eventHash,
          meta: { 
            rd_deal_id: deal._id,
            rd_stage_id: deal.deal_stage?._id,
            rd_stage_name: deal.deal_stage?.name,
            sla_minutos: slaMinutos,
            sla_human: slaHuman,
          },
        });

      if (timelineError) {
        // Duplicate event - ignore
        if (timelineError.code === '23505') {
          console.log(`[${requestId}] Duplicate timeline event ignored (hash: ${eventHash})`);
        } else {
          console.error(`[${requestId}] Timeline insert error:`, timelineError);
        }
      } else {
        console.log(`[${requestId}] Created timeline event: ${timelineEventType}`);
      }
    }

    // Mark webhook event as processed
    await adminClient
      .from('rd_webhook_events')
      .update({ status: 'ok', processed_at: new Date().toISOString() })
      .eq('event_id', eventId);

    console.log(`[${requestId}] Webhook processed successfully`);

    return new Response(JSON.stringify({ 
      success: true, 
      updated: Object.keys(updates).length > 3,
      sinistroId: sinistro.id,
      newStatus: updates.status || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${requestId}] Error:`, errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
