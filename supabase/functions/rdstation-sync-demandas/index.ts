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

interface LinkedOrg {
  rd_organization_id: string;
  rd_organization_name: string | null;
}

function generateRequestId(): string {
  return `rdsync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    const logLine = `[${new Date().toISOString()}] ${msg}`;
    console.log(`[${requestId}] ${msg}`);
    logs.push(logLine);
  };

  let syncLogId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');

    if (!rdToken) {
      log('RD Station token not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'RD_STATION_API_TOKEN not configured',
        needsToken: true,
        requestId,
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
    const { empresaId, forceSync = false } = body;
    
    if (!empresaId) {
      throw new Error('empresaId is required');
    }

    log(`Starting sync for empresa ${empresaId} by user ${user.id} (forceSync: ${forceSync})`);

    // Get user role - can be admin_vizio or user from the same empresa
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

    // Permission check: user must be admin_vizio OR belong to the same empresa
    if (!isAdminVizio && userProfile?.empresa_id !== empresaId) {
      throw new Error('You do not have permission to sync this empresa');
    }

    // Get empresa name
    const { data: empresa, error: empresaError } = await adminClient
      .from('empresas')
      .select('id, nome')
      .eq('id', empresaId)
      .single();

    if (empresaError || !empresa) {
      throw new Error('Empresa not found');
    }

    log(`Empresa: ${empresa.nome} (${empresa.id})`);

    // Get all active RD organizations linked to this empresa
    const { data: linkedOrgs, error: linkedOrgsError } = await adminClient
      .from('empresa_rd_organizacoes')
      .select('rd_organization_id, rd_organization_name')
      .eq('empresa_id', empresaId)
      .eq('active', true);

    if (linkedOrgsError) {
      throw new Error(`Failed to get linked orgs: ${linkedOrgsError.message}`);
    }

    if (!linkedOrgs || linkedOrgs.length === 0) {
      log('No RD organizations linked to this empresa');
      return new Response(JSON.stringify({
        success: false,
        error: 'No RD organizations linked to this company',
        needsMapping: true,
        requestId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    log(`Found ${linkedOrgs.length} linked RD organizations: ${linkedOrgs.map(o => o.rd_organization_name || o.rd_organization_id).join(', ')}`);

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
    } else {
      syncLogId = syncLog.id;
    }

    // Process each linked organization
    const allTasks: (RDTask & { dealName: string; rdOrgId: string })[] = [];
    
    for (const linkedOrg of linkedOrgs as LinkedOrg[]) {
      const rdOrgId = linkedOrg.rd_organization_id;
      log(`Fetching deals for RD organization: ${rdOrgId} (${linkedOrg.rd_organization_name})`);

      try {
        const dealsResponse = await fetch(
          `${RD_API_BASE}/deals?token=${rdToken}&organization=${rdOrgId}&limit=200`,
          { method: 'GET' }
        );

        if (!dealsResponse.ok) {
          log(`Failed to fetch deals for org ${rdOrgId}: ${dealsResponse.status}`);
          continue;
        }

        const dealsData = await dealsResponse.json();
        let deals: RDDeal[] = dealsData.deals || [];
        
        // Fallback: filter deals locally by organization if API doesn't filter properly
        deals = deals.filter(deal => deal.organization?._id === rdOrgId);

        log(`Found ${deals.length} deals for organization ${rdOrgId}`);

        // Get tasks for each deal
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
                allTasks.push({ ...task, dealName: deal.name, rdOrgId });
              });
              if (tasks.length > 0) {
                log(`Found ${tasks.length} tasks for deal ${deal.name}`);
              }
            }
          } catch (err) {
            log(`Error fetching tasks for deal ${deal._id}: ${err}`);
          }
        }
      } catch (err) {
        log(`Error processing org ${rdOrgId}: ${err}`);
      }
    }

    log(`Total tasks found across all organizations: ${allTasks.length}`);

    // Upsert tasks into demandas table
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const task of allTasks) {
      try {
        // Check if task already exists for THIS empresa
        const { data: existing } = await adminClient
          .from('demandas')
          .select('id, status, updated_at')
          .eq('empresa_id', empresaId)
          .eq('rd_task_id', task._id)
          .single();

        const newStatus = mapRDStatusToLocal(task.done);
        const newTipo = mapRDTypeToLocal(task.type);

        const demandaData = {
          empresa_id: empresaId,
          source: 'rd_station',
          rd_task_id: task._id,
          rd_deal_id: task.deal_id || task.deal?._id,
          rd_deal_name: task.dealName,
          rd_organization_id: task.rdOrgId,
          titulo: task.subject || 'Tarefa sem título',
          descricao: task.notes || '',
          tipo: newTipo,
          status: newStatus,
          prazo: task.date ? task.date.split('T')[0] : null,
          responsavel_nome: task.users?.[0]?.name || null,
          criado_por: user.id,
          raw_payload: task as unknown as Record<string, unknown>,
        };

        if (existing) {
          const oldStatus = existing.status;

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
            if (oldStatus !== newStatus) {
              await adminClient
                .from('demandas_historico')
                .insert({
                  demanda_id: existing.id,
                  empresa_id: empresaId,
                  tipo_evento: 'sync',
                  status_anterior: oldStatus,
                  status_novo: newStatus,
                  descricao: `Status alterado via sincronização RD Station`,
                  usuario_nome: 'Sistema RD Station',
                });
              log(`Status changed for ${task._id}: ${oldStatus} -> ${newStatus}`);
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
                status_novo: newStatus,
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
    if (syncLogId) {
      await adminClient
        .from('rd_station_sync_logs')
        .update({
          status: 'success',
          tasks_imported: imported,
          tasks_updated: updated,
          tasks_skipped: skipped,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId);
    }

    // Update last sync time in new table for all linked orgs
    await adminClient
      .from('empresa_rd_organizacoes')
      .update({ updated_at: new Date().toISOString() })
      .eq('empresa_id', empresaId)
      .eq('active', true);

    // Also update legacy field for backward compatibility
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
      organizationsProcessed: linkedOrgs.length,
      requestId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error: ${errorMessage}`);

    // Update sync log with error
    if (syncLogId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      await adminClient
        .from('rd_station_sync_logs')
        .update({
          status: 'error',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId);
    }
    
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
