import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.4.168/legacy/build/pdf.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

async function callOpenAIVision(pages: PageImage[]): Promise<{ content: string; tokensUsed: number }> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  console.log(`Calling OpenAI Vision API with ${pages.length} pages...`);

  // Build content array with images
  const contentArray: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
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
        detail: 'high'
      }
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: contentArray }
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI Vision API error:', response.status, error);
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('OpenAI Vision response received, tokens:', data.usage?.total_tokens);

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

async function callOpenAIText(text: string): Promise<{ content: string; tokensUsed: number }> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const clipped = text.length > 30000 ? text.slice(0, 30000) : text;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `O PDF não pôde ser renderizado em imagens no navegador. A seguir está o TEXTO extraído do PDF.\n\nTarefa: Retorne SOMENTE o JSON no schema especificado.\n\nTEXTO EXTRAÍDO:\n${clipped}`,
        },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI Text API error:', response.status, error);
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

function parseExtractedData(content: string): ExtractedData {
  // Remove markdown code blocks if present
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return parsed as ExtractedData;
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    console.error('Response content:', content);
    throw new Error('Falha ao interpretar resposta da IA');
  }
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
          const { content, tokensUsed: t } = await callOpenAIText(extractedText);
          tokensUsed = t;
          extractedData = parseExtractedData(content);
        }
      } else {
        if (!pages || pages.length === 0) {
          return new Response(JSON.stringify({ error: 'Nenhuma página enviada para análise', requestId, mode }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Call OpenAI Vision
        const { content, tokensUsed: t } = await callOpenAIVision(pages);
        tokensUsed = t;

        // Parse extracted data
        extractedData = parseExtractedData(content);
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
        model_used: 'gpt-4o',
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
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro interno',
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
