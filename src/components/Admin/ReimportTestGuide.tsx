import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Download, ChevronDown, ChevronUp, CheckCircle, Circle, Bot, FileText, 
  Eye, ThumbsUp, RefreshCw, GitBranch, AlertTriangle, XCircle, Copy,
  ExternalLink
} from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";

interface Step {
  number: number;
  phase: "pai" | "filho";
  title: string;
  description: string;
  icon: React.ReactNode;
  expected?: string;
}

const STEPS: Step[] = [
  // Fase 1: Job Pai
  {
    number: 1,
    phase: "pai",
    title: "Baixar CSV de teste",
    description: "Baixe o arquivo com 8 linhas: 5 válidas + 3 erros intencionais (CPF inválido, dependente sem titular, data inválida).",
    icon: <Download className="h-4 w-4" />,
    expected: "Arquivo baixado com 8 linhas",
  },
  {
    number: 2,
    phase: "pai",
    title: "Selecionar empresa e fazer upload",
    description: "Selecione 'Capital Vizio' no seletor de empresa e faça upload do CSV.",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    number: 3,
    phase: "pai",
    title: "Analisar com IA",
    description: "Clique em 'Analisar com IA' e aguarde o processamento.",
    icon: <Bot className="h-4 w-4" />,
    expected: "total_rows=8, error_rows≥3, valid_rows≥5",
  },
  {
    number: 4,
    phase: "pai",
    title: "Anotar ID do Job Pai",
    description: "Na tela de preview, copie o ID do job (aparece na URL ou no topo da página).",
    icon: <Copy className="h-4 w-4" />,
    expected: "ID salvo para comparação",
  },
  // Fase 2: Reimportação
  {
    number: 5,
    phase: "filho",
    title: "Abrir modal de reimportação",
    description: "Clique em 'Reimportar Linhas Corrigidas' no card de ações.",
    icon: <RefreshCw className="h-4 w-4" />,
  },
  {
    number: 6,
    phase: "filho",
    title: "Exportar erros e avisos",
    description: "No modal, clique 'Exportar Erros e Avisos'. Baixe o CSV com as 3 linhas problemáticas.",
    icon: <Download className="h-4 w-4" />,
    expected: "CSV com 3+ linhas de erro/aviso",
  },
  {
    number: 7,
    phase: "filho",
    title: "Corrigir CSV no Excel",
    description: "Abra o CSV exportado e corrija: CPF inválido → CPF válido, adicione titular_cpf, corrija data.",
    icon: <FileText className="h-4 w-4" />,
    expected: "3 linhas corrigidas mantendo cabeçalhos",
  },
  {
    number: 8,
    phase: "filho",
    title: "Fazer upload do CSV corrigido",
    description: "No modal (Passo 3), faça upload do CSV corrigido e clique 'Analisar Correções'.",
    icon: <Bot className="h-4 w-4" />,
    expected: "Novo job criado com parent_job_id",
  },
  {
    number: 9,
    phase: "filho",
    title: "Verificar comparativo",
    description: "Confirme que aparece o badge 'Reimportação' e o card 'Comparativo' mostra redução de erros.",
    icon: <GitBranch className="h-4 w-4" />,
    expected: "errorsFilho < errorsPai",
  },
  {
    number: 10,
    phase: "filho",
    title: "Aprovar e aplicar",
    description: "Clique 'Aprovar e Inserir' no Job Filho para aplicar os dados corrigidos.",
    icon: <ThumbsUp className="h-4 w-4" />,
    expected: "status=completed, applied_by preenchido",
  },
  {
    number: 11,
    phase: "filho",
    title: "Validação pós-commit",
    description: "Execute a 'Validação Pós-Commit' para confirmar que os CPFs existem na tabela beneficiarios.",
    icon: <Eye className="h-4 w-4" />,
    expected: "100% dos CPFs encontrados",
  },
];

