import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ArrowLeft, Building2, Users, UserCog, Shield, PartyPopper } from "lucide-react";

interface StepStatus {
  empresas: { created: number; updated: number; errors: number };
  usuarios: { created: number; errors: number };
  perfis: { updated: number; errors: number };
  roles: { created: number; errors: number };
}

interface SetupSummaryProps {
  stepStatus: StepStatus;
  onBack: () => void;
}

export function SetupSummary({ stepStatus, onBack }: SetupSummaryProps) {
  const totalCreated = stepStatus.empresas.created + stepStatus.usuarios.created + stepStatus.roles.created;
  const totalUpdated = stepStatus.empresas.updated + stepStatus.perfis.updated;
  const totalErrors = stepStatus.empresas.errors + stepStatus.usuarios.errors + stepStatus.perfis.errors + stepStatus.roles.errors;

  const summaryItems = [
    {
      icon: Building2,
      label: 'Empresas',
      created: stepStatus.empresas.created,
      updated: stepStatus.empresas.updated,
      errors: stepStatus.empresas.errors,
    },
    {
      icon: Users,
      label: 'Usuários',
      created: stepStatus.usuarios.created,
      errors: stepStatus.usuarios.errors,
    },
    {
      icon: UserCog,
      label: 'Perfis',
      updated: stepStatus.perfis.updated,
      errors: stepStatus.perfis.errors,
    },
    {
      icon: Shield,
      label: 'Funções',
      created: stepStatus.roles.created,
      errors: stepStatus.roles.errors,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <PartyPopper className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">Setup Concluído!</CardTitle>
          <CardDescription className="text-base">
            Veja o resumo das operações realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center mt-4">
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-3xl font-bold text-green-600">{totalCreated}</p>
              <p className="text-sm text-muted-foreground">Criados</p>
            </div>
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-3xl font-bold text-blue-600">{totalUpdated}</p>
              <p className="text-sm text-muted-foreground">Atualizados</p>
            </div>
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-3xl font-bold text-destructive">{totalErrors}</p>
              <p className="text-sm text-muted-foreground">Erros</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes por Etapa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaryItems.map((item) => {
            const Icon = item.icon;
            const hasErrors = item.errors > 0;
            
            return (
              <div 
                key={item.label}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    hasErrors ? 'bg-destructive/10' : 'bg-green-100 dark:bg-green-900'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      hasErrors ? 'text-destructive' : 'text-green-600 dark:text-green-400'
                    }`} />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {'created' in item && item.created > 0 && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                      +{item.created} criados
                    </Badge>
                  )}
                  {'updated' in item && item.updated > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {item.updated} atualizados
                    </Badge>
                  )}
                  {item.errors > 0 && (
                    <Badge variant="destructive">
                      {item.errors} erros
                    </Badge>
                  )}
                  {(('created' in item ? item.created : 0) + ('updated' in item ? item.updated : 0) === 0) && item.errors === 0 && (
                    <Badge variant="secondary">
                      Nenhuma alteração
                    </Badge>
                  )}
                  {hasErrors ? (
                    <XCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Setup
        </Button>
      </div>
    </div>
  );
}
