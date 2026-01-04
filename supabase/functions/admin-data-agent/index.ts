import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Schema definitions for validation
const SCHEMAS = {
  beneficiarios: {
    required: ['nome_completo', 'cpf', 'data_nascimento'],
    optional: ['email', 'telefone', 'sexo', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'matricula', 'cargo', 'departamento', 'tipo', 'grau_parentesco', 'plano_saude', 'plano_vida', 'plano_odonto', 'status', 'data_inclusao'],
    cpfField: 'cpf',
  },
  faturamento: {
    required: ['competencia', 'categoria', 'valor_total'],
    optional: ['valor_mensalidade', 'valor_coparticipacao', 'valor_reembolsos', 'total_vidas', 'total_titulares', 'total_dependentes', 'data_vencimento', 'data_pagamento', 'status'],
  },
  sinistralidade: {
    required: ['competencia', 'categoria', 'valor_premio', 'valor_sinistros'],
    optional: ['quantidade_sinistros', 'sinistros_consultas', 'sinistros_exames', 'sinistros_internacoes', 'sinistros_procedimentos', 'sinistros_outros', 'indice_sinistralidade'],
  },
  movimentacoes: {
    required: ['tipo', 'categoria'],
    optional: ['observacoes'],
  },
  contratos: {
    required: ['titulo', 'data_inicio', 'data_fim'],
    optional: ['tipo', 'status', 'numero_contrato', 'valor_mensal', 'observacoes'],
  },
};

// Column name mappings (Portuguese variations -> standard)
const COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  beneficiarios: {
    'nome': 'nome_completo',
    'nome completo': 'nome_completo',
    'nome_completo': 'nome_completo',
    'cpf': 'cpf',
    'documento': 'cpf',
    'data nascimento': 'data_nascimento',
    'data_nascimento': 'data_nascimento',
    'dt_nascimento': 'data_nascimento',
    'nascimento': 'data_nascimento',
    'e-mail': 'email',
    'email': 'email',
    'telefone': 'telefone',
    'celular': 'telefone',
    'fone': 'telefone',
    'sexo': 'sexo',
    'genero': 'sexo',
    'cep': 'cep',
    'endereco': 'endereco',
    'endereço': 'endereco',
    'logradouro': 'endereco',
    'numero': 'numero',
    'número': 'numero',
    'num': 'numero',
    'complemento': 'complemento',
    'bairro': 'bairro',
    'cidade': 'cidade',
    'municipio': 'cidade',
    'uf': 'uf',
    'estado': 'uf',
    'matricula': 'matricula',
    'matrícula': 'matricula',
    'cargo': 'cargo',
    'funcao': 'cargo',
    'função': 'cargo',
    'departamento': 'departamento',
    'setor': 'departamento',
    'tipo': 'tipo',
    'titular_dependente': 'tipo',
    'parentesco': 'grau_parentesco',
    'grau_parentesco': 'grau_parentesco',
    'plano_saude': 'plano_saude',
    'saude': 'plano_saude',
    'saúde': 'plano_saude',
    'plano_vida': 'plano_vida',
    'vida': 'plano_vida',
    'seguro_vida': 'plano_vida',
    'plano_odonto': 'plano_odonto',
    'odonto': 'plano_odonto',
    'dental': 'plano_odonto',
    'status': 'status',
    'situacao': 'status',
    'situação': 'status',
    'data_inclusao': 'data_inclusao',
    'data_admissao': 'data_inclusao',
    'admissao': 'data_inclusao',
  },
  faturamento: {
    'competencia': 'competencia',
    'competência': 'competencia',
    'mes': 'competencia',
    'mês': 'competencia',
    'categoria': 'categoria',
    'tipo': 'categoria',
    'valor_total': 'valor_total',
    'valor': 'valor_total',
    'total': 'valor_total',
    'mensalidade': 'valor_mensalidade',
    'valor_mensalidade': 'valor_mensalidade',
    'coparticipacao': 'valor_coparticipacao',
    'coparticipação': 'valor_coparticipacao',
    'reembolsos': 'valor_reembolsos',
    'vidas': 'total_vidas',
    'total_vidas': 'total_vidas',
    'titulares': 'total_titulares',
    'dependentes': 'total_dependentes',
    'vencimento': 'data_vencimento',
    'data_vencimento': 'data_vencimento',
    'pagamento': 'data_pagamento',
    'data_pagamento': 'data_pagamento',
    'status': 'status',
  },
  sinistralidade: {
    'competencia': 'competencia',
    'competência': 'competencia',
    'mes': 'competencia',
    'categoria': 'categoria',
    'tipo': 'categoria',
    'premio': 'valor_premio',
    'prêmio': 'valor_premio',
    'valor_premio': 'valor_premio',
    'sinistros': 'valor_sinistros',
    'valor_sinistros': 'valor_sinistros',
    'quantidade': 'quantidade_sinistros',
    'qtd_sinistros': 'quantidade_sinistros',
    'consultas': 'sinistros_consultas',
    'exames': 'sinistros_exames',
    'internacoes': 'sinistros_internacoes',
    'internações': 'sinistros_internacoes',
    'procedimentos': 'sinistros_procedimentos',
    'outros': 'sinistros_outros',
    'indice': 'indice_sinistralidade',
    'índice': 'indice_sinistralidade',
  },
  movimentacoes: {
    'tipo': 'tipo',
    'categoria': 'categoria',
    'observacoes': 'observacoes',
    'observações': 'observacoes',
    'obs': 'observacoes',
  },
  contratos: {
    'titulo': 'titulo',
    'título': 'titulo',
    'nome': 'titulo',
    'data_inicio': 'data_inicio',
    'inicio': 'data_inicio',
    'início': 'data_inicio',
    'data_fim': 'data_fim',
    'fim': 'data_fim',
    'vencimento': 'data_fim',
    'tipo': 'tipo',
    'status': 'status',
    'numero': 'numero_contrato',
    'número': 'numero_contrato',
    'numero_contrato': 'numero_contrato',
    'valor': 'valor_mensal',
    'valor_mensal': 'valor_mensal',
    'observacoes': 'observacoes',
  },
};