export function ReimportTestGuide() {
  const { isAdminVizio } = useEmpresa();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Only show for admin_vizio
  if (!isAdminVizio) {
    return null;
  }

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) =>
      prev.includes(stepNumber)
        ? prev.filter((n) => n !== stepNumber)
        : [...prev, stepNumber]
    );
  };

  const handleDownloadTestCSV = () => {
    // Direct download from public folder
    const link = document.createElement("a");
    link.href = "/test-data/beneficiarios_teste_reimport.csv";
    link.download = "beneficiarios_teste_reimport.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download iniciado",
      description: "CSV de teste com 8 linhas (5 válidas + 3 erros)",
    });

    if (!completedSteps.includes(1)) {
      setCompletedSteps((prev) => [...prev, 1]);
    }
  };

  const paiSteps = STEPS.filter(s => s.phase === "pai");
  const filhoSteps = STEPS.filter(s => s.phase === "filho");
  const completedCount = completedSteps.length;
  const totalSteps = STEPS.length;
  const progress = Math.round((completedCount / totalSteps) * 100);

  return (
    <>
      <Card className="border-2 border-dashed border-amber-500/50 bg-amber-500/5">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="h-5 w-5 text-amber-600" />
                  🧪 Teste E2E: Reimportação de Beneficiários
                  <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Admin Vizio
                  </Badge>
                </CardTitle>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{progress}% completo</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </Button>
            </CollapsibleTrigger>
            <CardDescription>
              Teste completo: Job Pai → Exportar Erros → Corrigir → Reimportar → Aprovar
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleDownloadTestCSV} variant="default">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar CSV de Teste (8 linhas)
                </Button>
                <Button onClick={() => setShowInstructions(true)} variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Instruções Completas
                </Button>
              </div>

              {/* Progress */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progresso do Teste</span>
                  <span className="text-sm text-muted-foreground">{completedCount}/{totalSteps} passos</span>
                </div>
                <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Test File Info */}
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Conteúdo do CSV de Teste:
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ 2 titulares válidos (João e Maria)</li>
                  <li>✅ 3 dependentes válidos com titular_cpf correto</li>
                  <li><XCircle className="h-3 w-3 inline text-destructive" /> 1 dependente SEM titular_cpf (Felipe)</li>
                  <li><XCircle className="h-3 w-3 inline text-destructive" /> 1 CPF inválido (111.111.111-11)</li>
                  <li><XCircle className="h-3 w-3 inline text-destructive" /> 1 data inválida (32/13/1990)</li>
                </ul>
              </div>

              {/* Phase 1 Steps */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Badge variant="secondary">Fase 1</Badge>
                  Criar Job Pai
                </h4>
                {paiSteps.map((step) => (
                  <StepItem 
                    key={step.number} 
                    step={step} 
                    completed={completedSteps.includes(step.number)}
                    onToggle={() => toggleStep(step.number)}
                  />
                ))}
              </div>

              {/* Phase 2 Steps */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10">Fase 2</Badge>
                  Reimportação
                </h4>
                {filhoSteps.map((step) => (
                  <StepItem 
                    key={step.number} 
                    step={step} 
                    completed={completedSteps.includes(step.number)}
                    onToggle={() => toggleStep(step.number)}
                  />
                ))}
              </div>

              {/* Reset */}
              {completedCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCompletedSteps([])}
                  className="w-full"
                >
                  Resetar Progresso
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Full Instructions Modal */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-amber-600" />
              Instruções Completas: Teste E2E de Reimportação
            </DialogTitle>
            <DialogDescription>
              Siga cada passo para testar o fluxo completo de correção e reimportação
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Objective */}
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Objetivo do Teste</h4>
              <p className="text-sm text-muted-foreground">
                Validar que o sistema permite: (1) detectar erros na importação, 
                (2) exportar linhas com problemas, (3) reimportar correções com rastreabilidade, 
                (4) comparar resultados entre job pai e filho.
              </p>
            </div>

            {/* Phase 1 */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Badge variant="secondary">Fase 1</Badge>
                Criar Job Pai com Erros
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Selecione a empresa <strong>"Capital Vizio"</strong> no seletor do header</li>
                <li>Baixe o CSV de teste (botão acima) — contém 8 linhas com 3 erros intencionais</li>
                <li>Faça upload e clique <strong>"Analisar com IA"</strong></li>
                <li>No preview, confirme: <strong>8 total, ≥5 válidas, ≥3 erros</strong></li>
                <li>Copie o ID do Job Pai (da URL: <code>/admin/importacao/jobs/UUID</code>)</li>
              </ol>
            </div>

            {/* Phase 2 */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10">Fase 2</Badge>
                Exportar, Corrigir e Reimportar
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>No Job Pai, clique em <strong>"Reimportar Linhas Corrigidas"</strong></li>
                <li>No modal, clique <strong>"Exportar Erros e Avisos"</strong> — baixa CSV com linhas problemáticas</li>
                <li>Abra no Excel e corrija:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>CPF 111.111.111-11 → substitua por CPF válido</li>
                    <li>Felipe sem titular_cpf → adicione CPF de um titular</li>
                    <li>Data 32/13/1990 → corrija para data válida (ex: 20/08/1990)</li>
                  </ul>
                </li>
                <li>Salve como CSV mantendo os mesmos cabeçalhos</li>
                <li>No modal (Passo 3), faça upload do CSV corrigido</li>
                <li>Clique <strong>"Analisar Correções"</strong></li>
              </ol>
            </div>

            {/* Phase 3 */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Badge variant="default">Fase 3</Badge>
                Validar Job Filho
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Confirme o badge <strong>"Reimportação"</strong> no topo</li>
                <li>Confirme o card <strong>"Comparativo com Importação Original"</strong>:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Mostra erros do pai vs erros do filho</li>
                    <li>Mostra "X problemas resolvidos!"</li>
                  </ul>
                </li>
                <li>Clique <strong>"Aprovar e Inserir"</strong></li>
                <li>Execute <strong>"Validação Pós-Commit"</strong> — todos os CPFs devem existir</li>
              </ol>
            </div>

            {/* Evidence */}
            <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <h4 className="font-semibold mb-2 text-green-700 dark:text-green-300">
                ✓ Evidências a Coletar
              </h4>
              <ul className="text-sm text-green-600 dark:text-green-400 space-y-1">
                <li>• Screenshot do Job Pai mostrando contagens</li>
                <li>• Screenshot do Job Filho mostrando comparativo</li>
                <li>• ID do Job Pai e Job Filho (para consulta SQL)</li>
                <li>• Status "Concluído" com data/hora</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StepItem({ 
  step, 
  completed, 
  onToggle 
}: { 
  step: Step; 
  completed: boolean; 
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
        completed
          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
          : "bg-card hover:bg-muted/50 border-border"
      }`}
      onClick={onToggle}
    >
      <div className="flex-shrink-0 mt-0.5">
        {completed ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {step.number}
          </Badge>
          {step.icon}
          <span className="font-medium text-sm">{step.title}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {step.description}
        </p>
        {step.expected && (
          <p className="text-xs text-primary mt-1">
            ✓ Esperado: {step.expected}
          </p>
        )}
      </div>
    </div>
  );
}
