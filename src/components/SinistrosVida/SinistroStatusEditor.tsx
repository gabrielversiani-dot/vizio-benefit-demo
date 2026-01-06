import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SinistroStatusEditorProps {
  sinistroId: string;
  status: string;
  empresaId: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  em_analise: { label: "Em Análise", color: "bg-warning text-warning-foreground" },
  pendente_documentos: { label: "Pendente Docs", color: "bg-chart-3 text-white" },
  em_andamento: { label: "Em Andamento", color: "bg-chart-1 text-white" },
  enviado_operadora: { label: "Enviado Operadora", color: "bg-chart-4 text-white" },
  aprovado: { label: "Aprovado", color: "bg-success text-success-foreground" },
  negado: { label: "Negado", color: "bg-destructive text-destructive-foreground" },
  pago: { label: "Pago", color: "bg-chart-2 text-white" },
  concluido: { label: "Concluído", color: "bg-success text-success-foreground" },
};

export function SinistroStatusEditor({ 
  sinistroId, 
  status, 
  empresaId 
}: SinistroStatusEditorProps) {
  const queryClient = useQueryClient();
  const { isAdminVizio } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const updateData: Record<string, unknown> = { status: newStatus };
      
      // Set concluido_em if completing
      if (['concluido', 'pago'].includes(newStatus)) {
        updateData.concluido_em = new Date().toISOString();
      }

      const { error } = await supabase
        .from('sinistros_vida')
        .update(updateData)
        .eq('id', sinistroId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ['sinistros-vida'] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-timeline', sinistroId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const config = statusConfig[status] || { label: status, color: "bg-muted" };

  // Non-admin users see read-only badge
  if (!isAdminVizio) {
    return <Badge className={config.color}>{config.label}</Badge>;
  }

  // Admin can edit
  return (
    <Select
      value={status}
      onValueChange={(value) => updateMutation.mutate(value)}
      open={isOpen}
      onOpenChange={setIsOpen}
      disabled={updateMutation.isPending}
    >
      <SelectTrigger className="w-[160px] h-8">
        {updateMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SelectValue>
            <Badge className={config.color}>{config.label}</Badge>
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <SelectItem key={key} value={key}>
            <Badge className={cfg.color}>{cfg.label}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