function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }
  
  // Detect separator (comma or semicolon)
  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  
  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/["']/g, ''));
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map(v => v.trim().replace(/["']/g, ''));
    if (values.length === headers.length && values.some(v => v)) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }
  }
  
  return { headers, rows };
}

function detectDataType(headers: string[]): string {
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[_\s-]/g, ''));
  
  if (normalizedHeaders.some(h => h.includes('cpf') || h.includes('nascimento'))) {
    return 'beneficiarios';
  }
  if (normalizedHeaders.some(h => h.includes('sinistro') || h.includes('premio'))) {
    return 'sinistralidade';
  }
  if (normalizedHeaders.some(h => h.includes('fatura') || h.includes('mensalidade') || h.includes('coparticipa'))) {
    return 'faturamento';
  }
  if (normalizedHeaders.some(h => h.includes('contrato') || h.includes('vigencia'))) {
    return 'contratos';
  }
  if (normalizedHeaders.some(h => h.includes('movimenta') || h.includes('inclusao') || h.includes('exclusao'))) {
    return 'movimentacoes';
  }
  
  return 'beneficiarios';
}

function mapColumns(headers: string[], dataType: string): Record<string, string> {
  const mapping: Record<string, string> = {};
  const columnMappings = COLUMN_MAPPINGS[dataType] || {};
  
  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim();
    if (columnMappings[normalizedHeader]) {
      mapping[header] = columnMappings[normalizedHeader];
    }
  });
  
  return mapping;
}

function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  
  return remainder === parseInt(cpf[10]);
}

function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }
  
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  }
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  return null;
}

function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

interface ValidationResult {
  status: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  mappedData: Record<string, unknown>;
}

