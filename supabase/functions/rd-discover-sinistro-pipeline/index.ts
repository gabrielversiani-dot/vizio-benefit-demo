import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_API_BASE = 'https://crm.rdstation.com/api/v1';

interface Pipeline {
  _id?: string;
  id?: string;
  name: string;
  deal_stages?: unknown[];
}

interface Stage {
  _id?: string;
  id?: string;
  name: string;
  deal_pipeline_id?: string;
  deal_pipeline?: { _id?: string; id?: string } | string;
  pipeline_id?: string;
  position?: number;
  order?: number;
}

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

function extractPipelines(payload: any, requestId: string): Pipeline[] {
  // Log raw payload structure for debugging
  console.log(`[${requestId}] Raw pipelines payload keys:`, Object.keys(payload || {}));
  
  const candidates = [
    payload?.deal_pipelines,
    payload?.pipelines,
    payload?.data?.deal_pipelines,
    payload?.data?.pipelines,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      console.log(`[${requestId}] Sample pipeline object keys:`, Object.keys(c[0] || {}));
      return c as Pipeline[];
    }
  }

  // Some APIs may return the array as the root payload
  if (Array.isArray(payload) && payload.length > 0) {
    console.log(`[${requestId}] Root array pipeline keys:`, Object.keys(payload[0] || {}));
    return payload as Pipeline[];
  }

  return [];
}

function getStagePipelineId(s: any): string | null {
  return (
    s?.deal_pipeline_id ??
    (typeof s?.deal_pipeline === 'string' ? s.deal_pipeline : null) ??
    s?.deal_pipeline?._id ??
    s?.deal_pipeline?.id ??
    s?.pipeline_id ??
    null
  );
}

function extractStages(payload: any): Stage[] {
  const candidates = [
    payload?.deal_stages,
    payload?.stages,
    payload?.data?.deal_stages,
    payload?.data?.stages,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c as Stage[];
  }

  if (Array.isArray(payload)) return payload as Stage[];

  return [];
}

function buildRDUrl(path: string, rdToken: string, params?: Record<string, string | undefined | null>) {
  const url = new URL(`${RD_API_BASE}${path}`);
  url.searchParams.set('token', rdToken);
  for (const [k, v] of Object.entries(params || {})) {
    if (v) url.searchParams.set(k, v);
  }
  return url.toString();
}

