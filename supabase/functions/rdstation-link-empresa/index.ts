import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify user auth and admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Check if user is admin_vizio
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin_vizio')
      .single();

    if (!roleData) {
      throw new Error('Only admin_vizio can link RD Station organizations');
    }

    const { empresaId, rdOrganizationId, rdOrganizationName, enabled = true } = await req.json();

    if (!empresaId) {
      throw new Error('empresaId is required');
    }

    console.log(`Linking empresa ${empresaId} to RD org ${rdOrganizationId || 'none'}`);

    // Update empresa with RD Station link
    const updateData: any = {
      rd_station_enabled: enabled,
    };

    if (rdOrganizationId) {
      updateData.rd_station_organization_id = rdOrganizationId;
      updateData.rd_station_org_name_snapshot = rdOrganizationName || null;
    } else {
      // Unlinking
      updateData.rd_station_organization_id = null;
      updateData.rd_station_org_name_snapshot = null;
    }

    const { data: empresa, error: updateError } = await adminClient
      .from('empresas')
      .update(updateData)
      .eq('id', empresaId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update empresa: ${updateError.message}`);
    }

    console.log(`Successfully linked empresa ${empresaId}`);

    return new Response(JSON.stringify({
      success: true,
      empresa: {
        id: empresa.id,
        nome: empresa.nome,
        rd_station_organization_id: empresa.rd_station_organization_id,
        rd_station_org_name_snapshot: empresa.rd_station_org_name_snapshot,
        rd_station_enabled: empresa.rd_station_enabled,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