function validateRow(
  row: Record<string, string>,
  columnMapping: Record<string, string>,
  dataType: string,
  existingCPFs: Set<string>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mappedData: Record<string, unknown> = {};
  const schema = SCHEMAS[dataType as keyof typeof SCHEMAS];
  
  Object.entries(row).forEach(([originalCol, value]) => {
    const mappedCol = columnMapping[originalCol];
    if (mappedCol && value) {
      mappedData[mappedCol] = value;
    }
  });
  
  schema.required.forEach(field => {
    if (!mappedData[field]) {
      errors.push(`Campo obrigatório ausente: ${field}`);
    }
  });
  
  if (dataType === 'beneficiarios') {
    if (mappedData.cpf) {
      const cpf = normalizeCPF(mappedData.cpf as string);
      if (!validateCPF(cpf)) {
        errors.push('CPF inválido');
      } else if (existingCPFs.has(cpf)) {
        warnings.push('CPF já cadastrado - será atualizado');
      }
      mappedData.cpf = cpf;
    }
    
    if (mappedData.data_nascimento) {
      const normalized = normalizeDate(mappedData.data_nascimento as string);
      if (!normalized) {
        errors.push('Data de nascimento em formato inválido');
      } else {
        mappedData.data_nascimento = normalized;
      }
    }
    
    ['plano_saude', 'plano_vida', 'plano_odonto'].forEach(field => {
      if (mappedData[field]) {
        const val = (mappedData[field] as string).toLowerCase();
        mappedData[field] = ['sim', 'yes', 's', 'y', '1', 'true', 'x'].includes(val);
      }
    });
    
    if (mappedData.tipo) {
      const tipo = (mappedData.tipo as string).toLowerCase();
      mappedData.tipo = tipo.includes('dep') ? 'dependente' : 'titular';
    } else {
      mappedData.tipo = 'titular';
    }
    
    if (!mappedData.status) {
      mappedData.status = 'ativo';
    }
  }
  
  if (dataType === 'faturamento' || dataType === 'sinistralidade') {
    if (mappedData.competencia) {
      const normalized = normalizeDate(mappedData.competencia as string);
      if (normalized) {
        mappedData.competencia = normalized;
      }
    }
    
    if (mappedData.categoria) {
      const cat = (mappedData.categoria as string).toLowerCase();
      if (cat.includes('sau') || cat.includes('med')) {
        mappedData.categoria = 'saude';
      } else if (cat.includes('vid')) {
        mappedData.categoria = 'vida';
      } else if (cat.includes('odo') || cat.includes('dent')) {
        mappedData.categoria = 'odonto';
      }
    }
    
    const numericFields = ['valor_total', 'valor_mensalidade', 'valor_coparticipacao', 'valor_reembolsos', 
                          'valor_premio', 'valor_sinistros', 'total_vidas', 'total_titulares', 'total_dependentes',
                          'quantidade_sinistros', 'sinistros_consultas', 'sinistros_exames', 'sinistros_internacoes',
                          'sinistros_procedimentos', 'sinistros_outros'];
    numericFields.forEach(field => {
      if (mappedData[field]) {
        const val = (mappedData[field] as string).replace(/[^\d.,]/g, '').replace(',', '.');
        mappedData[field] = parseFloat(val) || 0;
      }
    });
  }
  
  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';
  
  return { status, errors, warnings, mappedData };
}