async function fetchRDJson(url: string, requestId: string, label: string) {
  const resp = await fetch(url);
  const text = await resp.text();

  if (!resp.ok) {
    console.error(`[${requestId}] RD ${label} error: ${resp.status} - ${text.slice(0, 600)}`);
    throw new Error(`Erro ao buscar ${label}: ${resp.status}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`[${requestId}] RD ${label} invalid JSON (first 600 chars): ${text.slice(0, 600)}`);
    throw new Error(`Resposta inválida ao buscar ${label}`);
  }
}

async function getEmpresaPrimaryOrgId(supabaseAdmin: any, empresaId: string): Promise<string | null> {
  const { data: linkedOrg } = await supabaseAdmin
    .from('empresa_rd_organizacoes')
    .select('rd_organization_id')
    .eq('empresa_id', empresaId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  return linkedOrg?.rd_organization_id ?? null;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] rd-discover-sinistro-pipeline called`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');
    if (!rdToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token RD Station não configurado',
          code: 'no_token',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Usuário não autenticado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin_vizio')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: 'Acesso negado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const body = await req.json();
    const {
      action,
      empresaId,
      pipelineId,
      stageInicialId,
      stageEmAndamentoId,
      stageConcluidoId,
    } = body;

    // Helper: resolve orgId when available
    const rdOrgId = empresaId ? await getEmpresaPrimaryOrgId(supabaseAdmin, empresaId) : null;

    // Action: list - return all pipelines (optionally with stages for a specific pipeline)
    if (action === 'list') {
      console.log(`[${requestId}] Listing pipelines (empresaId=${empresaId || 'n/a'}; org=${rdOrgId || 'n/a'}; pipelineId=${pipelineId || 'n/a'})`);

      const pipelinesData = await fetchRDJson(
        buildRDUrl('/deal_pipelines', rdToken),
        requestId,
        'pipelines'
      );

      let pipelines = extractPipelines(pipelinesData, requestId);

      console.log(`[${requestId}] Found ${pipelines.length} pipelines`);

      // Map pipelines - handle both _id and id fields
      const mappedPipelines = pipelines.map((p: any) => ({
        id: p._id || p.id || '',
        name: p.name || '',
      }));

      // If a specific pipelineId is provided, fetch stages for that pipeline
      let stages: any[] = [];
      if (pipelineId) {
        console.log(`[${requestId}] Fetching stages for pipeline ${pipelineId}`);
        
        const stagesData = await fetchRDJson(
          buildRDUrl('/deal_stages', rdToken, { deal_pipeline_id: pipelineId }),
          requestId,
          'etapas'
        );
        
        stages = extractStages(stagesData);
        
        // If no stages returned with filter, try fetching all and filtering locally
        if (stages.length === 0) {
          const allStagesData = await fetchRDJson(
            buildRDUrl('/deal_stages', rdToken),
            requestId,
            'etapas (all)'
          );
          const allStages = extractStages(allStagesData);
          stages = allStages.filter((s) => getStagePipelineId(s) === pipelineId);
        }
        
        console.log(`[${requestId}] Found ${stages.length} stages for pipeline ${pipelineId}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          requestId,
          pipelines: mappedPipelines,
          stages: stages.map((s) => ({
            id: s._id || s.id || '',
            name: s.name || '',
            pipelineId: getStagePipelineId(s) || pipelineId,
            position: s.position ?? s.order ?? 0,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: stages - fetch stages for a specific pipeline
    if (action === 'stages') {
      if (!pipelineId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'pipelineId é obrigatório',
          code: 'MISSING_PIPELINE_ID',
          requestId,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      console.log(`[${requestId}] Fetching stages for pipeline ${pipelineId}`);
      
      const stagesData = await fetchRDJson(
        buildRDUrl('/deal_stages', rdToken, { deal_pipeline_id: pipelineId }),
        requestId,
        'etapas'
      );
      
      let stages = extractStages(stagesData);
      
      // Fallback: fetch all and filter
      if (stages.length === 0) {
        const allStagesData = await fetchRDJson(
          buildRDUrl('/deal_stages', rdToken),
          requestId,
          'etapas (all)'
        );
        const allStages = extractStages(allStagesData);
        stages = allStages.filter((s) => getStagePipelineId(s) === pipelineId);
      }

      stages.sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));
      
      console.log(`[${requestId}] Found ${stages.length} stages for pipeline ${pipelineId}`);

      return new Response(
        JSON.stringify({
          success: true,
          requestId,
          stages: stages.map((s) => ({
            id: s._id || s.id || '',
            name: s.name || '',
            pipelineId: getStagePipelineId(s) || pipelineId,
            position: s.position ?? s.order ?? 0,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: discover - auto-detect "Gestão de Sinistro" pipeline
    if (action === 'discover') {
      console.log(`[${requestId}] Auto-discovering sinistro pipeline for empresa ${empresaId}`);

      if (!empresaId) {
        return new Response(JSON.stringify({ success: false, error: 'empresaId é obrigatório' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }


      const pipelinesData = await fetchRDJson(
        buildRDUrl('/deal_pipelines', rdToken),
        requestId,
        'pipelines'
      );

      let pipelines = extractPipelines(pipelinesData, requestId);

      console.log(`[${requestId}] Available pipelines:`, pipelines.map((p) => p.name));

      const targetName = norm('Gestão de Sinistro');
      let sinistroP = pipelines.find((p) => norm(p.name) === targetName);

      // Fallback: contains "sinistro" / "vida"
      if (!sinistroP) {
        sinistroP = pipelines.find((p) => norm(p.name).includes('sinistro'));
      }
      if (!sinistroP) {
        sinistroP = pipelines.find((p) => norm(p.name).includes('vida'));
      }

      if (!sinistroP) {
        console.log(`[${requestId}] Pipeline "Gestão de Sinistro" não encontrado`);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Pipeline "Gestão de Sinistro" não encontrado no RD Station. Crie o funil ou selecione manualmente.',
            code: 'pipeline_not_found',
            availablePipelines: pipelines.map((p) => ({ id: p._id || p.id, name: p.name })),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      const sinistroId = sinistroP._id || sinistroP.id || '';
      console.log(`[${requestId}] Found pipeline: ${sinistroP.name} (${sinistroId})`);

      // First try: ask RD only for stages from this pipeline (when supported)
      let stagesData = await fetchRDJson(
        buildRDUrl('/deal_stages', rdToken, { deal_pipeline_id: sinistroId }),
        requestId,
        'etapas'
      );

      let allStages = extractStages(stagesData);

      // Fallback: fetch all stages and filter locally
      if (allStages.length === 0) {
        const stagesData2 = await fetchRDJson(buildRDUrl('/deal_stages', rdToken), requestId, 'etapas');
        allStages = extractStages(stagesData2);
      }

      const pipelineStages = allStages
        .filter((s) => getStagePipelineId(s) === sinistroId || allStages.length <= 20) // small responses may already be scoped
        .sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));

      console.log(`[${requestId}] Pipeline stages:`, pipelineStages.map((s) => s.name));

      // Stage inicial: "Abertura de Sinistro" (fallback: first by position/order)
      const stageInicial =
        pipelineStages.find((s) => norm(s.name) === norm('Abertura de Sinistro')) ||
        pipelineStages.find((s) => norm(s.name).includes('abertura')) ||
        pipelineStages[0];

      const stageEmAndamento = pipelineStages.find(
        (s) => norm(s.name) === norm('Em Andamento') || norm(s.name).includes('andamento') || norm(s.name).includes('analise')
      );

      const stageConcluido = pipelineStages.find(
        (s) => norm(s.name) === norm('Concluído') || norm(s.name).includes('conclu')
      );

      if (!stageInicial) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Nenhuma etapa encontrada no pipeline selecionado',
            code: 'no_stages',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Save to database
      const stageInicialId = stageInicial._id || stageInicial.id || '';
      const stageEmAndamentoIdVal = stageEmAndamento?._id || stageEmAndamento?.id || null;
      const stageConcluidoIdVal = stageConcluido?._id || stageConcluido?.id || null;
      
      const configData = {
        empresa_id: empresaId,
        sinistro_pipeline_id: sinistroId,
        sinistro_pipeline_name: sinistroP.name,
        sinistro_stage_inicial_id: stageInicialId,
        sinistro_stage_inicial_name: stageInicial.name,
        sinistro_stage_em_andamento_id: stageEmAndamentoIdVal,
        sinistro_stage_em_andamento_name: stageEmAndamento?.name || null,
        sinistro_stage_concluido_id: stageConcluidoIdVal,
        sinistro_stage_concluido_name: stageConcluido?.name || null,
      };

      const { error: upsertError } = await supabaseAdmin
        .from('empresa_rd_sinistro_config')
        .upsert(configData, { onConflict: 'empresa_id' });

      if (upsertError) {
        console.error(`[${requestId}] Error saving config:`, upsertError);
        throw new Error(`Erro ao salvar configuração: ${upsertError.message}`);
      }

      console.log(
        `[${requestId}] Selected pipeline/stages: pipeline=${sinistroP._id}, inicial=${stageInicial._id}, andamento=${stageEmAndamento?._id || 'n/a'}, concluido=${stageConcluido?._id || 'n/a'}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          config: {
            pipeline: { id: sinistroP._id, name: sinistroP.name },
            stageInicial: { id: stageInicial._id, name: stageInicial.name },
            stageEmAndamento: stageEmAndamento ? { id: stageEmAndamento._id, name: stageEmAndamento.name } : null,
            stageConcluido: stageConcluido ? { id: stageConcluido._id, name: stageConcluido.name } : null,
          },
          allStages: pipelineStages.map((s) => ({ id: s._id, name: s.name })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: save - manually save configuration
    if (action === 'save') {
      console.log(`[${requestId}] Saving manual config for empresa ${empresaId}`);

      if (!empresaId || !pipelineId || !stageInicialId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'empresaId, pipelineId e stageInicialId são obrigatórios',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const pipelinesData = await fetchRDJson(buildRDUrl('/deal_pipelines', rdToken), requestId, 'pipelines');
      let pipelines = extractPipelines(pipelinesData, requestId);
      const pipeline = pipelines.find((p) => (p._id || p.id) === pipelineId);

      const stagesData = await fetchRDJson(buildRDUrl('/deal_stages', rdToken, { deal_pipeline_id: pipelineId }), requestId, 'etapas');
      let stages = extractStages(stagesData);
      if (stages.length === 0) {
        const stagesData2 = await fetchRDJson(buildRDUrl('/deal_stages', rdToken), requestId, 'etapas');
        stages = extractStages(stagesData2);
      }

      const stageInicialFound = stages.find((s) => (s._id || s.id) === stageInicialId);
      const stageEmAndamentoFound = stageEmAndamentoId ? stages.find((s) => (s._id || s.id) === stageEmAndamentoId) : null;
      const stageConcluidoFound = stageConcluidoId ? stages.find((s) => (s._id || s.id) === stageConcluidoId) : null;

      const configData = {
        empresa_id: empresaId,
        sinistro_pipeline_id: pipelineId,
        sinistro_pipeline_name: pipeline?.name || null,
        sinistro_stage_inicial_id: stageInicialId,
        sinistro_stage_inicial_name: stageInicialFound?.name || null,
        sinistro_stage_em_andamento_id: stageEmAndamentoId || null,
        sinistro_stage_em_andamento_name: stageEmAndamentoFound?.name || null,
        sinistro_stage_concluido_id: stageConcluidoId || null,
        sinistro_stage_concluido_name: stageConcluidoFound?.name || null,
      };

      const { error: upsertError } = await supabaseAdmin
        .from('empresa_rd_sinistro_config')
        .upsert(configData, { onConflict: 'empresa_id' });

      if (upsertError) {
        console.error(`[${requestId}] Error saving config:`, upsertError);
        throw new Error(`Erro ao salvar configuração: ${upsertError.message}`);
      }

      console.log(
        `[${requestId}] Manual selection: pipeline=${pipelineId}, inicial=${stageInicialId}, andamento=${stageEmAndamentoId || 'n/a'}, concluido=${stageConcluidoId || 'n/a'}`
      );

      return new Response(JSON.stringify({ success: true, config: configData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get - get current config
    if (action === 'get') {
      const { data: config } = await supabaseAdmin
        .from('empresa_rd_sinistro_config')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle();

      return new Response(JSON.stringify({ success: true, config: config || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Ação inválida. Use: list, discover, save, get',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno';
    console.error(`[${requestId}] Error:`, err);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
