import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.4.168/legacy/build/pdf.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use Lovable AI exclusively (no external API key needed)
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Lovable AI Gateway endpoint (correct URL)
const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Custom error types for structured error handling
interface AIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

function createAIError(code: string, message: string, details?: Record<string, unknown>): AIError {
  return { code, message, details };
}

// System prompt for PDF extraction
const EXTRACTION_SYSTEM_PROMPT = `Você é um especialista em extração de dados de relatórios de sinistralidade de operadoras de saúde, especificamente Unimed Belo Horizonte.

Sua tarefa é analisar imagens de páginas de PDF e extrair dados estruturados seguindo exatamente o schema JSON especificado.

TIPOS DE DOCUMENTOS:
1. "demonstrativo_resultado" - Demonstrativo de Resultado com colunas por competência (12/2024, 01/2025, etc.)
   - Extrair: Faturamento, Custo Assistencial, IU (Índice de Utilização/Sinistralidade) por competência
   - Cada coluna de competência deve virar uma row separada

2. "custo_assistencial" - Relatório de Custo Assistencial por período
   - Extrair: período, custo total, custo per capita, quebras por tipo de atendimento

3. "consultas" - Relatório de Consultas por período
   - Extrair: taxa de consulta, distribuição por especialidade, tipo (eletiva/PS)

4. "internacoes" - Relatório de Internações por período
   - Extrair: taxa de internação, custo médio, tempo médio permanência, distribuição por tipo

REGRAS DE NORMALIZAÇÃO:
- Valores monetários: "1.234,56" ou "R$ 1.234,56" → 1234.56 (número)
- Percentuais: "85,5%" ou "0,43%" → 85.5 ou 0.43 (número sem %)
- Competências: "12/2024" → "2024-12" (formato YYYY-MM)
- Datas: "01/12/2024" → "2024-12-01" (formato YYYY-MM-DD)
- Se IU não vier explícito, calcular: (sinistros/faturamento)*100

RETORNE SOMENTE JSON VÁLIDO no seguinte formato:
{
  "document_type": "demonstrativo_resultado" | "custo_assistencial" | "consultas" | "internacoes" | "unknown",
  "meta": {
    "operadora": "Unimed Belo Horizonte",
    "empresa_nome": "nome se aparecer ou null",
    "produto": "nome do plano/produto se aparecer ou null",
    "periodo_inicio": "YYYY-MM-DD ou null",
    "periodo_fim": "YYYY-MM-DD ou null"
  },
  "rows": [
    {
      "competencia": "YYYY-MM ou null",
      "vidas": numero ou null,
      "faturamento": numero ou null,
      "sinistros": numero ou null,
      "iu": numero ou null,
      "observacoes": "string ou null",
      "page_ref": "p1"
    }
  ],
  "indicadores_periodo": {
    "tipo": "custo_assistencial" | "consultas" | "internacoes" | null,
    "metricas": {},
    "quebras": {}
  },
  "validations": {
    "errors": [],
    "warnings": []
  },
  "summary": {
    "rows": 0,
    "errors": 0,
    "warnings": 0
  }
}`;

interface PageImage {
  pageNumber: number;
  imageBase64: string;
}

interface AnalyzeRequest {
  action: 'analyze' | 'approve';
  empresaId: string;
  filePath?: string;
  jobId?: string;
  pages?: PageImage[];
  competenciaHint?: string;
  mode?: 'client_render' | 'server_fallback';
  requestId?: string;
}

interface ExtractedData {
  document_type: string;
  meta: {
    operadora: string;
    empresa_nome: string | null;
    produto: string | null;
    periodo_inicio: string | null;
    periodo_fim: string | null;
  };
  rows: Array<{
    competencia: string | null;
    vidas: number | null;
    faturamento: number | null;
    sinistros: number | null;
    iu: number | null;
    observacoes: string | null;
    page_ref: string;
  }>;
  indicadores_periodo: {
    tipo: string | null;
    metricas: Record<string, unknown>;
    quebras: Record<string, unknown>;
  };
  validations: {
    errors: string[];
    warnings: string[];
  };
  summary: {
    rows: number;
    errors: number;
    warnings: number;
  };
}

