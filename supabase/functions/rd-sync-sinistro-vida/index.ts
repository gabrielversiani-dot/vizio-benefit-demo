import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_API_BASE = 'https://crm.rdstation.com/api/v1';

const PIPELINE_NAME = 'Gestão de Sinistro';
const STATUS_TO_STAGE: Record<string, number> = {
  em_analise: 0,
  pendente_documentos: 1,
  em_andamento: 2,
  enviado_operadora: 3,
  aprovado: 4,
  negado: 4,
  pago: 5,
  concluido: 5,
};

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[${requestId}] rd-sync-sinistro-vida started`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');

    if (!rdToken) {
      console.error(`[${requestId}] RD_STATION_API_TOKEN not configured`);
      return new Response(JSON.stringify({
        success: false,
        error: 'RD_STATION_API_TOKEN not configured',
        code: 'missing_token',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    const body = await req.json();
    const { sinistroId, action = 'sync' } = body;
    
    if (!sinistroId) {
      throw new Error('sinistroId is required');
    }

    console.log(`[${requestId}] Action: ${action}, Sinistro: ${sinistroId}`);

    // Get sinistro data with empresa info
    const { data: sinistro, error: sinistroError } = await adminClient
      .from('sinistros_vida')
      .select(`
        *,
        empresas:empresa_id (nome, rd_station_organization_id)
      `)
      .eq('id', sinistroId)
      .single();

    if (sinistroError || !sinistro) {
      throw new Error('Sinistro not found');
    }

    // Permission check
    const { data: userProfile } = await adminClient
      .from('profiles')
      .select('empresa_id, nome_completo')
      .eq('id', user.id)
      .single();

    const { data: isAdminVizio } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin_vizio')
      .single();

    if (!isAdminVizio && userProfile?.empresa_id !== sinistro.empresa_id) {
      throw new Error('Permission denied');
    }

    // Get RD organization ID
    let rdOrgId = sinistro.rd_org_id;
    
    // Try from empresa direct link
    if (!rdOrgId && sinistro.empresas?.rd_station_organization_id) {
      rdOrgId = sinistro.empresas.rd_station_organization_id;
    }

    // Try from linked organizations table
    if (!rdOrgId) {
      const { data: linkedOrg } = await adminClient
        .from('empresa_rd_organizacoes')
        .select('rd_organization_id')
        .eq('empresa_id', sinistro.empresa_id)
        .eq('active', true)
        .limit(1)
        .single();
      
      rdOrgId = linkedOrg?.rd_organization_id;
    }

    if (!rdOrgId) {
      console.log(`[${requestId}] No RD organization linked to empresa ${sinistro.empresa_id}`);
      
      // Update sync status
      await adminClient
        .from('sinistros_vida')
        .update({
          rd_sync_status: 'error',
          rd_sync_error: 'Empresa não possui organização RD Station vinculada',
        })
        .eq('id', sinistroId);

      return new Response(JSON.stringify({
        success: false,
        error: 'No RD Station organization linked to this company',
        code: 'no_rd_org',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get pipelines from RD
    console.log(`[${requestId}] Fetching pipelines from RD Station`);
    const pipelinesResp = await fetch(`${RD_API_BASE}/deal_pipelines?token=${rdToken}`);
    if (!pipelinesResp.ok) {
      const errText = await pipelinesResp.text();
      console.error(`[${requestId}] Failed to fetch pipelines:`, errText);
      throw new Error('Failed to fetch pipelines from RD Station');
    }
    
    const pipelinesData = await pipelinesResp.json();
    const pipeline = pipelinesData.deal_pipelines?.find(
      (p: { name: string }) => p.name.toLowerCase().includes('sinistro')
    );

    if (!pipeline) {
      console.error(`[${requestId}] Pipeline "${PIPELINE_NAME}" not found`);
      
      await adminClient
        .from('sinistros_vida')
        .update({
          rd_sync_status: 'error',
          rd_sync_error: `Pipeline "${PIPELINE_NAME}" não encontrado no RD Station`,
        })
        .eq('id', sinistroId);

      return new Response(JSON.stringify({
        success: false,
        error: `Pipeline "${PIPELINE_NAME}" not found. Please create it in RD Station.`,
        code: 'no_pipeline',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`[${requestId}] Using pipeline: ${pipeline.name} (${pipeline._id})`);

    const stages = pipeline.deal_stages || [];
    const targetStageIndex = STATUS_TO_STAGE[sinistro.status] || 0;
    const targetStage = stages[Math.min(targetStageIndex, stages.length - 1)];

    if (!targetStage) {
      throw new Error('No stages found in pipeline');
    }

    let dealId = sinistro.rd_deal_id;
    let syncResult: { created: boolean; dealId: string };

    const dealPayload = {
      name: `Sinistro - ${sinistro.beneficiario_nome}`,
      deal_stage_id: targetStage._id,
      rating: sinistro.prioridade === 'critica' ? 5 : 
              sinistro.prioridade === 'alta' ? 4 :
              sinistro.prioridade === 'media' ? 3 : 2,
      custom_fields: [
        { label: 'Tipo Sinistro', value: sinistro.tipo_sinistro },
        { label: 'Status Sistema', value: sinistro.status },
        { label: 'Valor Estimado', value: sinistro.valor_estimado || 0 },
        { label: 'Sinistro ID', value: sinistro.id },
        { label: 'Beneficiário CPF', value: sinistro.beneficiario_cpf || '' },
        { label: 'Data Ocorrência', value: sinistro.data_ocorrencia },
      ],
    };

    if (dealId) {
      // Update existing deal
      console.log(`[${requestId}] Updating existing deal ${dealId}`);
      
      const updateResp = await fetch(`${RD_API_BASE}/deals/${dealId}?token=${rdToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealPayload),
      });

      if (!updateResp.ok) {
        const errText = await updateResp.text();
        console.error(`[${requestId}] Failed to update deal:`, errText);
        
        // If deal not found, create new one
        if (updateResp.status === 404) {
          console.log(`[${requestId}] Deal not found in RD, creating new one`);
          dealId = null;
        } else {
          throw new Error(`Failed to update deal: ${errText}`);
        }
      } else {
        syncResult = { created: false, dealId };
      }
    }
    
    if (!dealId) {
      // Create new deal
      console.log(`[${requestId}] Creating new deal in RD Station`);
      
      const createPayload = {
        ...dealPayload,
        organization_id: rdOrgId,
        deal_pipeline_id: pipeline._id,
      };

      const createResp = await fetch(`${RD_API_BASE}/deals?token=${rdToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error(`[${requestId}] Failed to create deal:`, errText);
        throw new Error(`Failed to create deal: ${errText}`);
      }

      const createData = await createResp.json();
      dealId = createData._id;
      syncResult = { created: true, dealId };
      console.log(`[${requestId}] Created deal ${dealId}`);
    }

    // Update sinistro with RD data
    await adminClient
      .from('sinistros_vida')
      .update({
        rd_deal_id: dealId,
        rd_org_id: rdOrgId,
        rd_pipeline_id: pipeline._id,
        rd_stage_id: targetStage._id,
        rd_last_sync_at: new Date().toISOString(),
        rd_sync_status: 'ok',
        rd_sync_error: null,
      })
      .eq('id', sinistroId);

    // Log to timeline (idempotent via event_hash)
    const eventHash = `sync_${dealId}_${new Date().toISOString().split('T')[0]}`;
    
    const { error: timelineError } = await adminClient
      .from('sinistros_vida_timeline')
      .insert({
        sinistro_id: sinistroId,
        empresa_id: sinistro.empresa_id,
        tipo_evento: 'sync',
        descricao: syncResult!.created 
          ? 'Deal criado no RD Station CRM'
          : 'Sincronizado com RD Station CRM',
        source: 'rd_station',
        criado_por: user.id,
        usuario_nome: userProfile?.nome_completo || 'Sistema',
        event_hash: eventHash,
        meta: { 
          rd_deal_id: dealId, 
          rd_pipeline_id: pipeline._id,
          rd_stage_id: targetStage._id,
          created: syncResult!.created,
        },
      });

    // Ignore duplicate timeline errors
    if (timelineError && timelineError.code !== '23505') {
      console.error(`[${requestId}] Timeline error:`, timelineError);
    }

    console.log(`[${requestId}] Sync completed successfully`);

    return new Response(JSON.stringify({
      success: true,
      dealId,
      created: syncResult!.created,
      pipelineName: pipeline.name,
      stageName: targetStage.name,
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
