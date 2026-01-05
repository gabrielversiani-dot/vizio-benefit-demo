import { useState, useCallback } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Play, 
  Trash2, 
  Database, 
  Shield, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TestResult {
  id: string;
  category: string;
  name: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  message?: string;
  duration?: number;
}

export default function CentralTestes() {
  const { isAdminVizio, loading } = useEmpresa();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSeedingData, setIsSeedingData] = useState(false);
  const [isCleaningData, setIsCleaningData] = useState(false);
  const [seedStatus, setSeedStatus] = useState<"idle" | "success" | "error">("idle");
  const [seedMessage, setSeedMessage] = useState("");
  const [manualChecklist, setManualChecklist] = useState<Record<string, boolean>>({});

  // Protect route - only admin_vizio can access
  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdminVizio) {
    return <Navigate to="/" replace />;
  }

  const updateTestResult = (id: string, updates: Partial<TestResult>) => {
    setTestResults(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const runTest = async (
    id: string,
    category: string,
    name: string,
    testFn: () => Promise<{ passed: boolean; message: string }>
  ) => {
    const startTime = Date.now();
    addTestResult({ id, category, name, status: "running" });
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      updateTestResult(id, {
        status: result.passed ? "passed" : "failed",
        message: result.message,
        duration,
      });
      return result.passed;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      updateTestResult(id, {
        status: "failed",
        message: error.message || "Erro desconhecido",
        duration,
      });
      return false;
    }
  };

  // ========== SEED DATA ==========
  const handleSeedData = async () => {
    setIsSeedingData(true);
    setSeedStatus("idle");
    setSeedMessage("");

    try {
      // 1. Check/Create Empresa "Vilma Alimentos"
      let empresaId: string;
      const { data: existingEmpresa } = await supabase
        .from("empresas")
        .select("id")
        .eq("nome", "Vilma Alimentos")
        .single();

      if (existingEmpresa) {
        empresaId = existingEmpresa.id;
        setSeedMessage("Empresa 'Vilma Alimentos' já existe, reutilizando...");
      } else {
        const { data: newEmpresa, error: empresaError } = await supabase
          .from("empresas")
          .insert({
            nome: "Vilma Alimentos",
            cnpj: "00.000.000/0001-01",
            razao_social: "Vilma Alimentos S.A.",
            contato_email: "contato@vilmaalimentos.com",
            is_demo: true,
          })
          .select("id")
          .single();

        if (empresaError) throw empresaError;
        empresaId = newEmpresa.id;
      }

      // 2. Create test user if not exists (via edge function)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", "cliente@vilmaalimentos.com")
        .single();

      if (!existingProfile) {
        setSeedMessage("Criando usuário de teste...");
        // We'll skip user creation for now - admin must create manually or use edge function
        // The seed will document this requirement
      }

      // 3. Create Promoção de Saúde actions
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      // Delete existing test actions first
      await supabase
        .from("acoes_saude")
        .delete()
        .eq("empresa_id", empresaId)
        .like("titulo", "%[TESTE]%");

      // Create visible action
      const { data: acaoCliente, error: acaoClienteError } = await supabase
        .from("acoes_saude")
        .insert({
          empresa_id: empresaId,
          titulo: "[TESTE] Palestra Janeiro Branco",
          descricao: "Palestra sobre saúde mental no trabalho",
          tipo: "campanha",
          categoria: "saude_mental",
          campanha_mes: "Janeiro Branco",
          data_inicio: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          hora_inicio: "14:00",
          hora_fim: "16:00",
          local: "Auditório Principal",
          publico_alvo: "Todos os colaboradores",
          responsavel: "RH",
          status: "planejada",
          visibilidade: "cliente",
          criado_por: userData.user.id,
        })
        .select("id")
        .single();

      if (acaoClienteError) throw acaoClienteError;

      // Create internal action
      const { error: acaoInternaError } = await supabase
        .from("acoes_saude")
        .insert({
          empresa_id: empresaId,
          titulo: "[TESTE] Reunião interna de planejamento",
          descricao: "Planejamento das campanhas do trimestre",
          tipo: "evento",
          categoria: "outro",
          data_inicio: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          hora_inicio: "10:00",
          hora_fim: "12:00",
          local: "Sala de reuniões 1",
          status: "planejada",
          visibilidade: "interna",
          criado_por: userData.user.id,
        });

      if (acaoInternaError) throw acaoInternaError;

      // 4. Create material records (without actual files - admin must upload)
      if (acaoCliente) {
        await supabase
          .from("promocao_saude_materiais")
          .delete()
          .eq("acao_id", acaoCliente.id);

        await supabase.from("promocao_saude_materiais").insert([
          {
            empresa_id: empresaId,
            acao_id: acaoCliente.id,
            titulo: "[TESTE] Folder Janeiro Branco",
            descricao: "Folder para distribuição aos colaboradores",
            tipo: "folder",
            storage_path: `${empresaId}/acoes/${acaoCliente.id}/folder_janeiro_branco.pdf`,
            mime_type: "application/pdf",
            tamanho: 0,
            visivel_cliente: true,
          },
          {
            empresa_id: empresaId,
            acao_id: acaoCliente.id,
            titulo: "[TESTE] Roteiro Interno",
            descricao: "Documento interno - NÃO visível para cliente",
            tipo: "outro",
            storage_path: `${empresaId}/acoes/${acaoCliente.id}/roteiro_interno.docx`,
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            tamanho: 0,
            visivel_cliente: false,
          },
        ]);
      }

      // 5. Create Faturamento records
      await supabase
        .from("faturamentos")
        .delete()
        .eq("empresa_id", empresaId)
        .like("observacao", "%[TESTE]%");

      const hoje = new Date();
      const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15);
      const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 15);

      await supabase.from("faturamentos").insert([
        {
          empresa_id: empresaId,
          produto: "saude",
          competencia: mesPassado.toISOString().split("T")[0],
          vencimento: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 20).toISOString().split("T")[0],
          valor_total: 125000,
          status: "atraso",
          observacao: "[TESTE] Fatura vencida",
          criado_por: userData.user.id,
        },
        {
          empresa_id: empresaId,
          produto: "saude",
          competencia: mesAtual.toISOString().split("T")[0],
          vencimento: new Date(hoje.getFullYear(), hoje.getMonth(), 25).toISOString().split("T")[0],
          valor_total: 128000,
          status: "aguardando_pagamento",
          observacao: "[TESTE] Fatura a vencer",
          criado_por: userData.user.id,
        },
      ]);

      // 6. Create Contrato records
      await supabase
        .from("contratos")
        .delete()
        .eq("empresa_id", empresaId)
        .like("titulo", "%[TESTE]%");

      const { data: contratoData, error: contratoError } = await supabase
        .from("contratos")
        .insert({
          empresa_id: empresaId,
          titulo: "[TESTE] Contrato Plano Saúde Empresarial",
          tipo: "contrato",
          status: "ativo",
          data_inicio: new Date(hoje.getFullYear() - 1, 0, 1).toISOString().split("T")[0],
          data_fim: new Date(hoje.getFullYear(), 11, 31).toISOString().split("T")[0],
          valor_mensal: 125000,
          numero_contrato: "TESTE-2024-001",
          operadora: "Unimed",
          produto: "Saúde",
          arquivo_url: "pending",
          arquivo_nome: "contrato_teste.pdf",
          criado_por: userData.user.id,
        })
        .select("id")
        .single();

      if (!contratoError && contratoData) {
        // Create aditivo
        await supabase.from("contratos").insert({
          empresa_id: empresaId,
          titulo: "[TESTE] Aditivo Reajuste 2024",
          tipo: "aditivo",
          status: "ativo",
          contrato_pai_id: contratoData.id,
          data_inicio: new Date(hoje.getFullYear(), 0, 1).toISOString().split("T")[0],
          data_fim: new Date(hoje.getFullYear(), 11, 31).toISOString().split("T")[0],
          valor_mensal: 128000,
          reajuste_percentual: 8.5,
          operadora: "Unimed",
          produto: "Saúde",
          arquivo_url: "pending",
          arquivo_nome: "aditivo_teste.pdf",
          criado_por: userData.user.id,
        });
      }

      setSeedStatus("success");
      setSeedMessage(
        "Dados de teste criados com sucesso! Empresa: Vilma Alimentos. Para testar downloads, faça upload manual de arquivos nas ações criadas."
      );
      toast.success("Dados de teste criados!");
    } catch (error: any) {
      console.error("Erro ao criar seed:", error);
      setSeedStatus("error");
      setSeedMessage(`Erro: ${error.message}`);
      toast.error("Erro ao criar dados de teste");
    } finally {
      setIsSeedingData(false);
    }
  };

  // ========== CLEAN DATA ==========
  const handleCleanData = async () => {
    if (!confirm("Tem certeza que deseja limpar todos os dados de teste ([TESTE])?")) {
      return;
    }

    setIsCleaningData(true);
    try {
      // Find test empresa
      const { data: empresa } = await supabase
        .from("empresas")
        .select("id")
        .eq("nome", "Vilma Alimentos")
        .single();

      if (empresa) {
        // Delete in order (respecting FK constraints)
        await supabase.from("promocao_saude_materiais").delete().eq("empresa_id", empresa.id);
        await supabase.from("acoes_saude").delete().eq("empresa_id", empresa.id).like("titulo", "%[TESTE]%");
        await supabase.from("faturamento_documentos").delete().eq("faturamento_id", empresa.id);
        await supabase.from("faturamentos").delete().eq("empresa_id", empresa.id).like("observacao", "%[TESTE]%");
        await supabase.from("contratos").delete().eq("empresa_id", empresa.id).like("titulo", "%[TESTE]%");
      }

      setSeedStatus("idle");
      setSeedMessage("");
      toast.success("Dados de teste removidos!");
    } catch (error: any) {
      toast.error(`Erro ao limpar: ${error.message}`);
    } finally {
      setIsCleaningData(false);
    }
  };

  // ========== RUN TESTS ==========
  const handleRunTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);

    try {
      // Find test empresa
      const { data: empresa } = await supabase
        .from("empresas")
        .select("id")
        .eq("nome", "Vilma Alimentos")
        .single();

      if (!empresa) {
        toast.error("Execute 'Criar dados de teste' primeiro!");
        setIsRunningTests(false);
        return;
      }

      const empresaId = empresa.id;

      // ===== PROMOÇÃO DE SAÚDE - BANCO =====
      await runTest("ps-list", "Promoção de Saúde - Banco", "Listar ações da empresa", async () => {
        const { data, error } = await supabase
          .from("acoes_saude")
          .select("*")
          .eq("empresa_id", empresaId);
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 2,
          message: `Encontradas ${data?.length ?? 0} ações`,
        };
      });

      await runTest("ps-cliente", "Promoção de Saúde - Banco", "Ação visibilidade=cliente existe", async () => {
        const { data, error } = await supabase
          .from("acoes_saude")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("visibilidade", "cliente")
          .like("titulo", "%[TESTE]%");
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 1,
          message: data?.length ? `Ação: ${data[0].titulo}` : "Nenhuma ação cliente encontrada",
        };
      });

      await runTest("ps-interna", "Promoção de Saúde - Banco", "Ação visibilidade=interna existe", async () => {
        const { data, error } = await supabase
          .from("acoes_saude")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("visibilidade", "interna")
          .like("titulo", "%[TESTE]%");
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 1,
          message: data?.length ? `Ação: ${data[0].titulo}` : "Nenhuma ação interna encontrada",
        };
      });

      await runTest("ps-materiais", "Promoção de Saúde - Banco", "Materiais vinculados existem", async () => {
        const { data, error } = await supabase
          .from("promocao_saude_materiais")
          .select("*, acoes_saude!inner(titulo)")
          .eq("empresa_id", empresaId);
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 2,
          message: `Encontrados ${data?.length ?? 0} materiais`,
        };
      });

      await runTest("ps-mat-visivel", "Promoção de Saúde - Banco", "Material visivel_cliente=true existe", async () => {
        const { data, error } = await supabase
          .from("promocao_saude_materiais")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("visivel_cliente", true);
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 1,
          message: data?.length ? `Material: ${data[0].titulo}` : "Nenhum material visível encontrado",
        };
      });

      await runTest("ps-mat-oculto", "Promoção de Saúde - Banco", "Material visivel_cliente=false existe", async () => {
        const { data, error } = await supabase
          .from("promocao_saude_materiais")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("visivel_cliente", false);
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 1,
          message: data?.length ? `Material: ${data[0].titulo}` : "Nenhum material oculto encontrado",
        };
      });

      // ===== FATURAMENTO =====
      await runTest("fat-list", "Faturamento", "Listar faturas da empresa", async () => {
        const { data, error } = await supabase
          .from("faturamentos")
          .select("*")
          .eq("empresa_id", empresaId)
          .like("observacao", "%[TESTE]%");
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 2,
          message: `Encontradas ${data?.length ?? 0} faturas de teste`,
        };
      });

      await runTest("fat-atraso", "Faturamento", "Fatura em atraso existe", async () => {
        const { data, error } = await supabase
          .from("faturamentos")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("status", "atraso");
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 1,
          message: data?.length ? "Fatura em atraso encontrada" : "Nenhuma fatura em atraso",
        };
      });

      // ===== CONTRATOS =====
      await runTest("cont-list", "Contratos", "Listar contratos da empresa", async () => {
        const { data, error } = await supabase
          .from("contratos")
          .select("*")
          .eq("empresa_id", empresaId)
          .like("titulo", "%[TESTE]%");
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 1,
          message: `Encontrados ${data?.length ?? 0} contratos de teste`,
        };
      });

      await runTest("cont-aditivo", "Contratos", "Aditivo vinculado existe", async () => {
        const { data, error } = await supabase
          .from("contratos")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("tipo", "aditivo")
          .like("titulo", "%[TESTE]%");
        
        if (error) throw error;
        return {
          passed: (data?.length ?? 0) >= 1,
          message: data?.length ? `Aditivo: ${data[0].titulo}` : "Nenhum aditivo encontrado",
        };
      });

      // ===== RLS TESTS (admin perspective) =====
      await runTest("rls-admin-read", "Segurança (RLS)", "Admin pode ler todas ações", async () => {
        const { data, error } = await supabase
          .from("acoes_saude")
          .select("*")
          .eq("empresa_id", empresaId);
        
        if (error) throw error;
        const internas = data?.filter(a => a.visibilidade === "interna");
        return {
          passed: (internas?.length ?? 0) >= 1,
          message: `Admin vê ${internas?.length ?? 0} ações internas`,
        };
      });

      await runTest("rls-admin-mats", "Segurança (RLS)", "Admin pode ler todos materiais", async () => {
        const { data, error } = await supabase
          .from("promocao_saude_materiais")
          .select("*")
          .eq("empresa_id", empresaId);
        
        if (error) throw error;
        const ocultos = data?.filter(m => !m.visivel_cliente);
        return {
          passed: (ocultos?.length ?? 0) >= 1,
          message: `Admin vê ${ocultos?.length ?? 0} materiais ocultos`,
        };
      });

      toast.success("Testes concluídos!");
    } catch (error: any) {
      toast.error(`Erro nos testes: ${error.message}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  const passedTests = testResults.filter(t => t.status === "passed").length;
  const failedTests = testResults.filter(t => t.status === "failed").length;

  // ========== MANUAL CHECKLIST ==========
  const checklistItems = [
    // Promoção de Saúde
    { id: "ps-1", category: "Promoção de Saúde", text: "Admin cria ação 'cliente' no calendário" },
    { id: "ps-2", category: "Promoção de Saúde", text: "Admin faz upload de material (WhatsApp/Folder)" },
    { id: "ps-3", category: "Promoção de Saúde", text: "Admin marca 1 material como 'não visível ao cliente'" },
    { id: "ps-4", category: "Promoção de Saúde", text: "Cliente vê ação no calendário e lista" },
    { id: "ps-5", category: "Promoção de Saúde", text: "Cliente consegue baixar material visível" },
    { id: "ps-6", category: "Promoção de Saúde", text: "Cliente NÃO vê ação interna" },
    { id: "ps-7", category: "Promoção de Saúde", text: "Admin altera status para 'em_andamento' e 'concluida'" },
    { id: "ps-8", category: "Promoção de Saúde", text: "Admin exclui ação → materiais somem (cascade)" },
    
    // Sinistralidade
    { id: "sin-1", category: "Sinistralidade", text: "KPIs carregam (Índice Médio, Prêmio, Sinistros, Vidas)" },
    { id: "sin-2", category: "Sinistralidade", text: "Gráfico mostra 12 meses" },
    { id: "sin-3", category: "Sinistralidade", text: "Tooltip mostra Prêmio, Sinistros e IU%" },
    
    // Faturamento
    { id: "fat-1", category: "Faturamento", text: "Criar fatura de Saúde, Odonto e Vida" },
    { id: "fat-2", category: "Faturamento", text: "Fatura vencida mostra status 'Em atraso'" },
    { id: "fat-3", category: "Faturamento", text: "Admin altera status para 'Pago'" },
    { id: "fat-4", category: "Faturamento", text: "Upload e download de boleto/NF funciona" },
    
    // Contratos
    { id: "cont-1", category: "Contratos", text: "Criar contrato + aditivo" },
    { id: "cont-2", category: "Contratos", text: "Upload e download de documento funciona" },
    { id: "cont-3", category: "Contratos", text: "Filtros por tipo e status funcionam" },
  ];

  const groupedChecklist = checklistItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof checklistItems>);

  const completedChecks = Object.values(manualChecklist).filter(Boolean).length;
  const totalChecks = checklistItems.length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central de Testes</h1>
            <p className="text-muted-foreground">
              Validação E2E do sistema - Promoção de Saúde, Faturamento, Contratos, Sinistralidade
            </p>
          </div>
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            Apenas Admin Vizio
          </Badge>
        </div>

        <Tabs defaultValue="seed" className="space-y-4">
          <TabsList>
            <TabsTrigger value="seed">
              <Database className="h-4 w-4 mr-2" />
              Dados de Teste
            </TabsTrigger>
            <TabsTrigger value="auto">
              <Play className="h-4 w-4 mr-2" />
              Testes Automáticos
            </TabsTrigger>
            <TabsTrigger value="manual">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Checklist Manual ({completedChecks}/{totalChecks})
            </TabsTrigger>
          </TabsList>

          {/* SEED DATA TAB */}
          <TabsContent value="seed">
            <Card>
              <CardHeader>
                <CardTitle>Seed de Dados</CardTitle>
                <CardDescription>
                  Cria empresa de teste (Vilma Alimentos) com ações, materiais, faturas e contratos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button onClick={handleSeedData} disabled={isSeedingData}>
                    {isSeedingData ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4 mr-2" />
                    )}
                    Criar Dados de Teste
                  </Button>
                  <Button variant="destructive" onClick={handleCleanData} disabled={isCleaningData}>
                    {isCleaningData ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Limpar Dados de Teste
                  </Button>
                </div>

                {seedMessage && (
                  <div
                    className={`p-4 rounded-lg ${
                      seedStatus === "success"
                        ? "bg-green-50 text-green-800 border border-green-200"
                        : seedStatus === "error"
                        ? "bg-red-50 text-red-800 border border-red-200"
                        : "bg-blue-50 text-blue-800 border border-blue-200"
                    }`}
                  >
                    {seedMessage}
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">O que será criado:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Empresa: <strong>Vilma Alimentos</strong> (is_demo=true)</li>
                    <li>2 Ações de Promoção de Saúde (1 cliente, 1 interna)</li>
                    <li>2 Materiais (1 visível, 1 oculto) - sem arquivo real</li>
                    <li>2 Faturas (1 vencida, 1 a vencer)</li>
                    <li>1 Contrato + 1 Aditivo</li>
                  </ul>
                </div>

                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="text-sm text-amber-800">
                      <strong>Para testar downloads:</strong> Após criar os dados, vá em Promoção de Saúde e faça upload manual de arquivos (PDF, imagens) nas ações criadas. Os registros de materiais já estão prontos para receber os arquivos.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUTOMATED TESTS TAB */}
          <TabsContent value="auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Testes Automatizados</span>
                  {testResults.length > 0 && (
                    <div className="flex gap-2">
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {passedTests}
                      </Badge>
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        {failedTests}
                      </Badge>
                    </div>
                  )}
                </CardTitle>
                <CardDescription>
                  Valida banco de dados, RLS e permissões automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleRunTests} disabled={isRunningTests}>
                  {isRunningTests ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Rodar Testes Automáticos
                </Button>

                {testResults.length > 0 && (
                  <ScrollArea className="h-[400px] border rounded-lg p-4">
                    <div className="space-y-3">
                      {testResults.map((test) => (
                        <div
                          key={test.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          {test.status === "running" && (
                            <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
                          )}
                          {test.status === "passed" && (
                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                          )}
                          {test.status === "failed" && (
                            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                          )}
                          {test.status === "pending" && (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {test.category}
                              </Badge>
                              <span className="font-medium text-sm">{test.name}</span>
                              {test.duration && (
                                <span className="text-xs text-muted-foreground">
                                  {test.duration}ms
                                </span>
                              )}
                            </div>
                            {test.message && (
                              <p className="text-sm text-muted-foreground mt-1">{test.message}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MANUAL CHECKLIST TAB */}
          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>Checklist E2E Manual</CardTitle>
                <CardDescription>
                  Siga este checklist para validar manualmente todas as funcionalidades
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3 flex-wrap">
                  <Button variant="outline" asChild>
                    <a href="/promocao-saude" target="_blank">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Promoção de Saúde
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/sinistralidade" target="_blank">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Sinistralidade
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/faturamento" target="_blank">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Faturamento
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/contratos" target="_blank">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Contratos
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setManualChecklist({})}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resetar Checklist
                  </Button>
                </div>

                <Separator />

                <div className="space-y-6">
                  {Object.entries(groupedChecklist).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="font-semibold text-lg mb-3">{category}</h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              id={item.id}
                              checked={manualChecklist[item.id] || false}
                              onCheckedChange={(checked) =>
                                setManualChecklist((prev) => ({
                                  ...prev,
                                  [item.id]: checked === true,
                                }))
                              }
                            />
                            <label
                              htmlFor={item.id}
                              className={`text-sm cursor-pointer ${
                                manualChecklist[item.id]
                                  ? "text-muted-foreground line-through"
                                  : ""
                              }`}
                            >
                              {item.text}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {completedChecks === totalChecks && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">
                        Todos os testes manuais foram concluídos!
                      </p>
                      <p className="text-sm text-green-700">
                        O sistema está validado e pronto para uso.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
