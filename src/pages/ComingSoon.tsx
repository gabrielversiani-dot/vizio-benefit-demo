import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Construction, 
  Bell, 
  ArrowLeft, 
  Users, 
  RefreshCw, 
  ClipboardList 
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo } from "react";

const moduleConfig: Record<string, { 
  title: string; 
  icon: React.ElementType; 
  features: string[];
}> = {
  beneficiarios: {
    title: "Beneficiários",
    icon: Users,
    features: [
      "Cadastro completo de titulares e dependentes",
      "Importação em massa via CSV",
      "Histórico de movimentações",
      "Filtros avançados por plano e status"
    ]
  },
  "movimentacao-vidas": {
    title: "Movimentação de Vidas",
    icon: RefreshCw,
    features: [
      "Inclusões e exclusões de beneficiários",
      "Alterações cadastrais",
      "Mudanças de plano",
      "Aprovação em lote"
    ]
  },
  demandas: {
    title: "Demandas",
    icon: ClipboardList,
    features: [
      "Solicitação de certificados e carteirinhas",
      "Acompanhamento de reembolsos",
      "Pedidos de autorização",
      "Histórico completo de atendimentos"
    ]
  }
};

const greetings = [
  "Estamos preparando essa área com carinho — já já fica disponível 🙂",
  "Boas notícias: essa funcionalidade está a caminho 🚀",
  "Quase lá! Estamos finalizando os últimos detalhes 🛠️"
];

export default function ComingSoon() {
  const { modulo } = useParams();
  const navigate = useNavigate();
  
  const config = modulo ? moduleConfig[modulo] : null;
  const Icon = config?.icon || Construction;
  
  // Rotate greeting based on current minute
  const greeting = useMemo(() => {
    const index = Math.floor(Date.now() / 60000) % greetings.length;
    return greetings[index];
  }, []);

  if (!config) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Construction className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Módulo não encontrado</p>
              <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
                Voltar ao início
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Card className="max-w-lg w-full border-2 border-dashed border-primary/30">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            <Badge variant="secondary" className="mx-auto mb-3 gap-1">
              <Construction className="h-3 w-3" />
              Em desenvolvimento
            </Badge>
            <CardTitle className="text-2xl">{config.title}</CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground text-lg">
              {greeting}
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="text-lg">📋</span>
                O que vai ter aqui
              </h3>
              <ul className="space-y-2">
                {config.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex flex-col gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="w-full gap-2" disabled>
                    <Bell className="h-4 w-4" />
                    Avisar quando estiver pronto
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Em breve</p>
                </TooltipContent>
              </Tooltip>
              
              <Button 
                variant="ghost" 
                className="w-full gap-2"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
