import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_API_BASE = 'https://crm.rdstation.com/api/v1';

const PIPELINE_NAME = 'Gestão de Sinistro';

// Map RD Stage index to internal status
const STAGE_INDEX_TO_STATUS: Record<number, string> = {
  0: 'em_analise',
  1: 'pendente_documentos',
  2: 'em_andamento',
  3: 'enviado_operadora',
  4: 'aprovado',
  5: 'pago',
};

// Map internal status to stage index
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

// Final statuses that trigger SLA calculation
const FINAL_STATUSES = ['aprovado', 'negado', 'pago', 'concluido'];

interface RDDeal {
  _id: string;
  name: string;
  rating?: number;
  deal_stage?: {
    _id: string;
    name: string;
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
  created_at: string;
  updated_at?: string;
  custom_fields?: Array<{ label: string; value: unknown }>;
}

function generateEventHash(type: string, dealId: string, stageId: string | null, timestamp: string): string {
  const dateKey = timestamp.split('T')[0];
  return `${type}_${dealId}_${stageId || 'none'}_${dateKey}`;
}

function mapStageToStatus(stageIndex: number): string {
  return STAGE_INDEX_TO_STATUS[stageIndex] || 'em_analise';
}

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
    const { sinistroId, empresaId, action = 'push' } = body;

    console.log(`[${requestId}] Action: ${action}, Sinistro: ${sinistroId || 'N/A'}, Empresa: ${empresaId || 'N/A'}`);

    // Get user profile and check permissions
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