async function callOpenAI(prompt: string, systemPrompt: string): Promise<{ content: string; tokensUsed: number }> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada');
  }
  
  console.log('Calling OpenAI API...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', response.status, error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('OpenAI response received, tokens:', data.usage?.total_tokens);
  
  return {
    content: data.choices[0].message.content,
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // 1. Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Create Supabase clients
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 3. Verify user authentication
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('User authenticated:', user.id);

    // 4. Check user roles - ONLY admin_vizio and admin_empresa allowed
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const userRoles = roles?.map(r => r.role) || [];
    const isAdminVizio = userRoles.includes('admin_vizio');
    const isAdminEmpresa = userRoles.includes('admin_empresa');
    
    if (!isAdminVizio && !isAdminEmpresa) {
      console.error('User is not admin:', user.id, userRoles);
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas admin_vizio e admin_empresa podem usar esta função.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('User roles verified:', userRoles);

    // 5. Parse request body
    const { action, jobId, empresaId, filePath, columnMapping: customMapping, goal, rows } = await req.json();
    console.log('Request:', { action, jobId, empresaId, goal: goal?.substring(0, 50) });

    // 6. Validate empresa_id scope (multi-tenant security)
    if (empresaId) {
      if (!isAdminVizio) {
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('empresa_id')
          .eq('id', user.id)
          .single();
        
        if (userProfile?.empresa_id !== empresaId) {
          console.error('Empresa_id mismatch:', userProfile?.empresa_id, empresaId);
          return new Response(JSON.stringify({ error: 'Você não tem acesso a esta empresa.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // ACTION: analyze - Analyze uploaded file
    if (action === 'analyze') {
      if (!filePath || !empresaId) {
        return new Response(JSON.stringify({ error: 'filePath e empresaId são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('imports')
        .download(filePath);
      
      if (downloadError || !fileData) {
        console.error('Download error:', downloadError);
        return new Response(JSON.stringify({ error: 'Erro ao baixar arquivo' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const content = await fileData.text();
      const { headers, rows: parsedRows } = parseCSV(content);
      
      if (parsedRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Arquivo vazio ou formato inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const detectedDataType = detectDataType(headers);
      console.log('Detected data type:', detectedDataType, 'Rows:', parsedRows.length);

      const columnMapping = customMapping || mapColumns(headers, detectedDataType);
      
      let existingCPFs = new Set<string>();
      if (detectedDataType === 'beneficiarios') {
        const { data: existingBeneficiarios } = await supabaseAdmin
          .from('beneficiarios')
          .select('cpf')
          .eq('empresa_id', empresaId);
        existingCPFs = new Set(existingBeneficiarios?.map(b => normalizeCPF(b.cpf)) || []);
      }

      const stagingRows: Array<{
        row_number: number;
        status: string;
        original_data: Record<string, string>;
        mapped_data: Record<string, unknown>;
        validation_errors: string[] | null;
        validation_warnings: string[] | null;
      }> = [];
      
      let validCount = 0;
      let warningCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      const seenCPFs = new Set<string>();

      parsedRows.forEach((row, index) => {
        const result = validateRow(row, columnMapping, detectedDataType, existingCPFs);
        
        if (detectedDataType === 'beneficiarios' && result.mappedData.cpf) {
          const cpf = result.mappedData.cpf as string;
          if (seenCPFs.has(cpf)) {
            result.warnings.push('CPF duplicado neste arquivo');
            if (result.status === 'valid') {
              result.status = 'warning';
            }
            duplicateCount++;
          }
          seenCPFs.add(cpf);
          
          if (existingCPFs.has(cpf)) {
            duplicateCount++;
          }
        }
        
        if (result.status === 'valid') validCount++;
        else if (result.status === 'warning') warningCount++;
        else errorCount++;
        
        stagingRows.push({
          row_number: index + 1,
          status: result.status,
          original_data: row,
          mapped_data: result.mappedData,
          validation_errors: result.errors.length > 0 ? result.errors : null,
          validation_warnings: result.warnings.length > 0 ? result.warnings : null,
        });
      });

      // Generate AI summary using OpenAI
      const sampleRows = parsedRows.slice(0, 5);
      const aiPrompt = `Analise estes dados de importação e forneça um resumo conciso em português:
      
Tipo detectado: ${detectedDataType}
Total de linhas: ${parsedRows.length}
Linhas válidas: ${validCount}
Linhas com avisos: ${warningCount}
Linhas com erros: ${errorCount}
Duplicados: ${duplicateCount}

Colunas encontradas: ${headers.join(', ')}
Mapeamento aplicado: ${JSON.stringify(columnMapping)}

Amostra (primeiras 5 linhas):
${JSON.stringify(sampleRows, null, 2)}

Forneça:
1. Um resumo do que será importado (2-3 frases)
2. Principais problemas encontrados (se houver)
3. Sugestões para melhorar os dados`;

      const systemPrompt = `Você é um assistente especializado em análise de dados para importação em sistemas de gestão de benefícios corporativos. 
Seja conciso e objetivo. Responda sempre em português do Brasil.`;

      let aiSummary = '';
      let tokensUsed = 0;
      
      try {
        const aiResult = await callOpenAI(aiPrompt, systemPrompt);
        aiSummary = aiResult.content;
        tokensUsed = aiResult.tokensUsed;
      } catch (aiError) {
        console.error('OpenAI call error:', aiError);
        aiSummary = `Resumo automático: ${parsedRows.length} linhas detectadas como ${detectedDataType}. ${validCount} válidas, ${warningCount} com avisos, ${errorCount} com erros.`;
      }

      // Create import job (staging only - no writes to final tables)
      const { data: job, error: jobError } = await supabaseAdmin
        .from('import_jobs')
        .insert({
          empresa_id: empresaId,
          data_type: detectedDataType,
          status: 'ready_for_review',
          arquivo_url: filePath,
          arquivo_nome: filePath.split('/').pop(),
          total_rows: parsedRows.length,
          valid_rows: validCount,
          warning_rows: warningCount,
          error_rows: errorCount,
          duplicate_rows: duplicateCount,
          column_mapping: columnMapping,
          ai_summary: aiSummary,
          criado_por: user.id,
        })
        .select()
        .single();

      if (jobError) {
        console.error('Job creation error:', jobError);
        throw jobError;
      }

      // Insert staging rows (import_job_rows)
      const rowsToInsert = stagingRows.map(row => ({
        ...row,
        job_id: job.id,
      }));

      const { error: rowsError } = await supabaseAdmin
        .from('import_job_rows')
        .insert(rowsToInsert);

      if (rowsError) {
        console.error('Rows insertion error:', rowsError);
        throw rowsError;
      }

      // Log AI audit
      await supabaseAdmin.from('ai_audit_logs').insert({
        job_id: job.id,
        empresa_id: empresaId,
        action: 'analyze_import',
        input_summary: `Arquivo: ${filePath}, ${parsedRows.length} linhas`,
        output_summary: `Tipo: ${detectedDataType}, Válidas: ${validCount}, Avisos: ${warningCount}, Erros: ${errorCount}`,
        model_used: 'gpt-4o-mini',
        tokens_used: tokensUsed,
        duration_ms: Date.now() - startTime,
        user_id: user.id,
      });

      return new Response(JSON.stringify({
        ok: true,
        success: true,
        job,
        summary: {
          dataType: detectedDataType,
          totalRows: parsedRows.length,
          validRows: validCount,
          warningRows: warningCount,
          errorRows: errorCount,
          duplicateRows: duplicateCount,
          columnMapping,
          aiSummary,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: approve - Approve and insert data into final tables
    if (action === 'approve') {
      const { data: job, error: jobError } = await supabaseAdmin
        .from('import_jobs')
        .select('*, import_job_rows(*)')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        console.error('Job fetch error:', jobError);
        return new Response(JSON.stringify({ error: 'Job não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify empresa_id scope
      if (!isAdminVizio && job.empresa_id !== empresaId) {
        return new Response(JSON.stringify({ error: 'Acesso negado a este job.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rowsToProcess = job.import_job_rows.filter(
        (r: { status: string }) => r.status === 'valid' || r.status === 'warning'
      );

      console.log(`Processing ${rowsToProcess.length} rows for job ${jobId}`);

      let insertedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (const row of rowsToProcess) {
        try {
          const data = {
            ...row.mapped_data,
            empresa_id: job.empresa_id,
            criado_por: user.id,
          };

          if (job.data_type === 'beneficiarios') {
            const { data: existing } = await supabaseAdmin
              .from('beneficiarios')
              .select('id')
              .eq('empresa_id', job.empresa_id)
              .eq('cpf', data.cpf)
              .maybeSingle();

            if (existing) {
              await supabaseAdmin
                .from('beneficiarios')
                .update(data)
                .eq('id', existing.id);
              updatedCount++;
            } else {
              await supabaseAdmin
                .from('beneficiarios')
                .insert(data);
              insertedCount++;
            }
          } else if (job.data_type === 'faturamento') {
            await supabaseAdmin.from('faturamento').insert(data);
            insertedCount++;
          } else if (job.data_type === 'sinistralidade') {
            await supabaseAdmin.from('sinistralidade').insert(data);
            insertedCount++;
          }
        } catch (rowError) {
          console.error('Row processing error:', rowError);
          errorCount++;
        }
      }

      await supabaseAdmin
        .from('import_jobs')
        .update({
          status: 'completed',
          aprovado_por: user.id,
          data_aprovacao: new Date().toISOString(),
        })
        .eq('id', jobId);

      await supabaseAdmin.from('ai_audit_logs').insert({
        job_id: jobId,
        empresa_id: job.empresa_id,
        action: 'approve_import',
        input_summary: `Job ${jobId}: ${rowsToProcess.length} linhas para processar`,
        output_summary: `Inseridos: ${insertedCount}, Atualizados: ${updatedCount}, Erros: ${errorCount}`,
        duration_ms: Date.now() - startTime,
        user_id: user.id,
      });

      return new Response(JSON.stringify({
        ok: true,
        success: true,
        inserted: insertedCount,
        updated: updatedCount,
        errors: errorCount,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: reject - Reject/discard import job
    if (action === 'reject') {
      await supabaseAdmin
        .from('import_jobs')
        .update({ status: 'rejected' })
        .eq('id', jobId);

      await supabaseAdmin.from('ai_audit_logs').insert({
        job_id: jobId,
        empresa_id: empresaId,
        action: 'reject_import',
        input_summary: `Job ${jobId} rejeitado`,
        output_summary: 'Importação descartada pelo usuário',
        duration_ms: Date.now() - startTime,
        user_id: user.id,
      });

      return new Response(JSON.stringify({ ok: true, success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: chat - General AI chat for data analysis
    if (action === 'chat' && goal) {
      const chatPrompt = `Objetivo do usuário: ${goal}
      
${rows ? `Dados fornecidos:\n${JSON.stringify(rows.slice(0, 20), null, 2)}` : 'Nenhum dado fornecido.'}

Por favor, ajude o usuário com seu objetivo de análise de dados.`;

      const systemPrompt = `Você é um assistente especializado em análise de dados para gestão de benefícios corporativos.
Você pode ajudar com:
- Análise de dados de beneficiários, faturamento e sinistralidade
- Preparação de dados para importação
- Identificação de problemas e inconsistências
- Sugestões de melhorias

Sempre responda em português do Brasil de forma clara e objetiva.`;

      let aiResponse = '';
      let tokensUsed = 0;
      
      try {
        const aiResult = await callOpenAI(chatPrompt, systemPrompt);
        aiResponse = aiResult.content;
        tokensUsed = aiResult.tokensUsed;
      } catch (aiError) {
        console.error('OpenAI chat error:', aiError);
        aiResponse = 'Desculpe, não foi possível processar sua solicitação no momento. Por favor, tente novamente.';
      }

      await supabaseAdmin.from('ai_audit_logs').insert({
        empresa_id: empresaId,
        action: 'chat',
        input_summary: goal.substring(0, 200),
        output_summary: aiResponse.substring(0, 200),
        model_used: 'gpt-4o-mini',
        tokens_used: tokensUsed,
        duration_ms: Date.now() - startTime,
        user_id: user.id,
      });

      return new Response(JSON.stringify({
        ok: true,
        response: aiResponse,
        tokensUsed,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida', ok: false }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage, ok: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
