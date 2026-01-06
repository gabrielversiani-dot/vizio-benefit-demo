import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_API_BASE = 'https://crm.rdstation.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');

    if (!rdToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'RD Station API token not configured. Please add RD_STATION_API_TOKEN secret.',
        needsToken: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

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
      throw new Error('Only admin_vizio can access RD Station organizations');
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('q') || '';
    const page = url.searchParams.get('page') || '1';

    console.log(`Fetching RD Station organizations - search: "${search}", page: ${page}`);

    // Fetch organizations from RD Station
    let rdUrl = `${RD_API_BASE}/organizations?token=${rdToken}&limit=50&page=${page}`;
    if (search) {
      rdUrl += `&q=${encodeURIComponent(search)}`;
    }

    const response = await fetch(rdUrl, { method: 'GET' });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RD Station API error:', response.status, errorText);
      throw new Error(`RD Station API error: ${response.status}`);
    }

    const data = await response.json();
    
    const organizations = (data.organizations || []).map((org: any) => ({
      id: org._id,
      name: org.name,
      cnpj: org.legal_document || org.cnpj || null,
      address: org.address || null,
      created_at: org.created_at,
    }));

    console.log(`Found ${organizations.length} organizations`);

    return new Response(JSON.stringify({
      success: true,
      organizations,
      hasMore: data.has_more || false,
      page: parseInt(page),
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
