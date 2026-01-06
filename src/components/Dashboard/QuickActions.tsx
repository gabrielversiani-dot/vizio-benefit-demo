import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileUp, 
  Plus, 
  FileSignature, 
  Heart, 
  RefreshCw,
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

interface QuickActionsProps {
  onSyncRD?: () => void;
  isSyncingRD?: boolean;
}

export function QuickActions({ onSyncRD, isSyncingRD }: QuickActionsProps) {
  const navigate = useNavigate();
  const { isAdmin, isAdminVizio, canImportSinistralidade, canManageFaturamento, canManageContratos, canManagePromocaoSaude } = usePermissions();

  const actions = [
    {
      label: "Importar PDF",
      icon: FileUp,
      onClick: () => navigate("/sinistralidade"),
      visible: canImportSinistralidade,
      variant: "default" as const,
    },
    {
      label: "Nova Fatura",
      icon: Plus,
      onClick: () => navigate("/faturamento"),
      visible: canManageFaturamento,
      variant: "outline" as const,
    },
    {
      label: "Novo Contrato",
      icon: FileSignature,
      onClick: () => navigate("/contratos"),
      visible: canManageContratos,
      variant: "outline" as const,
    },
    {
      label: "Nova Ação",
      icon: Heart,
      onClick: () => navigate("/promocao-saude"),
      visible: canManagePromocaoSaude,
      variant: "outline" as const,
    },
    {
      label: "Sincronizar RD",
      icon: RefreshCw,
      onClick: onSyncRD,
      visible: isAdminVizio && !!onSyncRD,
      variant: "outline" as const,
      loading: isSyncingRD,
    },
  ].filter((a) => a.visible);

  if (actions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Ações Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              size="sm"
              onClick={action.onClick}
              disabled={action.loading}
              className="gap-2"
            >
              <action.icon className={`h-4 w-4 ${action.loading ? "animate-spin" : ""}`} />
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
