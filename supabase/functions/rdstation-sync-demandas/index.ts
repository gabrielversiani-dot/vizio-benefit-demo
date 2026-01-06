import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_API_BASE = 'https://crm.rdstation.com/api/v1';

interface RDTask {
  _id: string;
  subject: string;
  notes?: string;
  type: string;
  done: boolean;
  done_date?: string;
  date: string;
  hour?: string;
  deal_id?: string;
  deal?: {
    _id: string;
    name: string;
  };
  users?: Array<{ name: string; email: string }>;
  created_at: string;
}

interface RDDeal {
  _id: string;
  name: string;
  organization?: {
    _id: string;
    name: string;
  };
}

function generateRequestId(): string {
  return `rdstation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function mapRDStatusToLocal(done: boolean): string {
  return done ? 'concluido' : 'em_andamento';
}

function mapRDTypeToLocal(type: string): string {
  const mapping: Record<string, string> = {
    'call': 'agendamento',
    'email': 'outro',
    'meeting': 'agendamento',
    'task': 'outro',
    'lunch': 'agendamento',
    'visit': 'agendamento',
    'whatsapp': 'outro',
  };
  return mapping[type] || 'outro';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[${requestId}] ${msg}`);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');

    if (!rdToken) {
      throw new Error('RD_STATION_API_TOKEN not configured');
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

    const { empresaId, forceSync = false } = await req.json();
    
    if (!empresaId) {
      throw new Error('empresaId is required');
    }

    log(`Starting sync for empresa ${empresaId} by user ${user.id}`);

    // Get empresa with RD Station config
    const { data: empresa, error: empresaError } = await adminClient
      .from('empresas')
      .select('id, nome, rd_station_organization_id, rd_station_enabled, rd_station_last_sync')
      .eq('id', empresaId)
      .single();

    if (empresaError || !empresa) {
      throw new Error('Empresa not found');
    }

    if (!empresa.rd_station_enabled) {
      return new Response(JSON.stringify({
        success: false,
        error: 'RD Station integration not enabled for this company',
        needsSetup: true,
        requestId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!empresa.rd_station_organization_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company not linked to RD Station organization',
        needsMapping: true,
        requestId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await adminClient
      .from('rd_station_sync_logs')
      .insert({
        empresa_id: empresaId,
        status: 'running',
        request_id: requestId,
      })
      .select()
      .single();

    if (syncLogError) {
      log(`Failed to create sync log: ${syncLogError.message}`);
    }

    const rdOrgId = empresa.rd_station_organization_id;
    log(`Fetching deals for RD organization: ${rdOrgId}`);

    // Step 1: Get all deals linked to this organization
    const dealsResponse = await fetch(
      `${RD_API_BASE}/deals?token=${rdToken}&organization=${rdOrgId}&limit=200`,
      { method: 'GET' }
    );

    if (!dealsResponse.ok) {
      const errorText = await dealsResponse.text();
      throw new Error(`RD Station API error (deals): ${dealsResponse.status} - ${errorText}`);
    }

    const dealsData = await dealsResponse.json();
    const deals: RDDeal[] = dealsData.deals || [];
    log(`Found ${deals.length} deals for organization`);

    if (deals.length === 0) {
      // Update sync log
      if (syncLog) {
        await adminClient
          .from('rd_station_sync_logs')
          .update({
            status: 'success',
            tasks_imported: 0,
            tasks_updated: 0,
            tasks_skipped: 0,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      // Update last sync time
      await adminClient
        .from('empresas')
        .update({ rd_station_last_sync: new Date().toISOString() })
        .eq('id', empresaId);

      return new Response(JSON.stringify({
        success: true,
        message: 'No deals found for this organization',
        imported: 0,
        updated: 0,
        skipped: 0,
        requestId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Get tasks for each deal
    const allTasks: (RDTask & { dealName: string })[] = [];
    
    for (const deal of deals) {
      try {
        const tasksResponse = await fetch(
          `${RD_API_BASE}/tasks?token=${rdToken}&deal_id=${deal._id}&limit=200`,
          { method: 'GET' }
        );

        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          const tasks: RDTask[] = tasksData.tasks || [];
          tasks.forEach(task => {
            allTasks.push({ ...task, dealName: deal.name });
          });
          log(`Found ${tasks.length} tasks for deal ${deal._id} (${deal.name})`);
        }
      } catch (err) {
        log(`Error fetching tasks for deal ${deal._id}: ${err}`);
      }
    }

    log(`Total tasks found: ${allTasks.length}`);

    // Step 3: Upsert tasks into demandas table
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const task of allTasks) {
      try {
        // Check if task already exists
        const { data: existing } = await adminClient
          .from('demandas')
          .select('id, status, updated_at')
          .eq('empresa_id', empresaId)
          .eq('rd_task_id', task._id)
          .single();

        const demandaData = {
          empresa_id: empresaId,
          source: 'rd_station',
          rd_task_id: task._id,
          rd_deal_id: task.deal_id || task.deal?._id,
          rd_deal_name: task.dealName,
          titulo: task.subject || 'Tarefa sem título',
          descricao: task.notes || '',
          tipo: mapRDTypeToLocal(task.type) as any,
          status: mapRDStatusToLocal(task.done) as any,
          prazo: task.date ? task.date.split('T')[0] : null,
          responsavel_nome: task.users?.[0]?.name || null,
          criado_por: user.id,
          raw_payload: task as any,
        };

        if (existing) {
          // Update existing record
          const { error: updateError } = await adminClient
            .from('demandas')
            .update({
              ...demandaData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            log(`Error updating task ${task._id}: ${updateError.message}`);
            skipped++;
          } else {
            updated++;
            
            // Log status change if different
            const newStatus = mapRDStatusToLocal(task.done);
            if (existing.status !== newStatus) {
              await adminClient
                .from('demandas_historico')
                .insert({
                  demanda_id: existing.id,
                  empresa_id: empresaId,
                  tipo_evento: 'sync',
                  status_anterior: existing.status,
                  status_novo: newStatus,
                  descricao: 'Atualização via sincronização RD Station',
                  usuario_nome: 'Sistema RD Station',
                });
            }
          }
        } else {
          // Insert new record
          const { data: newDemanda, error: insertError } = await adminClient
            .from('demandas')
            .insert(demandaData)
            .select()
            .single();

          if (insertError) {
            log(`Error inserting task ${task._id}: ${insertError.message}`);
            skipped++;
          } else {
            imported++;
            
            // Log creation
            await adminClient
              .from('demandas_historico')
              .insert({
                demanda_id: newDemanda.id,
                empresa_id: empresaId,
                tipo_evento: 'sync',
                status_novo: demandaData.status,
                descricao: 'Importado do RD Station CRM',
                usuario_nome: 'Sistema RD Station',
              });
          }
        }
      } catch (err) {
        log(`Error processing task ${task._id}: ${err}`);
        skipped++;
      }
    }

    // Update sync log
    if (syncLog) {
      await adminClient
        .from('rd_station_sync_logs')
        .update({
          status: 'success',
          tasks_imported: imported,
          tasks_updated: updated,
          tasks_skipped: skipped,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    // Update last sync time
    await adminClient
      .from('empresas')
      .update({ rd_station_last_sync: new Date().toISOString() })
      .eq('id', empresaId);

    log(`Sync completed: ${imported} imported, ${updated} updated, ${skipped} skipped`);

    return new Response(JSON.stringify({
      success: true,
      imported,
      updated,
      skipped,
      total: allTasks.length,
      requestId,
      logs,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error: ${errorMessage}`);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      requestId,
      logs,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
