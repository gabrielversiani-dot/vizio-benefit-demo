import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, TrendingDown, TrendingUp, AlertTriangle, FileText, Building2, Stethoscope, FlaskConical, BedDouble, Scissors, Upload, Info } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImportPDFModal } from "@/components/Sinistralidade/ImportPDFModal";
import { ImportHistorySection } from "@/components/Sinistralidade/ImportHistorySection";
import { IndicadoresPeriodoSection } from "@/components/Sinistralidade/IndicadoresPeriodoSection";
import { PDFImportChecklist } from "@/components/Sinistralidade/PDFImportChecklist";
import { SinistroDocsSection } from "@/components/Sinistralidade/SinistroDocsSection";
import { useAuth } from "@/hooks/useAuth";
import { useSinistralidadeResumoPeriodo } from "@/hooks/useSinistralidadeResumoPeriodo";

type Sinistralidade = {
  id: string;
  empresa_id: string;
  competencia: string;
  categoria: string;
  valor_premio: number;
  valor_sinistros: number;
  quantidade_sinistros: number;
  indice_sinistralidade: number | null;
  sinistros_consultas: number | null;
  sinistros_exames: number | null;
  sinistros_internacoes: number | null;
  sinistros_procedimentos: number | null;
  sinistros_outros: number | null;
};

type Empresa = {
  id: string;
  nome: string;
};

