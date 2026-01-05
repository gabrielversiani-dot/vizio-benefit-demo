import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AppRole = 'admin_vizio' | 'admin_empresa' | 'rh_gestor' | 'visualizador';

interface EmpresaData {
  nome: string;
  cnpj: string;
  razao_social?: string;
  contato_email?: string;
  contato_telefone?: string;
}

interface ProfileData {
  email: string;
  empresa_cnpj: string;
  cargo?: string;
  telefone?: string;
}

interface RoleData {
  email: string;
  role: AppRole;
}

interface SetupPayload {
  step: 'empresas' | 'perfis' | 'roles';
  data: EmpresaData[] | ProfileData[] | RoleData[];
}

interface StepResult {
  success: boolean;
  identifier: string;
  action?: 'created' | 'updated' | 'skipped';
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check caller permissions
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    const isAdminVizio = callerRoles?.some(r => r.role === 'admin_vizio') ?? false;
    const isAdminEmpresa = callerRoles?.some(r => r.role === 'admin_empresa') ?? false;

    if (!isAdminVizio && !isAdminEmpresa) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Apenas admins podem executar setup.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller's empresa for scoping
    let callerEmpresaId: string | null = null;
    if (isAdminEmpresa && !isAdminVizio) {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('empresa_id')
        .eq('id', caller.id)
        .single();
      callerEmpresaId = callerProfile?.empresa_id || null;
    }

    // Parse request
    const { step, data }: SetupPayload = await req.json();

