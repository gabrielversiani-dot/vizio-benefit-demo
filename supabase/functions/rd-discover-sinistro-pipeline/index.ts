import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_API_BASE = 'https://crm.rdstation.com/api/v1';

interface Pipeline {
  _id: string;
  name: string;
}

interface Stage {
  _id: string;
  name: string;
  deal_pipeline_id?: string;
  nickname?: string;
  position?: number;
  order?: number;
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
      return new Response(JSON.stringify({
        success: false,
        error: 'Token RD Station não configurado',
        code: 'no_token',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabase = createClient(
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
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Usuário não autenticado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
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
    const { action, empresaId, pipelineId, stageInicialId, stageEmAndamentoId, stageConcluidoId } = body;

    // Action: list - return all pipelines and stages
    if (action === 'list') {
      console.log(`[${requestId}] Listing all pipelines and stages`);
      
      // Fetch pipelines
      const pipelinesResp = await fetch(`${RD_API_BASE}/deal_pipelines?token=${rdToken}`);
      if (!pipelinesResp.ok) {
        throw new Error(`Erro ao buscar pipelines: ${pipelinesResp.status}`);
      }
      const pipelinesData = await pipelinesResp.json();
      const pipelines: Pipeline[] = pipelinesData.deal_pipelines || [];
      
      // Fetch stages
      const stagesResp = await fetch(`${RD_API_BASE}/deal_stages?token=${rdToken}`);
      if (!stagesResp.ok) {
        throw new Error(`Erro ao buscar etapas: ${stagesResp.status}`);
      }
      const stagesData = await stagesResp.json();
      const stages: Stage[] = stagesData.deal_stages || [];
      
      console.log(`[${requestId}] Found ${pipelines.length} pipelines and ${stages.length} stages`);
      
      return new Response(JSON.stringify({
        success: true,
        pipelines: pipelines.map(p => ({ id: p._id, name: p.name })),
        stages: stages.map(s => ({
          id: s._id,
          name: s.name,
          pipelineId: s.deal_pipeline_id,
          position: s.position ?? s.order ?? 0,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: discover - auto-detect "Gestão de Sinistro" pipeline
    if (action === 'discover') {
      console.log(`[${requestId}] Auto-discovering sinistro pipeline for empresa ${empresaId}`);
      
      if (!empresaId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'empresaId é obrigatório',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      
      // Fetch pipelines
      const pipelinesResp = await fetch(`${RD_API_BASE}/deal_pipelines?token=${rdToken}`);
      if (!pipelinesResp.ok) {
        throw new Error(`Erro ao buscar pipelines: ${pipelinesResp.status}`);
      }
      const pipelinesData = await pipelinesResp.json();
      const pipelines: Pipeline[] = pipelinesData.deal_pipelines || [];
      
      console.log(`[${requestId}] Available pipelines:`, pipelines.map(p => p.name));
      
      // Find "Gestão de Sinistro" pipeline (case-insensitive, trimmed)
      const targetName = 'gestão de sinistro';
      let sinistroP = pipelines.find(
        p => p.name.trim().toLowerCase() === targetName
      );
      
      // Fallback: contains "sinistro"
      if (!sinistroP) {
        sinistroP = pipelines.find(
          p => p.name.toLowerCase().includes('sinistro')
        );
      }
      
      if (!sinistroP) {
        console.log(`[${requestId}] Pipeline "Gestão de Sinistro" não encontrado`);
        return new Response(JSON.stringify({
          success: false,
          error: 'Pipeline "Gestão de Sinistro" não encontrado no RD Station. Crie o funil ou selecione manualmente.',
          code: 'pipeline_not_found',
          availablePipelines: pipelines.map(p => ({ id: p._id, name: p.name })),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      
      console.log(`[${requestId}] Found pipeline: ${sinistroP.name} (${sinistroP._id})`);
      
      // Fetch stages
      const stagesResp = await fetch(`${RD_API_BASE}/deal_stages?token=${rdToken}`);
      if (!stagesResp.ok) {
        throw new Error(`Erro ao buscar etapas: ${stagesResp.status}`);
      }
      const stagesData = await stagesResp.json();
      const allStages: Stage[] = stagesData.deal_stages || [];
      
      // Filter stages for this pipeline
      const pipelineStages = allStages.filter(s => s.deal_pipeline_id === sinistroP!._id);
      pipelineStages.sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));
      
      console.log(`[${requestId}] Pipeline stages:`, pipelineStages.map(s => s.name));
      
      // Find specific stages
      const stageInicial = pipelineStages.find(
        s => s.name.toLowerCase().includes('abertura')
      ) || pipelineStages[0];
      
      const stageEmAndamento = pipelineStages.find(
        s => s.name.toLowerCase().includes('andamento') || s.name.toLowerCase().includes('análise')
      );
      
      const stageConcluido = pipelineStages.find(
        s => s.name.toLowerCase().includes('conclu') || s.name.toLowerCase().includes('pago')
      );
      
      if (!stageInicial) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Nenhuma etapa encontrada no pipeline',
          code: 'no_stages',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      
      // Save to database
      const configData = {
        empresa_id: empresaId,
        sinistro_pipeline_id: sinistroP._id,
        sinistro_pipeline_name: sinistroP.name,
        sinistro_stage_inicial_id: stageInicial._id,
        sinistro_stage_inicial_name: stageInicial.name,
        sinistro_stage_em_andamento_id: stageEmAndamento?._id || null,
        sinistro_stage_em_andamento_name: stageEmAndamento?.name || null,
        sinistro_stage_concluido_id: stageConcluido?._id || null,
        sinistro_stage_concluido_name: stageConcluido?.name || null,
      };
      
      const { error: upsertError } = await supabase
        .from('empresa_rd_sinistro_config')
        .upsert(configData, { onConflict: 'empresa_id' });
      
      if (upsertError) {
        console.error(`[${requestId}] Error saving config:`, upsertError);
        throw new Error(`Erro ao salvar configuração: ${upsertError.message}`);
      }
      
      console.log(`[${requestId}] Config saved for empresa ${empresaId}`);
      
      return new Response(JSON.stringify({
        success: true,
        config: {
          pipeline: { id: sinistroP._id, name: sinistroP.name },
          stageInicial: { id: stageInicial._id, name: stageInicial.name },
          stageEmAndamento: stageEmAndamento ? { id: stageEmAndamento._id, name: stageEmAndamento.name } : null,
          stageConcluido: stageConcluido ? { id: stageConcluido._id, name: stageConcluido.name } : null,
        },
        allStages: pipelineStages.map(s => ({ id: s._id, name: s.name })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      
      // Fetch pipeline and stage names
      const pipelinesResp = await fetch(`${RD_API_BASE}/deal_pipelines?token=${rdToken}`);
      const pipelinesData = await pipelinesResp.json();
      const pipelines: Pipeline[] = pipelinesData.deal_pipelines || [];
      const pipeline = pipelines.find(p => p._id === pipelineId);
      
      const stagesResp = await fetch(`${RD_API_BASE}/deal_stages?token=${rdToken}`);
      const stagesData = await stagesResp.json();
      const stages: Stage[] = stagesData.deal_stages || [];
      
      const stageInicial = stages.find(s => s._id === stageInicialId);
      const stageEmAndamento = stageEmAndamentoId ? stages.find(s => s._id === stageEmAndamentoId) : null;
      const stageConcluido = stageConcluidoId ? stages.find(s => s._id === stageConcluidoId) : null;
      
      const configData = {
        empresa_id: empresaId,
        sinistro_pipeline_id: pipelineId,
        sinistro_pipeline_name: pipeline?.name || null,
        sinistro_stage_inicial_id: stageInicialId,
        sinistro_stage_inicial_name: stageInicial?.name || null,
        sinistro_stage_em_andamento_id: stageEmAndamentoId || null,
        sinistro_stage_em_andamento_name: stageEmAndamento?.name || null,
        sinistro_stage_concluido_id: stageConcluidoId || null,
        sinistro_stage_concluido_name: stageConcluido?.name || null,
      };
      
      const { error: upsertError } = await supabase
        .from('empresa_rd_sinistro_config')
        .upsert(configData, { onConflict: 'empresa_id' });
      
      if (upsertError) {
        console.error(`[${requestId}] Error saving config:`, upsertError);
        throw new Error(`Erro ao salvar configuração: ${upsertError.message}`);
      }
      
      console.log(`[${requestId}] Manual config saved for empresa ${empresaId}`);
      
      return new Response(JSON.stringify({
        success: true,
        config: configData,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get - get current config
    if (action === 'get') {
      const { data: config } = await supabase
        .from('empresa_rd_sinistro_config')
        .select('*')
        .eq('empresa_id', empresaId)
        .single();
      
      return new Response(JSON.stringify({
        success: true,
        config: config || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Ação inválida. Use: list, discover, save, get',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno';
    console.error(`[${requestId}] Error:`, err);
    return new Response(JSON.stringify({
      success: false,
      error: errorMsg,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
