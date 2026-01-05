import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[delete-sinistralidade-periodo] No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Token de autenticação não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Create service client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("[delete-sinistralidade-periodo] User verification failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[delete-sinistralidade-periodo] User:", user.id);

    // Check user role (only admin_vizio and admin_empresa can delete)
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      console.error("[delete-sinistralidade-periodo] Error fetching roles:", rolesError);
      return new Response(
        JSON.stringify({ error: "Internal error", message: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userRoles = roles?.map((r) => r.role) || [];
    const canDelete = userRoles.includes("admin_vizio") || userRoles.includes("admin_empresa");

    if (!canDelete) {
      console.error("[delete-sinistralidade-periodo] User lacks permission:", userRoles);
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Sem permissão para excluir indicadores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's empresa_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("empresa_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("[delete-sinistralidade-periodo] Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Internal error", message: "Erro ao verificar empresa do usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdminVizio = userRoles.includes("admin_vizio");
    const userEmpresaId = profile?.empresa_id;

    // Parse request body
    const body = await req.json();
    const { indicadorId, deleteMonthly = false } = body;

    if (!indicadorId) {
      return new Response(
        JSON.stringify({ error: "Bad request", message: "indicadorId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[delete-sinistralidade-periodo] Request:", { indicadorId, deleteMonthly });

    // Fetch the indicador to verify ownership
    const { data: indicador, error: indicadorError } = await supabaseAdmin
      .from("sinistralidade_indicadores_periodo")
      .select("id, empresa_id, import_job_id")
      .eq("id", indicadorId)
      .single();

    if (indicadorError || !indicador) {
      console.error("[delete-sinistralidade-periodo] Indicador not found:", indicadorError);
      return new Response(
        JSON.stringify({ error: "Not found", message: "Indicador não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Security: verify empresa ownership (unless admin_vizio)
    if (!isAdminVizio && indicador.empresa_id !== userEmpresaId) {
      console.error("[delete-sinistralidade-periodo] Empresa mismatch:", {
        indicadorEmpresa: indicador.empresa_id,
        userEmpresa: userEmpresaId,
      });
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Indicador pertence a outra empresa" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let deletedMonthlyCount = 0;
    let deletedJobRowsCount = 0;

    // If deleteMonthly is true and there's an import_job_id, delete monthly data
    if (deleteMonthly && indicador.import_job_id) {
      console.log("[delete-sinistralidade-periodo] Deleting monthly data for import_job_id:", indicador.import_job_id);

      // Delete sinistralidade records linked to this import_job
      const { data: deletedMonthly, error: monthlyError } = await supabaseAdmin
        .from("sinistralidade")
        .delete()
        .eq("empresa_id", indicador.empresa_id)
        .eq("import_job_id", indicador.import_job_id)
        .select("id");

      if (monthlyError) {
        console.error("[delete-sinistralidade-periodo] Error deleting monthly:", monthlyError);
        return new Response(
          JSON.stringify({ error: "Internal error", message: "Erro ao excluir dados mensais" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      deletedMonthlyCount = deletedMonthly?.length || 0;
      console.log("[delete-sinistralidade-periodo] Deleted monthly records:", deletedMonthlyCount);

      // Delete import_job_rows
      const { data: deletedRows, error: rowsError } = await supabaseAdmin
        .from("import_job_rows")
        .delete()
        .eq("job_id", indicador.import_job_id)
        .select("id");

      if (rowsError) {
        console.warn("[delete-sinistralidade-periodo] Error deleting job rows (non-fatal):", rowsError);
      } else {
        deletedJobRowsCount = deletedRows?.length || 0;
        console.log("[delete-sinistralidade-periodo] Deleted job rows:", deletedJobRowsCount);
      }

      // Update import_job status to 'rejected' (soft delete)
      const { error: jobUpdateError } = await supabaseAdmin
        .from("import_jobs")
        .update({ status: "rejected" })
        .eq("id", indicador.import_job_id);

      if (jobUpdateError) {
        console.warn("[delete-sinistralidade-periodo] Error updating job status (non-fatal):", jobUpdateError);
      }
    }

    // Delete the indicador
    const { error: deleteError } = await supabaseAdmin
      .from("sinistralidade_indicadores_periodo")
      .delete()
      .eq("id", indicadorId)
      .eq("empresa_id", indicador.empresa_id);

    if (deleteError) {
      console.error("[delete-sinistralidade-periodo] Error deleting indicador:", deleteError);
      return new Response(
        JSON.stringify({ error: "Internal error", message: "Erro ao excluir indicador" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[delete-sinistralidade-periodo] Success:", {
      indicadorId,
      deletedMonthlyCount,
      deletedJobRowsCount,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        deletedIndicador: true,
        deletedMonthlyCount,
        deletedJobRowsCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[delete-sinistralidade-periodo] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: "Erro inesperado ao excluir indicador" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