// Helper: Extract text content from various AI provider response formats
function extractProviderText(resp: unknown): string {
  if (!resp || typeof resp !== 'object') {
    return typeof resp === 'string' ? resp : JSON.stringify(resp).slice(0, 6000);
  }
  
  const r = resp as Record<string, unknown>;
  
  // OpenAI-like format
  if (Array.isArray(r.choices) && r.choices[0]) {
    const choice = r.choices[0] as Record<string, unknown>;
    if (choice.message && typeof (choice.message as Record<string, unknown>).content === 'string') {
      return (choice.message as Record<string, unknown>).content as string;
    }
    if (typeof choice.text === 'string') {
      return choice.text;
    }
  }
  
  // Direct content
  if (typeof r.output_text === 'string') return r.output_text;
  if (typeof r.content === 'string') return r.content;
  
  // Gemini-like format
  if (Array.isArray(r.candidates) && r.candidates[0]) {
    const candidate = r.candidates[0] as Record<string, unknown>;
    if (candidate.content && typeof candidate.content === 'object') {
      const content = candidate.content as Record<string, unknown>;
      if (Array.isArray(content.parts)) {
        return content.parts
          .map((p: unknown) => (p && typeof p === 'object' && 'text' in p) ? (p as { text: string }).text : '')
          .join('');
      }
    }
  }
  
  // Wrapped format
  if (r.data && typeof r.data === 'object') {
    return extractProviderText(r.data);
  }
  
  // Fallback: stringify
  return JSON.stringify(resp).slice(0, 6000);
}

// Helper: Parse JSON from AI response with tolerance for markdown and formatting
function parseAiJson(content: string, requestId?: string): unknown {
  let jsonStr = content.trim();
  
  // Try direct parse first
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Continue to cleanup attempts
  }
  
  // Remove markdown code blocks
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();
  
  // Try parse after markdown removal
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Continue to bracket extraction
  }
  
  // Find first { and last } and try to parse
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const extracted = jsonStr.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(extracted);
    } catch {
      // Failed
    }
  }
  
  // All attempts failed
  const snippet = content.slice(0, 1200);
  console.error('AI JSON parse failed. requestId:', requestId, 'snippet:', snippet);
  throw createAIError('AI_JSON_PARSE_FAILED', 'Falha ao interpretar resposta da IA como JSON', {
    requestId,
    rawSnippet: snippet,
  });
}

async function callLovableAIVision(pages: PageImage[]): Promise<{ content: string; tokensUsed: number }> {
  if (!LOVABLE_API_KEY) {
    throw createAIError('LOVABLE_AI_NOT_CONFIGURED', 'LOVABLE_API_KEY não configurada. Verifique as configurações do projeto.');
  }

  console.log(`Calling Lovable AI Vision with ${pages.length} pages...`);

  // Build content array with images
  const contentArray: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: 'text',
      text: `Analise as ${pages.length} página(s) do relatório Unimed BH e extraia os dados estruturados conforme o schema especificado. Retorne SOMENTE o JSON, sem markdown.`
    }
  ];

  // Add each page as an image
  for (const page of pages) {
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: page.imageBase64.startsWith('data:') 
          ? page.imageBase64 
          : `data:image/png;base64,${page.imageBase64}`,
      }
    });
  }

  const response = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: contentArray }
      ],
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI Vision error:', response.status, errorText);
    
    if (response.status === 429) {
      throw createAIError('LOVABLE_AI_RATE_LIMIT', 'Limite temporário do workspace atingido. Aguarde alguns instantes e tente novamente.', { providerStatus: 429 });
    }
    if (response.status === 402) {
      throw createAIError('LOVABLE_AI_NO_BALANCE', 'Sem saldo de AI. Recarregue em Settings → Cloud & AI balance.', { providerStatus: 402 });
    }
    
    throw createAIError('LOVABLE_AI_ERROR', `Erro na API Lovable AI: ${response.status}`, { providerStatus: response.status, providerBody: errorText.slice(0, 500) });
  }

  const data = await response.json();
  console.log('Lovable AI Vision response received, tokens:', data.usage?.total_tokens);

  return {
    content: data.choices[0].message.content,
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  // Note: Server fallback is best-effort. Works for text-based PDFs.
  // Image-only PDFs may produce little/no text.
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    disableWorker: true,
  } as any);

  const pdf = await loadingTask.promise;
  const maxPages = Math.min(pdf.numPages, 10);

  let fullText = '';
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as any[])
      .map((it) => (typeof it?.str === 'string' ? it.str : ''))
      .filter(Boolean)
      .join(' ');

    if (pageText.trim()) {
      fullText += `\n\n[PAGE ${i}]\n${pageText}`;
    }
  }

  return fullText.trim();
}

