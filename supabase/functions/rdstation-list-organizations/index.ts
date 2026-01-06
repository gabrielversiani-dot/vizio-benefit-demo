import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_API_BASE = 'https://crm.rdstation.com/api/v1';

function generateRequestId(): string {
  return `rdorg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');

    if (!rdToken) {
      console.log(`[${requestId}] RD Station token not configured`);
      return new Response(JSON.stringify({
        success: false,
        error: 'RD Station API token not configured. Please add RD_STATION_API_TOKEN secret.',
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

    // Parse body for POST requests
    let search = '';
    let page = 1;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        search = body.q || '';
        page = body.page || 1;
      } catch {
        // Ignore parse errors, use defaults
      }
    } else {
      // Fallback to query params for GET
      const url = new URL(req.url);
      search = url.searchParams.get('q') || '';
      page = parseInt(url.searchParams.get('page') || '1');
    }

    console.log(`[${requestId}] Fetching RD Station organizations - search: "${search}", page: ${page}`);

    // Fetch organizations from RD Station with search filter
    let rdUrl = `${RD_API_BASE}/organizations?token=${rdToken}&limit=50&page=${page}`;
    if (search) {
      rdUrl += `&q=${encodeURIComponent(search)}`;
    }

    const response = await fetch(rdUrl, { method: 'GET' });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] RD Station API error:`, response.status, errorText);
      throw new Error(`RD Station API error: ${response.status}`);
    }

    const data = await response.json();
    
    const organizations = (data.organizations || []).map((org: Record<string, unknown>) => ({
      id: org._id,
      name: org.name,
      cnpj: org.legal_document || org.cnpj || null,
      address: org.address || null,
      created_at: org.created_at,
    }));

    console.log(`[${requestId}] Found ${organizations.length} organizations`);

    return new Response(JSON.stringify({
      success: true,
      organizations,
      hasMore: data.has_more || false,
      page,
      requestId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${requestId}] Error:`, errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
