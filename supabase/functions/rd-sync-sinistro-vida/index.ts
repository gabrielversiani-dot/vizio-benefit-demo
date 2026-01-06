import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_API_BASE = 'https://crm.rdstation.com/api/v1';

// Pipeline and stage mappings - should be configured based on actual RD Station setup
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');

    if (!rdToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'RD_STATION_API_TOKEN not configured',
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
    const { sinistroId } = body;
    
    if (!sinistroId) {
      throw new Error('sinistroId is required');
    }

    // Get sinistro data
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
      .select('empresa_id')
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

    // Get RD organization ID from empresa
    let rdOrgId = sinistro.rd_org_id;
    if (!rdOrgId && sinistro.empresas?.rd_station_organization_id) {
      rdOrgId = sinistro.empresas.rd_station_organization_id;
    }

    // Get RD org from linked table if not found
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
      throw new Error('No RD Station organization linked to this company');
    }

    // Get or find pipeline
    const pipelinesResp = await fetch(`${RD_API_BASE}/deal_pipelines?token=${rdToken}`);
    if (!pipelinesResp.ok) {
      throw new Error('Failed to fetch pipelines from RD Station');
    }
    
    const pipelinesData = await pipelinesResp.json();
    const pipeline = pipelinesData.deal_pipelines?.find(
      (p: { name: string }) => p.name.toLowerCase().includes('sinistro')
    );

    if (!pipeline) {
      throw new Error(`Pipeline "${PIPELINE_NAME}" not found in RD Station. Please create it first.`);
    }

    const stages = pipeline.deal_stages || [];
    const targetStageIndex = STATUS_TO_STAGE[sinistro.status] || 0;
    const targetStage = stages[Math.min(targetStageIndex, stages.length - 1)];

    if (!targetStage) {
      throw new Error('No stages found in pipeline');
    }

    let dealId = sinistro.rd_deal_id;
    let syncResult: { created: boolean; dealId: string };

    if (dealId) {
      // Update existing deal
      const updateResp = await fetch(`${RD_API_BASE}/deals/${dealId}?token=${rdToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Sinistro - ${sinistro.beneficiario_nome}`,
          deal_stage_id: targetStage._id,
          deal_source_id: null,
          custom_fields: [
            { label: 'Tipo Sinistro', value: sinistro.tipo_sinistro },
            { label: 'Status Sistema', value: sinistro.status },
            { label: 'Valor Estimado', value: sinistro.valor_estimado || 0 },
          ],
        }),
      });

      if (!updateResp.ok) {
        const errText = await updateResp.text();
        throw new Error(`Failed to update deal: ${errText}`);
      }

      syncResult = { created: false, dealId };
    } else {
      // Create new deal
      const createResp = await fetch(`${RD_API_BASE}/deals?token=${rdToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Sinistro - ${sinistro.beneficiario_nome}`,
          organization_id: rdOrgId,
          deal_pipeline_id: pipeline._id,
          deal_stage_id: targetStage._id,
          rating: sinistro.prioridade === 'critica' ? 5 : 
                  sinistro.prioridade === 'alta' ? 4 :
                  sinistro.prioridade === 'media' ? 3 : 2,
          custom_fields: [
            { label: 'Tipo Sinistro', value: sinistro.tipo_sinistro },
            { label: 'Status Sistema', value: sinistro.status },
            { label: 'Valor Estimado', value: sinistro.valor_estimado || 0 },
            { label: 'Sinistro ID', value: sinistro.id },
          ],
        }),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        throw new Error(`Failed to create deal: ${errText}`);
      }

      const createData = await createResp.json();
      dealId = createData._id;
      syncResult = { created: true, dealId };
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

    // Log to timeline
    const { data: profile } = await adminClient
      .from('profiles')
      .select('nome_completo')
      .eq('id', user.id)
      .single();

    await adminClient
      .from('sinistros_vida_timeline')
      .insert({
        sinistro_id: sinistroId,
        empresa_id: sinistro.empresa_id,
        tipo_evento: 'sync',
        descricao: syncResult.created 
          ? 'Deal criado no RD Station CRM'
          : 'Sincronizado com RD Station CRM',
        source: 'rd_station',
        criado_por: user.id,
        usuario_nome: profile?.nome_completo || 'Sistema',
        meta: { rd_deal_id: dealId, created: syncResult.created },
      });

    return new Response(JSON.stringify({
      success: true,
      dealId,
      created: syncResult.created,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('rd-sync-sinistro-vida error:', errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
