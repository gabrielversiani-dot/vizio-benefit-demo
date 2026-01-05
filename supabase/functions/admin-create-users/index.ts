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
  users: CreateUserRequest[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the caller is admin_vizio
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

    // Check if caller has admin_vizio role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin_vizio')
      .maybeSingle();

    if (!roleData) {
      console.log('User does not have admin_vizio role:', caller.id);
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Apenas admin_vizio pode criar usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { users }: CreateUsersPayload = await req.json();

    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Lista de usuários inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        results.push({
          email,
          success: false,
          error: 'Formato de email inválido'
        });
        continue;
      }

      // Validate password strength
      if (password.length < 6) {
        results.push({
          email,
          success: false,
          error: 'Senha deve ter no mínimo 6 caracteres'
        });
        continue;
      }

      try {
        // Create user via admin API
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            nome_completo
          }
        });

        if (createError) {
          console.error(`Error creating user ${email}:`, createError);
          results.push({
            email,
            success: false,
            error: createError.message
          });
          continue;
        }

        console.log(`User created successfully: ${email} (${newUser.user.id})`);
        
        results.push({
          email,
          success: true,
          userId: newUser.user.id
        });

      } catch (err: any) {
        console.error(`Exception creating user ${email}:`, err);
        results.push({
          email,
          success: false,
          error: err.message || 'Erro desconhecido'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`Finished: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: users.length,
          created: successCount,
          errors: errorCount
        },
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