async function callLovableAIText(text: string): Promise<{ content: string; tokensUsed: number }> {
  if (!LOVABLE_API_KEY) {
    throw createAIError('LOVABLE_AI_NOT_CONFIGURED', 'LOVABLE_API_KEY não configurada. Verifique as configurações do projeto.');
  }

  const clipped = text.length > 30000 ? text.slice(0, 30000) : text;

  const response = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `O PDF não pôde ser renderizado em imagens no navegador. A seguir está o TEXTO extraído do PDF.\n\nTarefa: Retorne SOMENTE o JSON no schema especificado.\n\nTEXTO EXTRAÍDO:\n${clipped}`,
        },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI Text error:', response.status, errorText);
    
    if (response.status === 429) {
      throw createAIError('LOVABLE_AI_RATE_LIMIT', 'Limite temporário do workspace atingido. Aguarde alguns instantes e tente novamente.', { providerStatus: 429 });
    }
    if (response.status === 402) {
      throw createAIError('LOVABLE_AI_NO_BALANCE', 'Sem saldo de AI. Recarregue em Settings → Cloud & AI balance.', { providerStatus: 402 });
    }
    
    throw createAIError('LOVABLE_AI_ERROR', `Erro na API Lovable AI: ${response.status}`, { providerStatus: response.status, providerBody: errorText.slice(0, 500) });
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

function parseExtractedData(content: string, requestId?: string): ExtractedData {
  // Use the robust JSON parser
  const parsed = parseAiJson(content, requestId) as Record<string, unknown>;
  
  // Validate minimal structure
  const result: ExtractedData = {
    document_type: typeof parsed.document_type === 'string' ? parsed.document_type : 'unknown',
    meta: {
      operadora: 'Unimed Belo Horizonte',
      empresa_nome: null,
      produto: null,
      periodo_inicio: null,
      periodo_fim: null,
    },
    rows: [],
    indicadores_periodo: { tipo: null, metricas: {}, quebras: {} },
    validations: { errors: [], warnings: [] },
    summary: { rows: 0, errors: 0, warnings: 0 },
  };
  
  // Extract meta
  if (parsed.meta && typeof parsed.meta === 'object') {
    const meta = parsed.meta as Record<string, unknown>;
    result.meta = {
      operadora: typeof meta.operadora === 'string' ? meta.operadora : 'Unimed Belo Horizonte',
      empresa_nome: typeof meta.empresa_nome === 'string' ? meta.empresa_nome : null,
      produto: typeof meta.produto === 'string' ? meta.produto : null,
      periodo_inicio: typeof meta.periodo_inicio === 'string' ? meta.periodo_inicio : null,
      periodo_fim: typeof meta.periodo_fim === 'string' ? meta.periodo_fim : null,
    };
  }
  
  // Extract rows
  if (Array.isArray(parsed.rows)) {
    result.rows = parsed.rows.map((row: unknown) => {
      const r = (row && typeof row === 'object') ? row as Record<string, unknown> : {};
      return {
        competencia: typeof r.competencia === 'string' ? r.competencia : null,
        vidas: typeof r.vidas === 'number' ? r.vidas : null,
        faturamento: typeof r.faturamento === 'number' ? r.faturamento : null,
        sinistros: typeof r.sinistros === 'number' ? r.sinistros : null,
        iu: typeof r.iu === 'number' ? r.iu : null,
        observacoes: typeof r.observacoes === 'string' ? r.observacoes : null,
        page_ref: typeof r.page_ref === 'string' ? r.page_ref : 'p1',
      };
    });
  }
  
  // Extract indicadores_periodo
  if (parsed.indicadores_periodo && typeof parsed.indicadores_periodo === 'object') {
    const ind = parsed.indicadores_periodo as Record<string, unknown>;
    result.indicadores_periodo = {
      tipo: typeof ind.tipo === 'string' ? ind.tipo : null,
      metricas: (ind.metricas && typeof ind.metricas === 'object') ? ind.metricas as Record<string, unknown> : {},
      quebras: (ind.quebras && typeof ind.quebras === 'object') ? ind.quebras as Record<string, unknown> : {},
    };
  }
  
  // Extract validations
  if (parsed.validations && typeof parsed.validations === 'object') {
    const val = parsed.validations as Record<string, unknown>;
    result.validations = {
      errors: Array.isArray(val.errors) ? val.errors.filter((e): e is string => typeof e === 'string') : [],
      warnings: Array.isArray(val.warnings) ? val.warnings.filter((w): w is string => typeof w === 'string') : [],
    };
  }
  
  // Extract summary
  if (parsed.summary && typeof parsed.summary === 'object') {
    const sum = parsed.summary as Record<string, unknown>;
    result.summary = {
      rows: typeof sum.rows === 'number' ? sum.rows : result.rows.length,
      errors: typeof sum.errors === 'number' ? sum.errors : 0,
      warnings: typeof sum.warnings === 'number' ? sum.warnings : 0,
    };
  } else {
    result.summary.rows = result.rows.length;
  }
  
  return result;
}

