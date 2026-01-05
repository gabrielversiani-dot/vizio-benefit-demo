import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  nome_completo: string;
}

interface CreateUsersPayload {
  empresaId?: string;
  users: CreateUserRequest[];
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
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { empresaId, users }: CreateUsersPayload = await req.json();

    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Lista de usuários inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check caller permissions
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    const isAdminVizio = callerRoles?.some(r => r.role === 'admin_vizio');
    const isAdminEmpresa = callerRoles?.some(r => r.role === 'admin_empresa');

    if (!isAdminVizio && !isAdminEmpresa) {
      console.log('User does not have required role:', caller.id);
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Apenas admins podem criar usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If admin_empresa, verify they can only create for their own empresa
    let targetEmpresaId = empresaId;
    if (isAdminEmpresa && !isAdminVizio) {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('empresa_id')
        .eq('id', caller.id)
        .single();

      if (!callerProfile?.empresa_id) {
        return new Response(
          JSON.stringify({ error: 'Admin empresa sem empresa vinculada' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Force empresa to be the admin's empresa
      if (empresaId && empresaId !== callerProfile.empresa_id) {
        return new Response(
          JSON.stringify({ error: 'Você só pode criar usuários para sua própria empresa' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetEmpresaId = callerProfile.empresa_id;
    }

    // Validate empresaId if provided
    if (targetEmpresaId) {
      const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('id, nome')
        .eq('id', targetEmpresaId)
        .single();

      if (!empresa) {
        return new Response(
          JSON.stringify({ error: 'Empresa não encontrada' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`Creating users for empresa: ${empresa.nome} (${empresa.id})`);
    }

    console.log(`Creating ${users.length} users...`);

    const results: { 
      email: string; 
      success: boolean; 
      userId?: string;
      error?: string;
    }[] = [];

    for (const userRequest of users) {
      const { email, password, nome_completo } = userRequest;

      // Validate fields
      if (!email || !password || !nome_completo) {
        results.push({
          email: email || 'unknown',
          success: false,
          error: 'Email, senha e nome são obrigatórios'
        });
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        results.push({ email, success: false, error: 'Formato de email inválido' });
        continue;
      }

      // Validate password strength
      if (password.length < 6) {
        results.push({ email, success: false, error: 'Senha deve ter no mínimo 6 caracteres' });
        continue;
      }

      try {
        // Create user via admin API
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { nome_completo }
        });

        if (createError) {
          console.error(`Error creating user ${email}:`, createError);
          
          let errorMsg = createError.message;
          if (createError.message.includes('already been registered')) {
            errorMsg = 'Email já cadastrado no sistema';
          }
          
          results.push({ email, success: false, error: errorMsg });
          continue;
        }

        console.log(`User created: ${email} (${newUser.user.id})`);

        // Update profile with empresa_id if provided
        if (targetEmpresaId) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ empresa_id: targetEmpresaId })
            .eq('id', newUser.user.id);

          if (profileError) {
            console.warn(`Could not update profile empresa_id for ${email}:`, profileError);
          } else {
            console.log(`Profile updated with empresa_id for ${email}`);
          }
        }

        results.push({ email, success: true, userId: newUser.user.id });

      } catch (err: any) {
        console.error(`Exception creating user ${email}:`, err);
        results.push({ email, success: false, error: err.message || 'Erro desconhecido' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const durationMs = Date.now() - startTime;

    console.log(`Finished: ${successCount} success, ${errorCount} errors in ${durationMs}ms`);

    // Audit log (without sensitive data like passwords)
    try {
      await supabaseAdmin.from('ai_audit_logs').insert({
        action: 'setup_create_users',
        user_id: caller.id,
        empresa_id: targetEmpresaId || callerRoles?.[0] ? 
          (await supabaseAdmin.from('profiles').select('empresa_id').eq('id', caller.id).single()).data?.empresa_id : 
          null,
        duration_ms: durationMs,
        input_summary: JSON.stringify({
          total_users: users.length,
          empresa_id: targetEmpresaId,
          emails: users.map(u => u.email)
        }),
        output_summary: JSON.stringify({
          created: successCount,
          errors: errorCount,
          user_ids: results.filter(r => r.success).map(r => r.userId)
        })
      });
    } catch (auditErr) {
      console.warn('Could not write audit log:', auditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: { total: users.length, created: successCount, errors: errorCount },
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
