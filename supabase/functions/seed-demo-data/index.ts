import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEMO_EMPRESA_NOME = "Capital Vizio";
const DEMO_PREFIX = "[DEMO]";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate user is admin_vizio
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if user has admin_vizio role
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: roleData } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin_vizio')
    .single();

  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Apenas admin_vizio pode executar esta função' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { mode, seedId: providedSeedId } = body as { mode: 'create' | 'cleanup' | 'reset'; seedId?: string };

    if (!['create', 'cleanup', 'reset'].includes(mode)) {
      return new Response(JSON.stringify({ error: 'Mode deve ser: create, cleanup ou reset' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const seedId = providedSeedId || crypto.randomUUID();
    const logs: string[] = [];
    const log = (msg: string) => {
      console.log(msg);
      logs.push(msg);
    };

    log(`🚀 Iniciando seed-demo-data em modo: ${mode}`);
    log(`📌 Seed ID: ${seedId}`);

    // 1. Find or create demo empresa - CRITICAL: Only work with demo empresa
    let empresaDemoId: string;
    const { data: existingEmpresa } = await adminClient
      .from('empresas')
      .select('id, nome, is_demo')
      .eq('nome', DEMO_EMPRESA_NOME)
      .single();

    if (existingEmpresa) {
      if (!existingEmpresa.is_demo) {
        return new Response(JSON.stringify({ 
          error: `Empresa "${DEMO_EMPRESA_NOME}" existe mas NÃO está marcada como demo. Abortando por segurança.` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      empresaDemoId = existingEmpresa.id;
      log(`✅ Empresa demo encontrada: ${empresaDemoId}`);
    } else {
      const { data: newEmpresa, error: createError } = await adminClient
        .from('empresas')
        .insert({
          nome: DEMO_EMPRESA_NOME,
          cnpj: '00.000.000/0001-00',
          razao_social: 'Capital Vizio Demo S.A.',
          contato_email: 'demo@capitalvizio.com.br',
          is_demo: true,
          ativo: true,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      empresaDemoId = newEmpresa.id;
      log(`🆕 Empresa demo criada: ${empresaDemoId}`);
    }

    // 1.5 Create demo user if needed
    const DEMO_USER_EMAIL = 'cliente.demo@capitalvizio.com.br';
    const DEMO_USER_PASSWORD = 'Demo@2025!';
    
    const { data: existingDemoUser } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', DEMO_USER_EMAIL)
      .single();

    let demoUserId: string | null = null;
    let demoUserCreated = false;

    if (!existingDemoUser) {
      log(`👤 Criando usuário demo: ${DEMO_USER_EMAIL}...`);
      
      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
        email_confirm: true,
        user_metadata: { nome_completo: 'Cliente Demo' }
      });

      if (userError) {
        log(`⚠️ Erro ao criar usuário demo: ${userError.message}`);
      } else {
        demoUserId = newUser.user.id;
        demoUserCreated = true;
        log(`✅ Usuário demo criado: ${demoUserId}`);

        // Update profile with empresa_id
        await adminClient
          .from('profiles')
          .update({ empresa_id: empresaDemoId })
          .eq('id', demoUserId);

        // Add visualizador role (read-only client)
        await adminClient
          .from('user_roles')
          .insert({ user_id: demoUserId, role: 'visualizador' });

        log(`✅ Perfil vinculado à empresa demo + role visualizador`);
      }
    } else {
      demoUserId = existingDemoUser.id;
      log(`👤 Usuário demo já existe: ${DEMO_USER_EMAIL}`);
      
      // Ensure profile is linked to demo empresa
      await adminClient
        .from('profiles')
        .update({ empresa_id: empresaDemoId })
        .eq('id', demoUserId);
    }

    // SAFETY CHECK: Verify empresa is demo before any operations
    const { data: verifyEmpresa } = await adminClient
      .from('empresas')
      .select('is_demo')
      .eq('id', empresaDemoId)
      .single();

    if (!verifyEmpresa?.is_demo) {
      return new Response(JSON.stringify({ error: 'Falha na verificação de segurança: empresa não é demo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== CLEANUP ==========
    if (mode === 'cleanup' || mode === 'reset') {
      log('🧹 Iniciando limpeza de dados demo...');

      // Delete in order (respecting FK constraints)
      // 1. Materiais de promoção de saúde
      const { count: matCount } = await adminClient
        .from('promocao_saude_materiais')
        .delete({ count: 'exact' })
        .eq('empresa_id', empresaDemoId)
        .like('titulo', `${DEMO_PREFIX}%`);
      log(`  - Materiais removidos: ${matCount || 0}`);

      // 2. Ações de saúde
      const { count: acoesCount } = await adminClient
        .from('acoes_saude')
        .delete({ count: 'exact' })
        .eq('empresa_id', empresaDemoId)
        .like('titulo', `${DEMO_PREFIX}%`);
      log(`  - Ações de saúde removidas: ${acoesCount || 0}`);

      // 3. Documentos de contrato
      const { count: contDocCount } = await adminClient
        .from('contrato_documentos')
        .delete({ count: 'exact' })
        .eq('empresa_id', empresaDemoId)
        .like('arquivo_nome', `${DEMO_PREFIX}%`);
      log(`  - Documentos de contrato removidos: ${contDocCount || 0}`);

      // 4. Contratos
      const { count: contCount } = await adminClient
        .from('contratos')
        .delete({ count: 'exact' })
        .eq('empresa_id', empresaDemoId)
        .like('titulo', `${DEMO_PREFIX}%`);
      log(`  - Contratos removidos: ${contCount || 0}`);

      // 5. Sinistralidade mensal
      const { count: sinMensalCount } = await adminClient
        .from('sinistralidade')
        .delete({ count: 'exact' })
        .eq('empresa_id', empresaDemoId)
        .like('operadora', `${DEMO_PREFIX}%`);
      log(`  - Sinistralidade mensal removida: ${sinMensalCount || 0}`);

      // 6. Indicadores de período
      const { count: indCount } = await adminClient
        .from('sinistralidade_indicadores_periodo')
        .delete({ count: 'exact' })
        .eq('empresa_id', empresaDemoId)
        .like('operadora', `${DEMO_PREFIX}%`);
      log(`  - Indicadores de período removidos: ${indCount || 0}`);

      // 7. Faturamento
      const { count: fatCount } = await adminClient
        .from('faturamento')
        .delete({ count: 'exact' })
        .eq('empresa_id', empresaDemoId);
      log(`  - Faturas removidas: ${fatCount || 0}`);

      log('✅ Limpeza concluída!');

      if (mode === 'cleanup') {
        return new Response(JSON.stringify({ 
          success: true, 
          mode,
          seedId,
          empresaDemoId,
          logs 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ========== CREATE ==========
    if (mode === 'create' || mode === 'reset') {
      log('📝 Iniciando criação de dados demo...');

      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = hoje.getMonth();

      // ========== A) CONTRATOS ==========
      log('📄 Criando contratos...');
      
      const produtos = ['saude', 'odonto', 'vida_em_grupo'];
      const contratosIds: Record<string, string> = {};

      for (const produto of produtos) {
        // Contrato principal
        const { data: contrato, error: contError } = await adminClient
          .from('contratos')
          .insert({
            empresa_id: empresaDemoId,
            titulo: `${DEMO_PREFIX} Contrato ${produto.charAt(0).toUpperCase() + produto.slice(1).replace('_', ' ')} - Capital Vizio`,
            tipo: 'contrato',
            numero_contrato: `DEMO-${ano}-${produto.toUpperCase().slice(0, 3)}-001`,
            status: 'ativo',
            data_inicio: `${ano}-01-01`,
            data_fim: `${ano}-12-31`,
            valor_mensal: produto === 'saude' ? 450000 : produto === 'odonto' ? 85000 : 120000,
            produto: produto === 'saude' ? 'Saúde' : produto === 'odonto' ? 'Odonto' : 'Vida em Grupo',
            operadora: produto === 'saude' ? 'Unimed BH' : produto === 'odonto' ? 'Odontoprev' : 'MetLife',
            arquivo_url: `demo/${empresaDemoId}/contratos/${produto}/contrato.pdf`,
            arquivo_nome: `${DEMO_PREFIX} Contrato ${produto}.pdf`,
            assinado: true,
            data_assinatura: `${ano - 1}-12-15`,
            criado_por: user.id,
          })
          .select('id')
          .single();

        if (contError) throw contError;
        contratosIds[produto] = contrato.id;
        log(`  ✓ Contrato ${produto}: ${contrato.id}`);

        // Aditivo
        await adminClient.from('contratos').insert({
          empresa_id: empresaDemoId,
          titulo: `${DEMO_PREFIX} Aditivo Reajuste ${ano} - ${produto}`,
          tipo: 'aditivo',
          contrato_pai_id: contrato.id,
          numero_contrato: `DEMO-${ano}-${produto.toUpperCase().slice(0, 3)}-ADT-001`,
          status: 'ativo',
          data_inicio: `${ano}-01-01`,
          data_fim: `${ano}-12-31`,
          valor_mensal: produto === 'saude' ? 486000 : produto === 'odonto' ? 91800 : 129600,
          reajuste_percentual: 8.0,
          produto: produto === 'saude' ? 'Saúde' : produto === 'odonto' ? 'Odonto' : 'Vida em Grupo',
          operadora: produto === 'saude' ? 'Unimed BH' : produto === 'odonto' ? 'Odontoprev' : 'MetLife',
          arquivo_url: `demo/${empresaDemoId}/contratos/${produto}/aditivo.pdf`,
          arquivo_nome: `${DEMO_PREFIX} Aditivo ${produto}.pdf`,
          assinado: true,
          data_assinatura: `${ano}-01-05`,
          criado_por: user.id,
        });
        log(`  ✓ Aditivo ${produto} criado`);
      }

      // ========== B) FATURAMENTO ==========
      log('💰 Criando faturamento (12 meses)...');

      const categoriasBeneficio = ['saude', 'odonto', 'vida'] as const;
      
      for (const categoria of categoriasBeneficio) {
        const valorBase = categoria === 'saude' ? 500000 : categoria === 'odonto' ? 95000 : 130000;
        const vidasBase = categoria === 'saude' ? 3800 : categoria === 'odonto' ? 3200 : 3500;

        for (let i = 11; i >= 0; i--) {
          const dataCompetencia = new Date(ano, mes - i, 1);
          const dataVencimento = new Date(ano, mes - i, 20);
          
          // Variação aleatória de 2-5%
          const variacao = 1 + (Math.random() * 0.03 - 0.015);
          const valorTotal = Math.round(valorBase * variacao);
          const vidas = Math.round(vidasBase * (1 + (Math.random() * 0.02 - 0.01)));

          let status = 'pago';
          let dataPagamento: string | null = new Date(dataVencimento.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          // 2 em atraso (mais recentes), 2 aguardando
          if (i === 0) {
            status = 'atraso';
            dataPagamento = null;
          } else if (i === 1) {
            status = 'aguardando_pagamento';
            dataPagamento = null;
          }

          await adminClient.from('faturamento').insert({
            empresa_id: empresaDemoId,
            competencia: dataCompetencia.toISOString().split('T')[0],
            categoria,
            valor_mensalidade: Math.round(valorTotal * 0.85),
            valor_coparticipacao: Math.round(valorTotal * 0.10),
            valor_reembolsos: Math.round(valorTotal * 0.05),
            valor_total: valorTotal,
            total_vidas: vidas,
            total_titulares: Math.round(vidas * 0.6),
            total_dependentes: Math.round(vidas * 0.4),
            status,
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            data_pagamento: dataPagamento,
            criado_por: user.id,
          });
        }
        log(`  ✓ 12 faturas ${categoria} criadas`);
      }

      // ========== C) SINISTRALIDADE ==========
      log('📊 Criando sinistralidade...');

      // 12 meses de dados mensais
      const sinistrosData = [];
      let totalPremio = 0;
      let totalSinistros = 0;
      let totalVidas = 0;
      let totalMeses = 0;

      for (let i = 11; i >= 0; i--) {
        const dataCompetencia = new Date(ano, mes - i, 1);
        const premio = 500000 + Math.round(Math.random() * 50000);
        const iu = 70 + Math.round(Math.random() * 18); // 70% a 88%
        const sinistros = Math.round(premio * (iu / 100));
        const vidas = 3700 + Math.round(Math.random() * 200);

        totalPremio += premio;
        totalSinistros += sinistros;
        totalVidas += vidas;
        totalMeses++;

        sinistrosData.push({
          empresa_id: empresaDemoId,
          competencia: dataCompetencia.toISOString().split('T')[0],
          categoria: 'saude' as const,
          valor_premio: premio,
          valor_sinistros: sinistros,
          quantidade_sinistros: Math.round(sinistros / 1500),
          indice_sinistralidade: iu,
          vidas,
          vidas_ativas: vidas,
          media: iu,
          operadora: `${DEMO_PREFIX} Unimed BH`,
          produto: 'Saúde',
          criado_por: user.id,
        });
      }

      await adminClient.from('sinistralidade').insert(sinistrosData);
      log(`  ✓ 12 meses de sinistralidade mensal criados`);

      // Indicador de período
      const mediaPeriodo = Math.round((totalSinistros / totalPremio) * 10000) / 100;
      await adminClient.from('sinistralidade_indicadores_periodo').insert({
        empresa_id: empresaDemoId,
        periodo_inicio: new Date(ano, mes - 11, 1).toISOString().split('T')[0],
        periodo_fim: new Date(ano, mes, 0).toISOString().split('T')[0],
        tipo_relatorio: 'consolidado',
        operadora: `${DEMO_PREFIX} Unimed BH`,
        produto: 'Saúde',
        media_periodo: mediaPeriodo,
        premio_medio_periodo: Math.round(totalPremio / totalMeses),
        sinistros_medio_periodo: Math.round(totalSinistros / totalMeses),
        vidas_ativas_media_periodo: Math.round(totalVidas / totalMeses),
        metricas: {
          demo: true,
          seed_id: seedId,
          total_meses: totalMeses,
          total_premio: totalPremio,
          total_sinistros: totalSinistros,
        },
        criado_por: user.id,
      });
      log(`  ✓ Indicador de período criado (média: ${mediaPeriodo}%)`);

      // ========== D) PROMOÇÃO DE SAÚDE ==========
      log('🏥 Criando ações de promoção de saúde...');

      const acoesConfig = [
        // 6 visíveis ao cliente
        { titulo: 'Palestra Janeiro Branco', campanha: 'Janeiro Branco', tipo: 'campanha', categoria: 'saude_mental', visibilidade: 'cliente', mesOffset: 0 },
        { titulo: 'Campanha Outubro Rosa', campanha: 'Outubro Rosa', tipo: 'campanha', categoria: 'prevencao', visibilidade: 'cliente', mesOffset: -3 },
        { titulo: 'Semana da Saúde Bucal', campanha: null, tipo: 'evento', categoria: 'checkup', visibilidade: 'cliente', mesOffset: -1 },
        { titulo: 'Ginástica Laboral - Programa', campanha: null, tipo: 'programa', categoria: 'atividade_fisica', visibilidade: 'cliente', mesOffset: 0 },
        { titulo: 'Vacinação Antigripal', campanha: null, tipo: 'campanha', categoria: 'vacinacao', visibilidade: 'cliente', mesOffset: -2 },
        { titulo: 'Workshop Nutrição Saudável', campanha: null, tipo: 'treinamento', categoria: 'nutricional', visibilidade: 'cliente', mesOffset: 1 },
        // 2 internas
        { titulo: 'Planejamento Campanhas Q1', campanha: null, tipo: 'evento', categoria: 'outro', visibilidade: 'interna', mesOffset: 0 },
        { titulo: 'Reunião Comitê Saúde', campanha: null, tipo: 'evento', categoria: 'outro', visibilidade: 'interna', mesOffset: -1 },
      ];

      const acoesIds: { id: string; visibilidade: string; titulo: string }[] = [];

      for (const config of acoesConfig) {
        const dataInicio = new Date(ano, mes + config.mesOffset, 15);
        
        const { data: acao, error: acaoError } = await adminClient
          .from('acoes_saude')
          .insert({
            empresa_id: empresaDemoId,
            titulo: `${DEMO_PREFIX} ${config.titulo}`,
            descricao: `Descrição da ação: ${config.titulo}. Esta é uma ação demo para demonstração do sistema.`,
            tipo: config.tipo as any,
            categoria: config.categoria as any,
            campanha_mes: config.campanha,
            data_inicio: dataInicio.toISOString().split('T')[0],
            hora_inicio: '09:00',
            hora_fim: '17:00',
            local: 'Auditório Principal - Sede',
            publico_alvo: 'Todos os colaboradores',
            responsavel: 'Equipe de RH',
            status: config.mesOffset < 0 ? 'concluida' : 'planejada',
            visibilidade: config.visibilidade as any,
            criado_por: user.id,
          })
          .select('id')
          .single();

        if (acaoError) throw acaoError;
        acoesIds.push({ id: acao.id, visibilidade: config.visibilidade, titulo: config.titulo });
        log(`  ✓ Ação: ${config.titulo} (${config.visibilidade})`);
      }

      // Materiais para ações visíveis
      log('📎 Criando materiais...');
      const acoesVisiveis = acoesIds.filter(a => a.visibilidade === 'cliente').slice(0, 4);
      
      for (const acao of acoesVisiveis) {
        // Material WhatsApp (imagem) - visível
        await adminClient.from('promocao_saude_materiais').insert({
          empresa_id: empresaDemoId,
          acao_id: acao.id,
          titulo: `${DEMO_PREFIX} Card WhatsApp - ${acao.titulo}`,
          descricao: 'Card para divulgação no WhatsApp corporativo',
          tipo: 'whatsapp',
          storage_bucket: 'promocao-saude',
          storage_path: `demo/${empresaDemoId}/materiais/${acao.id}/whatsapp.png`,
          mime_type: 'image/png',
          tamanho: 102400,
          visivel_cliente: true,
        });

        // Material Folder (PDF) - visível
        await adminClient.from('promocao_saude_materiais').insert({
          empresa_id: empresaDemoId,
          acao_id: acao.id,
          titulo: `${DEMO_PREFIX} Folder - ${acao.titulo}`,
          descricao: 'Folder informativo para distribuição',
          tipo: 'folder',
          storage_bucket: 'promocao-saude',
          storage_path: `demo/${empresaDemoId}/materiais/${acao.id}/folder.pdf`,
          mime_type: 'application/pdf',
          tamanho: 512000,
          visivel_cliente: true,
        });
      }
      log(`  ✓ ${acoesVisiveis.length * 2} materiais visíveis criados`);

      // 2 materiais internos
      const primeiraAcaoVisivel = acoesVisiveis[0];
      if (primeiraAcaoVisivel) {
        await adminClient.from('promocao_saude_materiais').insert([
          {
            empresa_id: empresaDemoId,
            acao_id: primeiraAcaoVisivel.id,
            titulo: `${DEMO_PREFIX} Roteiro Interno`,
            descricao: 'Documento interno - NÃO visível para cliente',
            tipo: 'outro',
            storage_bucket: 'promocao-saude',
            storage_path: `demo/${empresaDemoId}/materiais/${primeiraAcaoVisivel.id}/roteiro_interno.docx`,
            mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            tamanho: 45000,
            visivel_cliente: false,
          },
          {
            empresa_id: empresaDemoId,
            acao_id: primeiraAcaoVisivel.id,
            titulo: `${DEMO_PREFIX} Checklist Organização`,
            descricao: 'Checklist interno para organização do evento',
            tipo: 'outro',
            storage_bucket: 'promocao-saude',
            storage_path: `demo/${empresaDemoId}/materiais/${primeiraAcaoVisivel.id}/checklist.pdf`,
            mime_type: 'application/pdf',
            tamanho: 28000,
            visivel_cliente: false,
          },
        ]);
        log(`  ✓ 2 materiais internos criados`);
      }

      log('✅ Seed demo concluído com sucesso!');
      log(`📊 Resumo:`);
      log(`  - Empresa: ${DEMO_EMPRESA_NOME} (${empresaDemoId})`);
      log(`  - Contratos: 6 (2 por produto)`);
      log(`  - Faturas: 36 (12 meses x 3 categorias)`);
      log(`  - Sinistralidade: 12 meses + 1 indicador período`);
      log(`  - Ações: 8 (6 cliente + 2 interna)`);
      log(`  - Materiais: 10 (8 visíveis + 2 internos)`);
      if (demoUserCreated) {
        log(`  - 👤 Usuário demo: cliente.demo@capitalvizio.com.br / Demo@2025!`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        mode,
        seedId,
        empresaDemoId,
        empresaNome: DEMO_EMPRESA_NOME,
        demoUser: {
          email: 'cliente.demo@capitalvizio.com.br',
          password: 'Demo@2025!',
          created: demoUserCreated,
          role: 'visualizador'
        },
        summary: {
          contratos: 6,
          faturas: 36,
          sinistralidade_meses: 12,
          indicadores: 1,
          acoes: 8,
          materiais: 10,
        },
        logs 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Mode inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro no seed-demo-data:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Erro interno',
      details: error.toString() 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