    if (!step || !data || !Array.isArray(data)) {
      return new Response(
        JSON.stringify({ error: 'Payload inválido. Esperado: { step, data }' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${step} with ${data.length} records...`);

    let results: StepResult[] = [];

    switch (step) {
      case 'empresas':
        // Only admin_vizio can create empresas
        if (!isAdminVizio) {
          return new Response(
            JSON.stringify({ error: 'Apenas admin_vizio pode criar empresas' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        results = await processEmpresas(supabaseAdmin, data as EmpresaData[]);
        break;

      case 'perfis':
        results = await processPerfis(supabaseAdmin, data as ProfileData[], isAdminVizio, callerEmpresaId);
        break;

      case 'roles':
        results = await processRoles(supabaseAdmin, data as RoleData[], isAdminVizio, callerEmpresaId);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Step inválido: ${step}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const created = results.filter(r => r.success && r.action === 'created').length;
    const updated = results.filter(r => r.success && r.action === 'updated').length;
    const skipped = results.filter(r => r.success && r.action === 'skipped').length;
    const errors = results.filter(r => !r.success).length;
    const durationMs = Date.now() - startTime;

    console.log(`Finished ${step}: ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors in ${durationMs}ms`);

    // Audit log
    try {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('empresa_id')
        .eq('id', caller.id)
        .single();

      await supabaseAdmin.from('ai_audit_logs').insert({
        action: `setup_${step}`,
        user_id: caller.id,
        empresa_id: callerProfile?.empresa_id || null,
        duration_ms: durationMs,
        input_summary: JSON.stringify({
          step,
          total_records: data.length,
          identifiers: results.map(r => r.identifier).slice(0, 20)
        }),
        output_summary: JSON.stringify({ created, updated, skipped, errors })
      });
    } catch (auditErr) {
      console.warn('Could not write audit log:', auditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        step,
        summary: { total: data.length, created, updated, skipped, errors },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Process Empresas
async function processEmpresas(supabase: any, empresas: EmpresaData[]): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (const empresa of empresas) {
    if (!empresa.nome?.trim() || !empresa.cnpj?.trim()) {
      results.push({ success: false, identifier: empresa.cnpj || 'unknown', error: 'Nome e CNPJ são obrigatórios' });
      continue;
    }

    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('empresas')
        .select('id')
        .eq('cnpj', empresa.cnpj)
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabase
          .from('empresas')
          .update({
            nome: empresa.nome,
            razao_social: empresa.razao_social || null,
            contato_email: empresa.contato_email || null,
            contato_telefone: empresa.contato_telefone || null,
          })
          .eq('id', existing.id);

        if (error) throw error;
        results.push({ success: true, identifier: empresa.cnpj, action: 'updated' });
      } else {
        // Insert
        const { error } = await supabase
          .from('empresas')
          .insert({
            nome: empresa.nome,
            cnpj: empresa.cnpj,
            razao_social: empresa.razao_social || null,
            contato_email: empresa.contato_email || null,
            contato_telefone: empresa.contato_telefone || null,
          });

        if (error) throw error;
        results.push({ success: true, identifier: empresa.cnpj, action: 'created' });
      }
    } catch (err: any) {
      console.error(`Error processing empresa ${empresa.cnpj}:`, err);
      results.push({ success: false, identifier: empresa.cnpj, error: err.message });
    }
  }

  return results;
}

// Process Perfis
async function processPerfis(
  supabase: any, 
  perfis: ProfileData[], 
  isAdminVizio: boolean,
  callerEmpresaId: string | null
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (const perfil of perfis) {
    if (!perfil.email?.trim() || !perfil.empresa_cnpj?.trim()) {
      results.push({ success: false, identifier: perfil.email || 'unknown', error: 'Email e CNPJ da empresa são obrigatórios' });
      continue;
    }

    try {
      // Find profile by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', perfil.email)
        .maybeSingle();

      if (!profile) {
        results.push({ success: false, identifier: perfil.email, error: 'Usuário não encontrado' });
        continue;
      }

      // Find empresa by CNPJ
      const { data: empresa } = await supabase
        .from('empresas')
        .select('id')
        .eq('cnpj', perfil.empresa_cnpj)
        .maybeSingle();

      if (!empresa) {
        results.push({ success: false, identifier: perfil.email, error: 'Empresa não encontrada' });
        continue;
      }

      // Scope check for admin_empresa
      if (!isAdminVizio && callerEmpresaId && empresa.id !== callerEmpresaId) {
        results.push({ success: false, identifier: perfil.email, error: 'Você só pode atualizar perfis da sua empresa' });
        continue;
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          empresa_id: empresa.id,
          cargo: perfil.cargo || null,
          telefone: perfil.telefone || null,
        })
        .eq('id', profile.id);

      if (error) throw error;
      results.push({ success: true, identifier: perfil.email, action: 'updated' });

    } catch (err: any) {
      console.error(`Error processing perfil ${perfil.email}:`, err);
      results.push({ success: false, identifier: perfil.email, error: err.message });
    }
  }

  return results;
}

// Process Roles
async function processRoles(
  supabase: any, 
  roles: RoleData[], 
  isAdminVizio: boolean,
  callerEmpresaId: string | null
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const validRoles: AppRole[] = ['admin_vizio', 'admin_empresa', 'rh_gestor', 'visualizador'];

  for (const roleData of roles) {
    if (!roleData.email?.trim() || !roleData.role) {
      results.push({ success: false, identifier: roleData.email || 'unknown', error: 'Email e role são obrigatórios' });
      continue;
    }

    if (!validRoles.includes(roleData.role)) {
      results.push({ success: false, identifier: roleData.email, error: `Role inválida: ${roleData.role}` });
      continue;
    }

    // Only admin_vizio can assign admin_vizio role
    if (roleData.role === 'admin_vizio' && !isAdminVizio) {
      results.push({ success: false, identifier: roleData.email, error: 'Apenas admin_vizio pode atribuir role admin_vizio' });
      continue;
    }

    try {
      // Find profile by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, empresa_id')
        .eq('email', roleData.email)
        .maybeSingle();

      if (!profile) {
        results.push({ success: false, identifier: roleData.email, error: 'Usuário não encontrado' });
        continue;
      }

      // Scope check for admin_empresa
      if (!isAdminVizio && callerEmpresaId && profile.empresa_id !== callerEmpresaId) {
        results.push({ success: false, identifier: roleData.email, error: 'Você só pode atribuir roles a usuários da sua empresa' });
        continue;
      }

      // Check if role already exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.id)
        .eq('role', roleData.role)
        .maybeSingle();

      if (existingRole) {
        results.push({ success: true, identifier: roleData.email, action: 'skipped' });
        continue;
      }

      // Insert role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: profile.id,
          role: roleData.role,
        });

      if (error) throw error;
      results.push({ success: true, identifier: roleData.email, action: 'created' });

    } catch (err: any) {
      console.error(`Error processing role for ${roleData.email}:`, err);
      
      let errorMsg = err.message;
      if (err.code === '23505') {
        results.push({ success: true, identifier: roleData.email, action: 'skipped' });
        continue;
      }
      
      results.push({ success: false, identifier: roleData.email, error: errorMsg });
    }
  }

  return results;
}
