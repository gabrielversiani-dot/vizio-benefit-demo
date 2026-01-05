import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Fields to export for each data type
const BENEFICIARIOS_FIELDS = [
  'row_number', 'status', 'cpf', 'nome_completo', 'tipo', 'titular_cpf', 
  'data_nascimento', 'email', 'telefone', 'plano_saude', 'plano_vida', 
  'plano_odonto', 'status_beneficiario', 'validation_errors', 'validation_warnings'
];

const DEFAULT_FIELDS = [
  'row_number', 'status', 'validation_errors', 'validation_warnings'
];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getFieldValue(row: Record<string, unknown>, field: string): unknown {
  // Direct fields
  if (field in row) return row[field];
  
  // Try mapped_data
  const mapped = row.mapped_data as Record<string, unknown> | undefined;
  if (mapped && field in mapped) return mapped[field];
  
  // Special handling for status_beneficiario (comes from mapped_data.status)
  if (field === 'status_beneficiario' && mapped) return mapped.status;
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Export job request received');

  try {
    // Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase clients
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Check user role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdminVizio = roleData?.role === 'admin_vizio';

    // Get user's empresa_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle();

    const userEmpresaId = profile?.empresa_id;

    // Parse request body
    const { jobId, statusFilter, searchQuery } = await req.json();
    
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Exporting job:', jobId, 'statusFilter:', statusFilter, 'search:', searchQuery);

    // Fetch job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from('import_jobs')
      .select('id, empresa_id, data_type, arquivo_nome, total_rows')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      console.error('Job fetch error:', jobError);
      return new Response(JSON.stringify({ error: 'Job não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify empresa_id scope
    if (!isAdminVizio && job.empresa_id !== userEmpresaId) {
      console.error('Access denied: user empresa', userEmpresaId, 'job empresa', job.empresa_id);
      return new Response(JSON.stringify({ error: 'Acesso negado a este job.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine fields to export
    const fields = job.data_type === 'beneficiarios' ? BENEFICIARIOS_FIELDS : DEFAULT_FIELDS;
    
    // For non-beneficiarios, we'll also collect dynamic fields from mapped_data
    const dynamicFields = new Set<string>();

    // Fetch rows in batches
    const PAGE_SIZE = 1000;
    const allRows: Record<string, unknown>[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabaseAdmin
        .from('import_job_rows')
        .select('row_number, status, mapped_data, validation_errors, validation_warnings')
        .eq('job_id', jobId)
        .order('row_number')
        .range(from, to);

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply search filter for beneficiarios
      if (searchQuery && job.data_type === 'beneficiarios') {
        const searchTerm = `%${searchQuery}%`;
        query = query.or(`mapped_data->>cpf.ilike.${searchTerm},mapped_data->>nome_completo.ilike.${searchTerm}`);
      }

      const { data: rows, error: rowsError } = await query;

      if (rowsError) {
        console.error('Rows fetch error:', rowsError);
        throw rowsError;
      }

      if (!rows || rows.length === 0) {
        hasMore = false;
      } else {
        allRows.push(...rows);
        
        // Collect dynamic fields for non-beneficiarios
        if (job.data_type !== 'beneficiarios') {
          rows.forEach(row => {
            const mapped = row.mapped_data as Record<string, unknown> | undefined;
            if (mapped) {
              Object.keys(mapped).slice(0, 10).forEach(key => dynamicFields.add(key));
            }
          });
        }

        if (rows.length < PAGE_SIZE) {
          hasMore = false;
        }
      }

      page++;
      console.log(`Fetched page ${page}, total rows: ${allRows.length}`);
    }

    console.log('Total rows fetched:', allRows.length);

    // Build final field list
    let finalFields = [...fields];
    if (job.data_type !== 'beneficiarios' && dynamicFields.size > 0) {
      // Insert dynamic fields before validation_errors
      const errorIndex = finalFields.indexOf('validation_errors');
      const dynamicArr = Array.from(dynamicFields).slice(0, 10);
      finalFields.splice(errorIndex, 0, ...dynamicArr);
    }

    // Build CSV content
    const BOM = '\uFEFF';
    let csv = BOM + finalFields.join(';') + '\n';

    for (const row of allRows) {
      const values = finalFields.map(field => {
        let value = getFieldValue(row, field);
        
        // Format arrays
        if (Array.isArray(value)) {
          value = value.join(' | ');
        }
        
        return escapeCSV(value);
      });
      csv += values.join(';') + '\n';
    }

    console.log('CSV generated, size:', csv.length);

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = job.arquivo_nome?.replace(/\.[^/.]+$/, '') || 'export';
    const filterSuffix = statusFilter && statusFilter !== 'all' ? `_${statusFilter}` : '';
    const filename = `${baseName}${filterSuffix}_${timestamp}.csv`;

    // Return CSV file directly
    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: unknown) {
    console.error('Export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
