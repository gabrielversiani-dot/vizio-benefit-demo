import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, ChevronDown, ChevronUp, CheckCircle, Circle, Bot, FileText, Eye, ThumbsUp } from "lucide-react";

const EXAMPLE_CSV = `nome_completo;cpf;data_nascimento;sexo;tipo;titular_cpf;grau_parentesco;email;telefone;matricula;cargo;departamento;plano_saude;plano_odonto;plano_vida;status;data_inclusao;observacoes
João da Silva;123.456.789-09;1985-03-15;M;titular;;Cônjuge;joao.silva@email.com;11999998888;001;Gerente;TI;true;true;true;ativo;2024-01-01;Funcionário antigo
Maria da Silva;987.654.321-00;1988-07-20;F;dependente;123.456.789-09;Cônjuge;maria.silva@email.com;11999997777;;;false;true;false;ativo;2024-01-01;Esposa do João
Pedro da Silva;111.222.333-44;2010-11-10;M;dependente;123.456.789-09;Filho;;;;;;;true;true;true;ativo;2024-01-01;Filho do João
Ana Santos;444.555.666-77;1990-05-25;F;titular;;Cônjuge;ana.santos@email.com;11988887777;002;Analista;RH;true;true;true;ativo;2024-02-15;
Lucas Santos;555.666.777-88;2015-08-12;M;dependente;444.555.666-77;Filho;;;;;;;true;false;false;ativo;2024-02-15;Filho da Ana
Julia Santos;666.777.888-99;2018-03-01;F;dependente;444.555.666-77;Filho;;;;;;;true;false;false;ativo;2024-02-15;Filha da Ana`;

const downloadCSV = (content: string, filename: string) => {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Baixar o exemplo",
    description: "Clique no botão abaixo para baixar o CSV de exemplo com 6 beneficiários (2 titulares + 4 dependentes).",
    icon: <Download className="h-4 w-4" />,
  },
  {
    number: 2,
    title: "Fazer upload",
    description: "Use o campo 'Nova Importação' acima para selecionar o arquivo CSV baixado.",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    number: 3,
    title: "Analisar com IA",
    description: "Clique em 'Analisar com IA'. O sistema irá detectar o tipo de dados, mapear colunas e validar cada linha.",
    icon: <Bot className="h-4 w-4" />,
  },
  {
    number: 4,
    title: "Revisar preview",
    description: "Na página de preview, verifique o checklist, contagem de titulares/dependentes e erros/avisos por linha.",
    icon: <Eye className="h-4 w-4" />,
  },
  {
    number: 5,
    title: "Aprovar e validar",
    description: "Clique em 'Aprovar e Inserir'. Depois, execute a 'Validação Pós-Commit' para confirmar que os dados entraram no banco.",
    icon: <ThumbsUp className="h-4 w-4" />,
  },
];

export function ImportTestGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) =>
      prev.includes(stepNumber)
        ? prev.filter((n) => n !== stepNumber)
        : [...prev, stepNumber]
    );
  };

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5 text-primary" />
                🧪 Teste Guiado: Importação de Beneficiários
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CardDescription>
            Siga o passo a passo para testar o fluxo completo de importação
          </CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Steps */}
            <div className="space-y-3">
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    completedSteps.includes(step.number)
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      : "bg-card hover:bg-muted/50"
                  }`}
                  onClick={() => toggleStep(step.number)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {completedSteps.includes(step.number) ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Passo {step.number}
                      </Badge>
                      {step.icon}
                      <span className="font-medium text-sm">{step.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Download button */}
            <div className="pt-2">
              <Button
                className="w-full"
                variant="default"
                onClick={() => {
                  downloadCSV(EXAMPLE_CSV, "teste_beneficiarios.csv");
                  if (!completedSteps.includes(1)) {
                    setCompletedSteps((prev) => [...prev, 1]);
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar CSV de Teste (6 beneficiários)
              </Button>
            </div>

            {/* Expected results */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-semibold mb-2">Resultados esperados:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>6 linhas</strong> no total</li>
                <li>• <strong>2 titulares</strong> (João e Ana)</li>
                <li>• <strong>4 dependentes</strong> com vínculos corretos</li>
                <li>• Todos os CPFs devem ser validados</li>
                <li>• Após aprovar, validação pós-commit deve mostrar 100%</li>
              </ul>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