function validateExtractedRow(row: ExtractedData['rows'][0], index: number): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields for demonstrativo
  if (row.competencia && !row.faturamento && !row.sinistros) {
    warnings.push(`Linha ${index + 1}: Sem valores de faturamento ou sinistros`);
  }

  // Validate IU consistency
  if (row.faturamento && row.sinistros && row.iu) {
    const calculatedIU = (row.sinistros / row.faturamento) * 100;
    const diff = Math.abs(calculatedIU - row.iu);
    if (diff > 0.5) {
      warnings.push(`Linha ${index + 1}: IU informado (${row.iu}%) difere do calculado (${calculatedIU.toFixed(2)}%)`);
    }
  }

  // Calculate IU if missing
  if (!row.iu && row.faturamento && row.sinistros && row.faturamento > 0) {
    row.iu = parseFloat(((row.sinistros / row.faturamento) * 100).toFixed(2));
  }

  return { errors, warnings };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    // Create Supabase admin client (has access to auth.getUser with JWT token)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract JWT token and verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Check user role
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin_vizio' || r.role === 'admin_empresa');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Requer role admin_vizio ou admin_empresa.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request
    const body: AnalyzeRequest = await req.json();
    const {
      action,
      empresaId,
      filePath,
      jobId,
      pages,
      mode = 'client_render',
      requestId,
    } = body;

    console.log('Request:', {
      requestId,
      mode,
      action,
      empresaId,
      filePath,
      jobId,
      pagesCount: pages?.length,
    });

    if (action === 'analyze') {
      // ANALYZE: Extract data from PDF (client-rendered images OR server fallback)
      let tokensUsed = 0;
      let extractedData: ExtractedData;

      if ((!pages || pages.length === 0) && mode === 'server_fallback') {
        if (!filePath) {
          return new Response(JSON.stringify({ error: 'filePath obrigatório para server_fallback', requestId, mode }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Best-effort server fallback: download PDF and try text extraction.
        const { data: pdfBlob, error: dlError } = await supabaseAdmin.storage
          .from('sinistralidade_pdfs')
          .download(filePath);

        if (dlError || !pdfBlob) {
          throw new Error(`Erro ao baixar PDF do storage: ${dlError?.message || 'sem detalhes'}`);
        }

        const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
        const extractedText = await extractTextFromPdf(pdfBytes);

        if (!extractedText || extractedText.trim().length < 200) {
          extractedData = {
            document_type: 'unknown',
            meta: {
              operadora: 'Unimed Belo Horizonte',
              empresa_nome: null,
              produto: null,
              periodo_inicio: null,
              periodo_fim: null,
            },
            rows: [],
            indicadores_periodo: { tipo: null, metricas: {}, quebras: {} },
            validations: {
              errors: ['Não foi possível extrair texto suficiente do PDF no servidor. Este PDF pode estar em formato de imagem. Tente novamente ou use outro arquivo.'],
              warnings: [],
            },
            summary: { rows: 0, errors: 1, warnings: 0 },
          };
        } else {
          const { content, tokensUsed: t } = await callLovableAIText(extractedText);
          tokensUsed = t;
          extractedData = parseExtractedData(content, requestId);
        }
      } else {
        if (!pages || pages.length === 0) {
          return new Response(JSON.stringify({ error: 'Nenhuma página enviada para análise', requestId, mode }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Call Lovable AI Vision
        const { content, tokensUsed: t } = await callLovableAIVision(pages);
        tokensUsed = t;

        // Parse extracted data
        extractedData = parseExtractedData(content, requestId);
      }

      // Ensure validation containers
      extractedData.validations = extractedData.validations || { errors: [], warnings: [] };
      extractedData.summary = extractedData.summary || { rows: extractedData.rows?.length || 0, errors: 0, warnings: 0 };

      // Validate each row
      let totalErrors = 0;
      let totalWarnings = 0;

      for (let i = 0; i < extractedData.rows.length; i++) {
        const { errors, warnings } = validateExtractedRow(extractedData.rows[i], i);
        extractedData.validations.errors.push(...errors);
        extractedData.validations.warnings.push(...warnings);
        totalErrors += errors.length;
        totalWarnings += warnings.length;
      }

      extractedData.summary = {
        rows: extractedData.rows.length,
        errors: totalErrors,
        warnings: totalWarnings
      };

      // Create import job
      const { data: job, error: jobError } = await supabaseAdmin
        .from('import_jobs')
        .insert({
          empresa_id: empresaId,
          data_type: 'sinistralidade_pdf',
          status: 'ready_for_review',
          arquivo_url: filePath || 'pdf-vision-upload',
          arquivo_nome: filePath?.split('/').pop() || 'upload.pdf',
          criado_por: user.id,
          total_rows: extractedData.rows.length,
          valid_rows: extractedData.rows.filter((_, i) => {
            const { errors } = validateExtractedRow(extractedData.rows[i], i);
            return errors.length === 0;
          }).length,
          warning_rows: totalWarnings,
          error_rows: totalErrors,
          ai_summary: `Tipo: ${extractedData.document_type}. Operadora: ${extractedData.meta.operadora}. ${extractedData.rows.length} registros extraídos.`,
          ai_suggestions: extractedData,
          column_mapping: {
            document_type: extractedData.document_type,
            meta: extractedData.meta,
            indicadores_periodo: extractedData.indicadores_periodo
          }
        })
        .select()
        .single();

      if (jobError) {
        console.error('Error creating job:', jobError);
        throw new Error('Erro ao criar job de importação');
      }

      console.log('Created job:', job.id);

      // Insert job rows
      const rowsToInsert = extractedData.rows.map((row, index) => {
        const { errors, warnings } = validateExtractedRow(row, index);
        return {
          job_id: job.id,
          row_number: index + 1,
          status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid',
          original_data: row,
          mapped_data: {
            competencia: row.competencia,
            vidas: row.vidas,
            faturamento: row.faturamento,
            sinistros: row.sinistros,
            iu: row.iu,
            observacoes: row.observacoes,
            page_ref: row.page_ref,
            operadora: extractedData.meta.operadora,
            produto: extractedData.meta.produto
          },
          validation_errors: errors.length > 0 ? errors : null,
          validation_warnings: warnings.length > 0 ? warnings : null
        };
      });

      if (rowsToInsert.length > 0) {
        const { error: rowsError } = await supabaseAdmin
          .from('import_job_rows')
          .insert(rowsToInsert);

        if (rowsError) {
          console.error('Error inserting rows:', rowsError);
        }
      }

      // Log AI usage
      const pagesCount = pages?.length || 0;
      await supabaseAdmin.from('ai_audit_logs').insert({
        action: 'sinistralidade_pdf_extract',
        job_id: job.id,
        empresa_id: empresaId,
        user_id: user.id,
        tokens_used: tokensUsed,
        duration_ms: Date.now() - startTime,
        model_used: mode === 'server_fallback' ? 'google/gemini-2.5-flash' : 'google/gemini-2.5-pro',
        input_summary: mode === 'server_fallback'
          ? `server_fallback (texto)`
          : `${pagesCount} páginas PDF`,
        output_summary: `${extractedData.rows.length} registros extraídos, tipo: ${extractedData.document_type}`
      });

      return new Response(JSON.stringify({
        success: true,
        jobId: job.id,
        extractedData,
        tokensUsed,
        requestId: requestId || null,
        mode,
        durationMs: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'approve') {
      // APPROVE: Apply data to final tables
      if (!jobId) {
        return new Response(JSON.stringify({ error: 'jobId obrigatório para aprovação' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get job details
      const { data: job, error: jobError } = await supabaseAdmin
        .from('import_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        return new Response(JSON.stringify({ error: 'Job não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (job.status !== 'ready_for_review') {
        return new Response(JSON.stringify({ error: `Job não pode ser aprovado. Status atual: ${job.status}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get job rows
      const { data: rows, error: rowsError } = await supabaseAdmin
        .from('import_job_rows')
        .select('*')
        .eq('job_id', jobId)
        .in('status', ['valid', 'warning']);

      if (rowsError) {
        console.error('Error fetching rows:', rowsError);
        throw new Error('Erro ao buscar linhas do job');
      }

      console.log(`Approving ${rows?.length || 0} rows for job ${jobId}`);

      const extractedData = job.ai_suggestions as ExtractedData;
      const columnMapping = job.column_mapping as { document_type: string; meta: ExtractedData['meta']; indicadores_periodo: ExtractedData['indicadores_periodo'] };

      // Insert into sinistralidade table for monthly data
      let insertedCount = 0;
      let indicadorInserted = false;

      for (const row of (rows || [])) {
        const mappedData = row.mapped_data as Record<string, unknown>;

        if (mappedData.competencia) {
          // Monthly data -> sinistralidade table
          const { error: insertError } = await supabaseAdmin
            .from('sinistralidade')
            .upsert({
              empresa_id: job.empresa_id,
              competencia: `${mappedData.competencia}-01`, // Convert YYYY-MM to date
              categoria: 'saude',
              valor_premio: mappedData.faturamento || 0,
              valor_sinistros: mappedData.sinistros || 0,
              quantidade_sinistros: 0,
              indice_sinistralidade: mappedData.iu,
              vidas: mappedData.vidas,
              operadora: mappedData.operadora as string,
              produto: mappedData.produto as string,
              fonte_pdf_path: job.arquivo_url,
              import_job_id: job.id,
              criado_por: user.id
            }, {
              onConflict: 'empresa_id,competencia,categoria',
              ignoreDuplicates: false
            });

          if (insertError) {
            console.error('Error inserting sinistralidade:', insertError);
          } else {
            insertedCount++;
          }
        }
      }

      // Insert period indicators if present
      if (columnMapping.indicadores_periodo?.tipo) {
        const indicadores = columnMapping.indicadores_periodo;
        const meta = columnMapping.meta;

        const { error: indicadorError } = await supabaseAdmin
          .from('sinistralidade_indicadores_periodo')
          .insert({
            empresa_id: job.empresa_id,
            periodo_inicio: meta.periodo_inicio || new Date().toISOString().split('T')[0],
            periodo_fim: meta.periodo_fim || new Date().toISOString().split('T')[0],
            tipo_relatorio: indicadores.tipo,
            operadora: meta.operadora,
            produto: meta.produto,
            metricas: indicadores.metricas,
            quebras: indicadores.quebras,
            fonte_pdf_path: job.arquivo_url,
            import_job_id: job.id,
            criado_por: user.id
          });

        if (indicadorError) {
          console.error('Error inserting indicadores:', indicadorError);
        } else {
          indicadorInserted = true;
        }
      }

      // Update job status
      await supabaseAdmin
        .from('import_jobs')
        .update({
          status: 'completed',
          aprovado_por: user.id,
          data_aprovacao: new Date().toISOString(),
          applied_by: user.id,
          applied_at: new Date().toISOString()
        })
        .eq('id', jobId);

      return new Response(JSON.stringify({
        success: true,
        message: `Aprovação concluída. ${insertedCount} registros de sinistralidade inseridos.${indicadorInserted ? ' Indicadores de período também inseridos.' : ''}`,
        insertedCount,
        indicadorInserted
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in sinistralidade-pdf-agent:', error);
    
    // Check if it's a structured AIError
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const aiError = error as AIError;
      const statusCode = aiError.code === 'LOVABLE_AI_RATE_LIMIT' ? 429 
        : aiError.code === 'LOVABLE_AI_NO_BALANCE' ? 402 
        : 500;
      return new Response(JSON.stringify({ 
        error: aiError.message,
        code: aiError.code,
        details: aiError.details
      }), {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro interno',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? { stack: error.stack } : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