    // ============= ACTION: PULL (Import from RD -> System) =============
    if (action === 'pull') {
      if (!empresaId) {
        throw new Error('empresaId is required for pull action');
      }

      // Permission check for pull
      if (!isAdminVizio && userProfile?.empresa_id !== empresaId) {
        throw new Error('Permission denied for this empresa');
      }

      console.log(`[${requestId}] Starting PULL sync for empresa ${empresaId}`);

      // Get empresa info
      const { data: empresa, error: empresaError } = await adminClient
        .from('empresas')
        .select('id, nome')
        .eq('id', empresaId)
        .single();

      if (empresaError || !empresa) {
        throw new Error('Empresa not found');
      }

      // Get linked RD organizations
      const { data: linkedOrgs, error: linkedOrgsError } = await adminClient
        .from('empresa_rd_organizacoes')
        .select('rd_organization_id, rd_organization_name')
        .eq('empresa_id', empresaId)
        .eq('active', true);

      if (linkedOrgsError) {
        throw new Error(`Failed to get linked orgs: ${linkedOrgsError.message}`);
      }

      if (!linkedOrgs || linkedOrgs.length === 0) {
        console.log(`[${requestId}] No RD organizations linked to empresa ${empresaId}`);
        return new Response(JSON.stringify({
          success: false,
          error: 'Nenhuma organização RD Station vinculada a esta empresa',
          code: 'no_rd_org',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      console.log(`[${requestId}] Found ${linkedOrgs.length} linked organizations`);

      // Get the Sinistro pipeline
      // Check if pipeline ID is configured in secrets
      const configuredPipelineId = Deno.env.get('RD_SINISTRO_PIPELINE_ID');
      
      console.log(`[${requestId}] Fetching pipelines from RD Station`);
      const pipelinesResp = await fetch(`${RD_API_BASE}/deal_pipelines?token=${rdToken}`);
      if (!pipelinesResp.ok) {
        const errText = await pipelinesResp.text();
        console.error(`[${requestId}] Failed to fetch pipelines:`, errText);
        throw new Error('Failed to fetch pipelines from RD Station');
      }

      const pipelinesData = await pipelinesResp.json();
      const allPipelines = pipelinesData.deal_pipelines || [];
      
      // Log all available pipelines for debugging
      console.log(`[${requestId}] Available pipelines in RD Station:`);
      allPipelines.forEach((p: { _id: string; name: string }) => {
        console.log(`[${requestId}]   - ${p.name} (ID: ${p._id})`);
      });
      
      // Find pipeline: by configured ID, or by name containing 'sinistro' or 'vida'
      let pipeline = null;
      
      if (configuredPipelineId) {
        pipeline = allPipelines.find((p: { _id: string }) => p._id === configuredPipelineId);
        if (pipeline) {
          console.log(`[${requestId}] Using configured pipeline: ${pipeline.name} (${pipeline._id})`);
        }
      }
      
      if (!pipeline) {
        // Try to find by name patterns
        pipeline = allPipelines.find((p: { name: string }) => 
          p.name.toLowerCase().includes('sinistro')
        );
      }
      
      if (!pipeline) {
        pipeline = allPipelines.find((p: { name: string }) => 
          p.name.toLowerCase().includes('vida')
        );
      }

      if (!pipeline) {
        const pipelineNames = allPipelines.map((p: { name: string }) => p.name).join(', ');
        console.error(`[${requestId}] Pipeline for Sinistros Vida not found. Available: ${pipelineNames}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Pipeline para Sinistros Vida não encontrado. Configure RD_SINISTRO_PIPELINE_ID ou crie um funil com "Sinistro" ou "Vida" no nome. Disponíveis: ${pipelineNames}`,
          code: 'no_pipeline',
          availablePipelines: allPipelines.map((p: { _id: string; name: string }) => ({ id: p._id, name: p.name })),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      console.log(`[${requestId}] Using pipeline: ${pipeline.name} (${pipeline._id})`);

      const stages = pipeline.deal_stages || [];
      const stageIdToIndex: Record<string, number> = {};
      stages.forEach((stage: { _id: string }, index: number) => {
        stageIdToIndex[stage._id] = index;
      });

      // Collect all deals from all linked organizations
      const allDeals: (RDDeal & { rdOrgId: string })[] = [];

      for (const org of linkedOrgs) {
        console.log(`[${requestId}] Fetching deals for org ${org.rd_organization_id} (${org.rd_organization_name})`);

        try {
          // Fetch deals from this organization in the sinistro pipeline
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const dealsUrl = `${RD_API_BASE}/deals?token=${rdToken}&deal_pipeline_id=${pipeline._id}&organization_id=${org.rd_organization_id}&page=${page}&limit=100`;
            const dealsResp = await fetch(dealsUrl);

            if (!dealsResp.ok) {
              console.error(`[${requestId}] Failed to fetch deals for org ${org.rd_organization_id}: ${dealsResp.status}`);
              break;
            }

            const dealsData = await dealsResp.json();
            const deals: RDDeal[] = dealsData.deals || [];

            console.log(`[${requestId}] Page ${page}: Found ${deals.length} deals`);

            for (const deal of deals) {
              // Only include deals that belong to this organization
              if (deal.organization?._id === org.rd_organization_id) {
                allDeals.push({ ...deal, rdOrgId: org.rd_organization_id });
              }
            }

            hasMore = deals.length === 100;
            page++;
          }
        } catch (err) {
          console.error(`[${requestId}] Error fetching deals for org ${org.rd_organization_id}:`, err);
        }
      }

      console.log(`[${requestId}] Total deals found: ${allDeals.length}`);

      // Process each deal: UPSERT into sinistros_vida
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      for (const deal of allDeals) {
        try {
          const stageIndex = deal.deal_stage?._id ? (stageIdToIndex[deal.deal_stage._id] ?? 0) : 0;
          const mappedStatus = mapStageToStatus(stageIndex);
          const isFinal = FINAL_STATUSES.includes(mappedStatus);

          // Extract info from deal
          const beneficiarioNome = deal.name.replace(/^Sinistro\s*-\s*/i, '').trim() || 'Beneficiário não informado';
          
          // Try to extract data from custom fields
          let tipoSinistro = 'outros';
          let beneficiarioCpf: string | null = null;
          let dataOcorrencia: string | null = null;
          let valorEstimado: number | null = null;

          for (const cf of deal.custom_fields || []) {
            const label = (cf.label || '').toLowerCase();
            if (label.includes('tipo') && label.includes('sinistro')) {
              tipoSinistro = String(cf.value || 'outros');
            }
            if (label.includes('cpf')) {
              beneficiarioCpf = cf.value ? String(cf.value) : null;
            }
            if (label.includes('data') && label.includes('ocorr')) {
              dataOcorrencia = cf.value ? String(cf.value).split('T')[0] : null;
            }
            if (label.includes('valor') && label.includes('estimado')) {
              valorEstimado = cf.value ? Number(cf.value) : null;
            }
          }

          // Check if sinistro already exists for this deal in this empresa
          const { data: existing } = await adminClient
            .from('sinistros_vida')
            .select('id, status, rd_stage_id, updated_at, created_at')
            .eq('empresa_id', empresaId)
            .eq('rd_deal_id', deal._id)
            .single();

          const sinistroData = {
            empresa_id: empresaId,
            beneficiario_nome: beneficiarioNome,
            beneficiario_cpf: beneficiarioCpf,
            tipo_sinistro: tipoSinistro,
            data_ocorrencia: dataOcorrencia || deal.created_at.split('T')[0],
            valor_estimado: valorEstimado,
            status: mappedStatus,
            rd_deal_id: deal._id,
            rd_org_id: deal.rdOrgId,
            rd_pipeline_id: pipeline._id,
            rd_stage_id: deal.deal_stage?._id || null,
            rd_owner_id: deal.user?._id || null,
            rd_last_sync_at: new Date().toISOString(),
            rd_sync_status: 'ok',
            rd_sync_error: null,
          };

          if (existing) {
            // Update existing record
            const oldStatus = existing.status;
            const statusChanged = oldStatus !== mappedStatus;

            const updateData: Record<string, unknown> = {
              ...sinistroData,
              updated_at: new Date().toISOString(),
            };

            // If status changed to final and not already concluded, set concluido_em and sla
            if (isFinal && statusChanged) {
              const createdAt = new Date(existing.created_at);
              const now = new Date();
              const slaMinutos = Math.round((now.getTime() - createdAt.getTime()) / 60000);
              updateData.concluido_em = now.toISOString();
              updateData.sla_minutos = slaMinutos;
            }

            const { error: updateError } = await adminClient
              .from('sinistros_vida')
              .update(updateData)
              .eq('id', existing.id);

            if (updateError) {
              console.error(`[${requestId}] Error updating sinistro for deal ${deal._id}:`, updateError.message);
              errors++;
              continue;
            }

            updated++;

            // Log timeline if status changed
            if (statusChanged) {
              const eventHash = generateEventHash('sync_status', deal._id, deal.deal_stage?._id || null, new Date().toISOString());

              await adminClient
                .from('sinistros_vida_timeline')
                .insert({
                  sinistro_id: existing.id,
                  empresa_id: empresaId,
                  tipo_evento: 'status_changed',
                  descricao: `Status alterado de "${oldStatus}" para "${mappedStatus}" via sincronização RD`,
                  status_anterior: oldStatus,
                  status_novo: mappedStatus,
                  source: 'rd_station',
                  criado_por: user.id,
                  usuario_nome: userProfile?.nome_completo || 'Sistema',
                  event_hash: eventHash,
                  meta: {
                    rd_deal_id: deal._id,
                    rd_stage_id: deal.deal_stage?._id,
                    sync_action: 'pull',
                  },
                })
                .then(({ error }) => {
                  if (error && error.code !== '23505') {
                    console.error(`[${requestId}] Timeline error:`, error.message);
                  }
                });
            }

          } else {
            // Insert new record
            const insertData = {
              ...sinistroData,
              criado_por: user.id,
              aberto_por_role: 'rd_station',
            };

            const { data: newSinistro, error: insertError } = await adminClient
              .from('sinistros_vida')
              .insert(insertData)
              .select()
              .single();

            if (insertError) {
              // Check for unique constraint violation (duplicate)
              if (insertError.code === '23505') {
                console.log(`[${requestId}] Duplicate deal ${deal._id}, skipping`);
                skipped++;
              } else {
                console.error(`[${requestId}] Error inserting sinistro for deal ${deal._id}:`, insertError.message);
                errors++;
              }
              continue;
            }

            created++;

            // Log timeline for new import
            const eventHash = generateEventHash('created_import', deal._id, null, new Date().toISOString());

            await adminClient
              .from('sinistros_vida_timeline')
              .insert({
                sinistro_id: newSinistro.id,
                empresa_id: empresaId,
                tipo_evento: 'created',
                descricao: 'Sinistro importado do RD Station CRM',
                status_novo: mappedStatus,
                source: 'rd_station',
                criado_por: user.id,
                usuario_nome: userProfile?.nome_completo || 'Sistema',
                event_hash: eventHash,
                meta: {
                  rd_deal_id: deal._id,
                  rd_org_id: deal.rdOrgId,
                  sync_action: 'pull',
                },
              })
              .then(({ error }) => {
                if (error && error.code !== '23505') {
                  console.error(`[${requestId}] Timeline error:`, error.message);
                }
              });
          }
        } catch (err) {
          console.error(`[${requestId}] Error processing deal ${deal._id}:`, err);
          errors++;
        }
      }

      console.log(`[${requestId}] Pull sync completed: ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors`);

      return new Response(JSON.stringify({
        success: true,
        action: 'pull',
        processed: allDeals.length,
        created,
        updated,
        skipped,
        errors,
        requestId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============= ACTION: PUSH (System -> RD) =============
    if (!sinistroId) {
      throw new Error('sinistroId is required for push action');
    }

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

    // Permission check for push
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
    const eventHash = generateEventHash('sync_push', dealId!, targetStage._id, new Date().toISOString());
    
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
          sync_action: 'push',
        },
      });

    // Ignore duplicate timeline errors
    if (timelineError && timelineError.code !== '23505') {
      console.error(`[${requestId}] Timeline error:`, timelineError);
    }

    console.log(`[${requestId}] Push sync completed successfully`);

    return new Response(JSON.stringify({
      success: true,
      action: 'push',
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