// Tipos de fonte de dados para o KPI
type KpiSource = "pdf_importado" | "calculado_12" | "calculado_6" | "calculado_24";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export default function Sinistralidade() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { empresaSelecionada } = useEmpresa();
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas");
  const [kpiSource, setKpiSource] = useState<KpiSource>("pdf_importado");
  const [periodoFilter, setPeriodoFilter] = useState<string>("12");
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Hook para buscar média do período do PDF
  const { resumo, mediaFinal, hasPdfMedia, isLoading: isLoadingResumo } = useSinistralidadeResumoPeriodo(
    empresaSelecionada,
    kpiSource === "pdf_importado"
  );

  // Check user roles
  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return data?.map(r => r.role) || [];
    },
    enabled: !!user?.id
  });

  const isAdminVizio = userRoles.includes('admin_vizio');
  const isAdminEmpresa = userRoles.includes('admin_empresa');
  const canEdit = isAdminVizio || isAdminEmpresa;

  // Fetch empresas
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  // Fetch sinistralidade (modo calculado - últimos X meses)
  const { data: sinistralidade = [], isLoading } = useQuery({
    queryKey: ["sinistralidade", empresaSelecionada, periodoFilter],
    queryFn: async () => {
      const mesesAtras = new Date();
      mesesAtras.setMonth(mesesAtras.getMonth() - parseInt(periodoFilter));
      // Formato YYYY-MM para comparar com coluna competencia
      const competenciaMinima = `${mesesAtras.getFullYear()}-${String(mesesAtras.getMonth() + 1).padStart(2, '0')}`;
      
      let query = supabase
        .from("sinistralidade")
        .select("*")
        .gte("competencia", competenciaMinima)
        .order("competencia", { ascending: true });
      
      if (empresaSelecionada) {
        query = query.eq("empresa_id", empresaSelecionada);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Sinistralidade[];
    },
  });

  // Fetch sinistralidade do período do PDF importado (quando kpiSource === "pdf_importado")
  const { data: sinistralidade_pdf = [] } = useQuery({
    queryKey: ["sinistralidade-pdf-periodo", empresaSelecionada, resumo.indicador_id, resumo.periodo_inicio, resumo.periodo_fim, resumo.import_job_id],
    queryFn: async () => {
      if (!resumo.periodo_inicio || !resumo.periodo_fim) return [];
      
      // Converter para YYYY-MM (a coluna competencia está nesse formato)
      const inicioYM = resumo.periodo_inicio.slice(0, 7); // "YYYY-MM"
      const fimYM = resumo.periodo_fim.slice(0, 7); // "YYYY-MM"
      
      if (import.meta.env.DEV) {
        console.log("[sinistralidade-pdf-query] inicioYM:", inicioYM, "fimYM:", fimYM);
      }
      
      let query = supabase
        .from("sinistralidade")
        .select("*")
        .gte("competencia", inicioYM)
        .lte("competencia", fimYM)
        .order("competencia", { ascending: true });
      
      if (empresaSelecionada) {
        query = query.eq("empresa_id", empresaSelecionada);
      }
      
      // Se tiver import_job_id, priorizar registros desse job
      if (resumo.import_job_id) {
        query = query.eq("import_job_id", resumo.import_job_id);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error("[sinistralidade-pdf-periodo] Error:", error);
        throw error;
      }
      
      if (import.meta.env.DEV) {
        console.log("[sinistralidade-pdf-periodo] periodo:", resumo.periodo_inicio, "→", resumo.periodo_fim);
        console.log("[sinistralidade-pdf-periodo] import_job_id:", resumo.import_job_id);
        console.log("[sinistralidade-pdf-periodo] competencias:", data?.map(d => d.competencia));
        console.log("[sinistralidade-pdf-periodo] count:", data?.length);
      }
      
      return data as Sinistralidade[];
    },
    enabled: !!empresaSelecionada && !!resumo.periodo_inicio && !!resumo.periodo_fim && kpiSource === "pdf_importado",
    staleTime: 0,
  });

  // Selecionar dados do gráfico baseado no modo (PDF ou calculado)
  const dadosGrafico = useMemo(() => {
    if (kpiSource === "pdf_importado" && sinistralidade_pdf.length > 0) {
      return sinistralidade_pdf;
    }
    return sinistralidade;
  }, [kpiSource, sinistralidade_pdf, sinistralidade]);

  // Filter by empresa
  const filteredData = useMemo(() => {
    if (empresaFilter === "todas") return dadosGrafico;
    return dadosGrafico.filter(s => s.empresa_id === empresaFilter);
  }, [dadosGrafico, empresaFilter]);

  // KPIs
  const kpis = useMemo(() => {
    if (filteredData.length === 0) return {
      totalPremio: 0,
      totalSinistros: 0,
      mediaSinistralidade: 0,
      totalQuantidade: 0,
      tendencia: 0,
    };

    const totalPremio = filteredData.reduce((acc, s) => acc + Number(s.valor_premio), 0);
    const totalSinistros = filteredData.reduce((acc, s) => acc + Number(s.valor_sinistros), 0);
    const totalQuantidade = filteredData.reduce((acc, s) => acc + s.quantidade_sinistros, 0);
    const mediaSinistralidade = totalPremio > 0 ? (totalSinistros / totalPremio) * 100 : 0;

    // Calcular tendência (comparar últimos 3 meses com 3 meses anteriores)
    const sorted = [...filteredData].sort((a, b) => new Date(b.competencia).getTime() - new Date(a.competencia).getTime());
    const ultimos3 = sorted.slice(0, 3);
    const anteriores3 = sorted.slice(3, 6);
    
    const mediaUltimos = ultimos3.length > 0 
      ? ultimos3.reduce((acc, s) => acc + Number(s.indice_sinistralidade || 0), 0) / ultimos3.length 
      : 0;
    const mediaAnteriores = anteriores3.length > 0 
      ? anteriores3.reduce((acc, s) => acc + Number(s.indice_sinistralidade || 0), 0) / anteriores3.length 
      : 0;
    
    const tendencia = mediaAnteriores > 0 ? ((mediaUltimos - mediaAnteriores) / mediaAnteriores) * 100 : 0;

    return { totalPremio, totalSinistros, mediaSinistralidade, totalQuantidade, tendencia };
  }, [filteredData]);

  // Chart data - Evolução mensal (sempre 12 meses)
  const evolucaoMensal = useMemo(() => {
    // 1. Criar mapa dos dados reais por competência (YYYY-MM)
    const dataByCompetencia: Record<string, { 
      premio: number; 
      sinistros: number; 
      indice: number; 
      count: number; 
      indiceImportado: number | null 
    }> = {};
    
    filteredData.forEach(s => {
      const comp = s.competencia.slice(0, 7); // YYYY-MM
      if (!dataByCompetencia[comp]) {
        dataByCompetencia[comp] = { premio: 0, sinistros: 0, indice: 0, count: 0, indiceImportado: null };
      }
      dataByCompetencia[comp].premio += Number(s.valor_premio);
      dataByCompetencia[comp].sinistros += Number(s.valor_sinistros);
      dataByCompetencia[comp].indice += Number(s.indice_sinistralidade || 0);
      dataByCompetencia[comp].count += 1;
      if (s.indice_sinistralidade != null) {
        dataByCompetencia[comp].indiceImportado = Number(s.indice_sinistralidade);
      }
    });

    // 2. Determinar janela de meses baseado no modo
    let mesesParaExibir: string[] = [];
    
    if (kpiSource === "pdf_importado" && resumo.periodo_inicio && resumo.periodo_fim) {
      // Modo PDF: usar exatamente o período do indicador
      const [anoInicio, mesInicio] = resumo.periodo_inicio.slice(0, 7).split('-').map(Number);
      const [anoFim, mesFim] = resumo.periodo_fim.slice(0, 7).split('-').map(Number);
      
      let ano = anoInicio;
      let mes = mesInicio;
      while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
        const comp = `${ano}-${String(mes).padStart(2, '0')}`;
        mesesParaExibir.push(comp);
        mes++;
        if (mes > 12) {
          mes = 1;
          ano++;
        }
      }
      
      // Se tiver mais de 12 meses, pegar os últimos 12
      if (mesesParaExibir.length > 12) {
        mesesParaExibir = mesesParaExibir.slice(-12);
      }
      
      if (import.meta.env.DEV) {
        console.log("[evolucaoMensal] Modo PDF");
        console.log("[evolucaoMensal] periodo_inicio:", resumo.periodo_inicio);
        console.log("[evolucaoMensal] periodo_fim:", resumo.periodo_fim);
        console.log("[evolucaoMensal] meses gerados:", mesesParaExibir);
        console.log("[evolucaoMensal] competencias com dados:", Object.keys(dataByCompetencia).sort());
      }
    } else {
      // Modo calculado: usar últimos 12 meses baseado no max competência ou mês atual
      const competencias = Object.keys(dataByCompetencia).sort();
      const hoje = new Date();
      const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const mesFinal = competencias.length > 0 ? competencias[competencias.length - 1] : mesAtualStr;
      
      const [anoFinal, mesFinalNum] = mesFinal.split('-').map(Number);
      for (let i = 11; i >= 0; i--) {
        const d = new Date(anoFinal, mesFinalNum - 1 - i, 1);
        const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        mesesParaExibir.push(comp);
      }
    }

    // 3. Montar dataset normalizado
    return mesesParaExibir.map(comp => {
      const dataReal = dataByCompetencia[comp];
      const dataCompetencia = parseISO(`${comp}-01`);
      const mesLabel = format(dataCompetencia, "MMM/yy", { locale: ptBR });
      
      if (dataReal) {
        return {
          competencia: comp,
          mes: mesLabel,
          premio: dataReal.premio,
          sinistros: dataReal.sinistros,
          indice: dataReal.count > 0 ? dataReal.indice / dataReal.count : 0,
          indiceImportado: dataReal.indiceImportado,
          hasData: true,
        };
      } else {
        // Mês sem dados - usar null para não distorcer gráfico
        return {
          competencia: comp,
          mes: mesLabel,
          premio: null as number | null,
          sinistros: null as number | null,
          indice: null as number | null,
          indiceImportado: null,
          hasData: false,
        };
      }
    });
  }, [filteredData, kpiSource, resumo.periodo_inicio, resumo.periodo_fim]);

  // Chart data - Distribuição por tipo de sinistro
  const distribuicaoTipo = useMemo(() => {
    const totals = filteredData.reduce((acc, s) => ({
      consultas: acc.consultas + Number(s.sinistros_consultas || 0),
      exames: acc.exames + Number(s.sinistros_exames || 0),
      internacoes: acc.internacoes + Number(s.sinistros_internacoes || 0),
      procedimentos: acc.procedimentos + Number(s.sinistros_procedimentos || 0),
      outros: acc.outros + Number(s.sinistros_outros || 0),
    }), { consultas: 0, exames: 0, internacoes: 0, procedimentos: 0, outros: 0 });

    return [
      { name: "Consultas", value: totals.consultas, icon: Stethoscope },
      { name: "Exames", value: totals.exames, icon: FlaskConical },
      { name: "Internações", value: totals.internacoes, icon: BedDouble },
      { name: "Procedimentos", value: totals.procedimentos, icon: Scissors },
      { name: "Outros", value: totals.outros, icon: FileText },
    ].filter(d => d.value > 0);
  }, [filteredData]);

  // Alertas
  const alertas = useMemo(() => {
    const alerts: { tipo: string; mensagem: string; severidade: "warning" | "error" | "info" }[] = [];
    
    if (kpis.mediaSinistralidade > 85) {
      alerts.push({
        tipo: "Sinistralidade Alta",
        mensagem: `Índice de sinistralidade em ${kpis.mediaSinistralidade.toFixed(1)}% - acima do limite recomendado de 85%`,
        severidade: "error"
      });
    } else if (kpis.mediaSinistralidade > 75) {
      alerts.push({
        tipo: "Atenção",
        mensagem: `Índice de sinistralidade em ${kpis.mediaSinistralidade.toFixed(1)}% - próximo do limite`,
        severidade: "warning"
      });
    }

    if (kpis.tendencia > 10) {
      alerts.push({
        tipo: "Tendência de Alta",
        mensagem: `Sinistralidade crescendo ${kpis.tendencia.toFixed(1)}% nos últimos 3 meses`,
        severidade: "warning"
      });
    } else if (kpis.tendencia < -5) {
      alerts.push({
        tipo: "Melhoria",
        mensagem: `Sinistralidade reduzindo ${Math.abs(kpis.tendencia).toFixed(1)}% nos últimos 3 meses`,
        severidade: "info"
      });
    }

    return alerts;
  }, [kpis]);

  // Dados por empresa para tabela
  const dadosPorEmpresa = useMemo(() => {
    const grouped: Record<string, { empresa: string; premio: number; sinistros: number; quantidade: number }> = {};
    
    sinistralidade.forEach(s => {
      const empresa = empresas.find(e => e.id === s.empresa_id);
      if (!grouped[s.empresa_id]) {
        grouped[s.empresa_id] = { 
          empresa: empresa?.nome || "Desconhecida", 
          premio: 0, 
          sinistros: 0, 
          quantidade: 0 
        };
      }
      grouped[s.empresa_id].premio += Number(s.valor_premio);
      grouped[s.empresa_id].sinistros += Number(s.valor_sinistros);
      grouped[s.empresa_id].quantidade += s.quantidade_sinistros;
    });

    return Object.values(grouped)
      .map(d => ({
        ...d,
        indice: d.premio > 0 ? (d.sinistros / d.premio) * 100 : 0
      }))
      .sort((a, b) => b.sinistros - a.sinistros);
  }, [sinistralidade, empresas]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </AppLayout>
    );
  }

  if (sinistralidade.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Sinistralidade</h1>
              <p className="mt-2 text-muted-foreground">
                Análise detalhada de sinistros e utilização de benefícios
              </p>
            </div>
            {canEdit && (
              <Button onClick={() => setImportModalOpen(true)} size="lg">
                <Upload className="h-5 w-5 mr-2" />
                Importar PDF (Unimed BH)
              </Button>
            )}
          </div>

          {/* Import CTA Card */}
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Importe seus dados de sinistralidade</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                Envie o PDF da Unimed BH para extrair automaticamente os dados de sinistralidade com inteligência artificial.
              </p>
              {canEdit && (
                <Button onClick={() => setImportModalOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar PDF (Unimed BH)
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Documentos Section - sempre visível */}
          <SinistroDocsSection 
            empresaId={empresaSelecionada} 
            onImportClick={() => setImportModalOpen(true)}
            canEdit={canEdit}
          />

          {/* Checklist de Teste (somente admin_vizio) */}
          <PDFImportChecklist visible={isAdminVizio} />
        </div>

        <ImportPDFModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["sinistralidade", empresaSelecionada] });
            queryClient.invalidateQueries({ queryKey: ["sinistralidade-documentos"] });
            queryClient.invalidateQueries({ queryKey: ["import-jobs-sinistralidade"] });
            queryClient.invalidateQueries({ queryKey: ["indicadores-periodo"] });
            queryClient.invalidateQueries({ queryKey: ["sinistralidade-resumo-periodo", empresaSelecionada] });
            queryClient.invalidateQueries({ queryKey: ["sinistralidade-monthly-fallback", empresaSelecionada] });
          }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sinistralidade</h1>
            <p className="mt-1 text-muted-foreground">
              Análise detalhada de sinistros e utilização de benefícios
            </p>
          </div>
          <div className="flex gap-3">
            {canEdit && (
              <Button onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar PDF (Unimed BH)
              </Button>
            )}
            {!empresaSelecionada && (
              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas Empresas</SelectItem>
                  {empresas.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={kpiSource} onValueChange={(v) => setKpiSource(v as KpiSource)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Fonte do KPI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf_importado" disabled={!hasPdfMedia}>
                  Último PDF importado {!hasPdfMedia && "(indisponível)"}
                </SelectItem>
                <SelectItem value="calculado_6">Últimos 6 meses (calculado)</SelectItem>
                <SelectItem value="calculado_12">Últimos 12 meses (calculado)</SelectItem>
                <SelectItem value="calculado_24">Últimos 24 meses (calculado)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Período gráfico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Gráfico: 6 meses</SelectItem>
                <SelectItem value="12">Gráfico: 12 meses</SelectItem>
                <SelectItem value="24">Gráfico: 24 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI Cards - 4 cards using period averages from PDF */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Índice Médio */}
          <Card className={kpiSource === "pdf_importado" && hasPdfMedia ? "ring-2 ring-primary/20" : ""}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Índice Médio</p>
              </div>
              <p className="text-2xl font-bold">
                {kpiSource === "pdf_importado" && hasPdfMedia && resumo.media_periodo != null
                  ? formatPercent(resumo.media_periodo)
                  : formatPercent(kpis.mediaSinistralidade)}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {kpiSource === "pdf_importado" && hasPdfMedia
                  ? `Média do Relatório (${resumo.operadora || "PDF"})`
                  : "Calculado (mensal)"}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Prêmio Médio (período) */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Prêmio Médio</p>
              </div>
              <p className="text-2xl font-bold">
                {kpiSource === "pdf_importado" && hasPdfMedia && resumo.premio_medio_periodo != null
                  ? formatCurrency(resumo.premio_medio_periodo)
                  : formatCurrency(resumo.calculated_premio)}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {kpiSource === "pdf_importado" && hasPdfMedia && resumo.premio_medio_periodo != null
                  ? "Receita Total (média do período)"
                  : "Média calculada (mensal)"}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Sinistros Médio (período) */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Sinistros Médio</p>
              </div>
              <p className="text-2xl font-bold">
                {kpiSource === "pdf_importado" && hasPdfMedia && resumo.sinistros_medio_periodo != null
                  ? formatCurrency(resumo.sinistros_medio_periodo)
                  : formatCurrency(resumo.calculated_sinistros)}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {kpiSource === "pdf_importado" && hasPdfMedia && resumo.sinistros_medio_periodo != null
                  ? "Custo Assistencial (média do período)"
                  : "Média calculada (mensal)"}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Vidas Ativas (média) */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Vidas Ativas</p>
              </div>
              <p className="text-2xl font-bold">
                {kpiSource === "pdf_importado" && hasPdfMedia && resumo.vidas_ativas_media_periodo != null
                  ? resumo.vidas_ativas_media_periodo.toLocaleString("pt-BR")
                  : resumo.calculated_vidas > 0
                    ? Math.round(resumo.calculated_vidas).toLocaleString("pt-BR")
                    : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {kpiSource === "pdf_importado" && hasPdfMedia && resumo.vidas_ativas_media_periodo != null
                  ? "Contingente médio do período"
                  : resumo.calculated_vidas > 0
                    ? "Média calculada (mensal)"
                    : "Importe um PDF com contingente"}
              </p>

              {isAdminVizio && import.meta.env.DEV && (
                <p className="mt-2 text-[10px] font-mono text-muted-foreground">
                  debug vidas_ativas_media_periodo: {String(resumo.vidas_ativas_media_periodo)} | indicador_id: {String(resumo.indicador_id)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Evolução da Sinistralidade */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Evolução da Sinistralidade</CardTitle>
              <CardDescription>Comparativo mensal de prêmio vs sinistros</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const dataPoint = payload[0]?.payload as { 
                        premio?: number | null; 
                        sinistros?: number | null; 
                        indiceImportado?: number | null;
                        hasData?: boolean;
                      } | undefined;
                      
                      // Se não há dados para este mês
                      if (!dataPoint?.hasData) {
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-sm text-sm">
                            <p className="font-medium mb-2">{label}</p>
                            <p className="text-muted-foreground">Sem dados para este mês</p>
                          </div>
                        );
                      }
                      
                      const premio = dataPoint.premio;
                      const sinistros = dataPoint.sinistros;
                      const indiceImportado = dataPoint.indiceImportado;
                      const iuCalculado = premio && premio > 0 ? ((sinistros ?? 0) / premio) * 100 : null;
                      const iu = indiceImportado != null ? indiceImportado : iuCalculado;
                      const isImportado = indiceImportado != null;
                      
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-sm text-sm">
                          <p className="font-medium mb-2">{label}</p>
                          <div className="space-y-1">
                            <p>Prêmio: <span className="font-medium">{formatCurrency(premio ?? 0)}</span></p>
                            <p>Sinistros: <span className="font-medium">{formatCurrency(sinistros ?? 0)}</span></p>
                            <p>
                              Sinistralidade (IU): <span className="font-medium">{iu != null ? `${iu.toFixed(2).replace(".", ",")}%` : "—"}</span>
                              {isImportado && <span className="ml-1 text-xs text-muted-foreground">(PDF)</span>}
                            </p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="premio" name="Prêmio" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} connectNulls={false} />
                  <Area yAxisId="left" type="monotone" dataKey="sinistros" name="Sinistros" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} connectNulls={false} />
                  <Line yAxisId="right" type="monotone" dataKey="indice" name="Índice %" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribuição por Tipo */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Tipo</CardTitle>
              <CardDescription>Sinistros por categoria de utilização</CardDescription>
            </CardHeader>
            <CardContent>
              {distribuicaoTipo.length === 0 ? (
                <div className="flex items-center justify-center h-[300px]">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={distribuicaoTipo}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {distribuicaoTipo.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Alertas e Recomendações */}
          <Card>
            <CardHeader>
              <CardTitle>Alertas e Recomendações</CardTitle>
              <CardDescription>Pontos de atenção identificados</CardDescription>
            </CardHeader>
            <CardContent>
              {alertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[260px]">
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3">
                    <TrendingDown className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-muted-foreground">Nenhum alerta no momento</p>
                  <p className="text-sm text-muted-foreground">Indicadores dentro dos parâmetros</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertas.map((alerta, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border ${
                        alerta.severidade === 'error' 
                          ? 'bg-destructive/10 border-destructive/20' 
                          : alerta.severidade === 'warning'
                          ? 'bg-orange-500/10 border-orange-500/20'
                          : 'bg-blue-500/10 border-blue-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className={`h-4 w-4 ${
                          alerta.severidade === 'error' 
                            ? 'text-destructive' 
                            : alerta.severidade === 'warning'
                            ? 'text-orange-500'
                            : 'text-blue-500'
                        }`} />
                        <span className="font-medium">{alerta.tipo}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela por Empresa */}
        {!empresaSelecionada && empresaFilter === "todas" && (
          <Card>
            <CardHeader>
              <CardTitle>Sinistralidade por Empresa</CardTitle>
              <CardDescription>Comparativo de indicadores entre empresas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Prêmio Total</TableHead>
                    <TableHead className="text-right">Sinistros Total</TableHead>
                    <TableHead className="text-right">Qtd. Ocorrências</TableHead>
                    <TableHead className="text-right">Índice</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosPorEmpresa.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.empresa}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.premio)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.sinistros)}</TableCell>
                      <TableCell className="text-right">{row.quantidade.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right font-medium">{formatPercent(row.indice)}</TableCell>
                      <TableCell>
                        <Badge className={
                          row.indice > 85 
                            ? 'bg-destructive/10 text-destructive' 
                            : row.indice > 75 
                            ? 'bg-orange-500/10 text-orange-600'
                            : 'bg-green-500/10 text-green-600'
                        }>
                          {row.indice > 85 ? 'Crítico' : row.indice > 75 ? 'Atenção' : 'Normal'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Detalhamento por Tipo de Sinistro */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Tipo de Utilização</CardTitle>
            <CardDescription>Valores totais por categoria de sinistro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              {distribuicaoTipo.map((tipo, index) => {
                const Icon = tipo.icon;
                return (
                  <div key={tipo.name} className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${COLORS[index]}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: COLORS[index] }} />
                      </div>
                      <span className="text-sm font-medium">{tipo.name}</span>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency(tipo.value)}</p>
                    <p className="text-xs text-muted-foreground">
                      {kpis.totalSinistros > 0 ? ((tipo.value / kpis.totalSinistros) * 100).toFixed(1) : 0}% do total
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Documentos de Sinistralidade (Unimed BH) */}
        <SinistroDocsSection 
          empresaId={empresaSelecionada} 
          onImportClick={() => setImportModalOpen(true)}
          canEdit={canEdit}
        />

        {/* Indicadores de Período */}
        <IndicadoresPeriodoSection empresaId={empresaSelecionada || undefined} />

        {/* Histórico de Importações PDF */}
        <ImportHistorySection empresaId={empresaSelecionada || undefined} />

        {/* Checklist de Teste (somente admin_vizio) */}
        <PDFImportChecklist visible={isAdminVizio} />
      </div>

      <ImportPDFModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["sinistralidade", empresaSelecionada] });
          queryClient.invalidateQueries({ queryKey: ["sinistralidade-documentos"] });
          queryClient.invalidateQueries({ queryKey: ["import-jobs-sinistralidade"] });
          queryClient.invalidateQueries({ queryKey: ["indicadores-periodo"] });
          queryClient.invalidateQueries({ queryKey: ["sinistralidade-resumo-periodo", empresaSelecionada] });
          queryClient.invalidateQueries({ queryKey: ["sinistralidade-monthly-fallback", empresaSelecionada] });
        }}
      />
    </AppLayout>
  );
}
