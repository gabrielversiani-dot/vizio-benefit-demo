import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Building2, Users, UserCog, Shield, ChevronRight, ChevronLeft, Save, Trash2, FileText } from "lucide-react";
import { EmpresasStep } from "./steps/EmpresasStep";
import { UsuariosStep } from "./steps/UsuariosStep";
import { PerfisStep } from "./steps/PerfisStep";
import { RolesStep } from "./steps/RolesStep";
import { SetupSummary } from "./SetupSummary";
import { useSetupDraft } from "@/hooks/useSetupDraft";
import { toast } from "sonner";

interface StepStatus {
  empresas: { created: number; updated: number; errors: number };
  usuarios: { created: number; errors: number };
  perfis: { updated: number; errors: number };
  roles: { created: number; errors: number };
}

const steps = [
  { id: 'empresas', label: 'Empresas', icon: Building2, description: 'Cadastrar empresas do sistema' },
  { id: 'usuarios', label: 'Usuários', icon: Users, description: 'Criar contas de acesso' },
  { id: 'perfis', label: 'Perfis', icon: UserCog, description: 'Vincular usuários às empresas' },
  { id: 'roles', label: 'Funções', icon: Shield, description: 'Atribuir permissões' },
];

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    empresas: { created: 0, updated: 0, errors: 0 },
    usuarios: { created: 0, errors: 0 },
    perfis: { updated: 0, errors: 0 },
    roles: { created: 0, errors: 0 },
  });
  const [showSummary, setShowSummary] = useState(false);
  const { hasDraft, clearDraft, draft } = useSetupDraft();

  const progress = ((currentStep + 1) / steps.length) * 100;

  const updateStepStatus = (step: keyof StepStatus, status: Partial<StepStatus[typeof step]>) => {
    setStepStatus(prev => ({
      ...prev,
      [step]: { ...prev[step], ...status }
    }));
  };

  const goToNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowSummary(true);
    }
  };

  const goToPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClearDraft = () => {
    if (confirm('Tem certeza que deseja limpar todos os rascunhos? Esta ação não pode ser desfeita.')) {
      clearDraft();
      toast.success('Rascunhos limpos');
    }
  };

  const renderCurrentStep = () => {
    switch (steps[currentStep].id) {
      case 'empresas':
        return <EmpresasStep onStatusUpdate={(status) => updateStepStatus('empresas', status)} />;
      case 'usuarios':
        return <UsuariosStep onStatusUpdate={(status) => updateStepStatus('usuarios', status)} />;
      case 'perfis':
        return <PerfisStep onStatusUpdate={(status) => updateStepStatus('perfis', status)} />;
      case 'roles':
        return <RolesStep onStatusUpdate={(status) => updateStepStatus('roles', status)} />;
      default:
        return null;
    }
  };

  if (showSummary) {
    return <SetupSummary stepStatus={stepStatus} onBack={() => setShowSummary(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Draft indicator */}
      {hasDraft && (
        <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <FileText className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-200">
              <strong>Rascunho salvo automaticamente</strong>
              {draft?.lastModified && (
                <span className="text-blue-600 dark:text-blue-400 ml-2 text-sm">
                  (última modificação: {new Date(draft.lastModified).toLocaleString('pt-BR')})
                </span>
              )}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClearDraft}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar rascunho
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-xl">Setup Inicial do Sistema</CardTitle>
              <CardDescription>
                Configure empresas, usuários e permissões passo a passo
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              Etapa {currentStep + 1} de {steps.length}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent>
          {/* Step indicators */}
          <div className="flex justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const stepKey = step.id as keyof StepStatus;
              const status = stepStatus[stepKey];
              const hasActivity = 'created' in status 
                ? (status.created > 0 || ('updated' in status && status.updated > 0))
                : false;
              
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-colors flex-1 ${
                    isCurrent 
                      ? 'bg-primary/10 text-primary' 
                      : isCompleted || hasActivity
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    isCurrent 
                      ? 'bg-primary text-primary-foreground' 
                      : isCompleted || hasActivity
                        ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' 
                        : 'bg-muted'
                  }`}>
                    {(isCompleted || hasActivity) ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="text-xs text-muted-foreground hidden md:block">{step.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {(() => {
              const Icon = steps[currentStep].icon;
              return (
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
              );
            })()}
            <div className="flex-1">
              <CardTitle>{steps[currentStep].label}</CardTitle>
              <CardDescription>{steps[currentStep].description}</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Save className="h-3 w-3" />
              Auto-save ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {renderCurrentStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={goToPrev}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button onClick={goToNext} className="gap-2">
          {currentStep === steps.length - 1 ? 'Finalizar Setup' : 'Próximo'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
