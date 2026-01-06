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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SinistroPrioridadeEditorProps {
  sinistroId: string;
  prioridade: string;
  empresaId: string;
}

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  media: { label: "Média", color: "bg-chart-3 text-white" },
  alta: { label: "Alta", color: "bg-warning text-warning-foreground" },
  critica: { label: "Crítica", color: "bg-destructive text-destructive-foreground" },
};

export function SinistroPrioridadeEditor({ 
  sinistroId, 
  prioridade, 
  empresaId 
}: SinistroPrioridadeEditorProps) {
  const queryClient = useQueryClient();
  const { isAdminVizio } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (newPrioridade: string) => {
      const { error } = await supabase
        .from('sinistros_vida')
        .update({ prioridade: newPrioridade })
        .eq('id', sinistroId);

      if (error) throw error;

      // Log to timeline
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', user?.id)
        .single();

      await supabase
        .from('sinistros_vida_timeline')
        .insert({
          sinistro_id: sinistroId,
          empresa_id: empresaId,
          tipo_evento: 'priority_changed',
          descricao: `Prioridade alterada de "${prioridadeConfig[prioridade]?.label}" para "${prioridadeConfig[newPrioridade]?.label}"`,
          source: 'sistema',
          criado_por: user?.id,
          usuario_nome: profile?.nome_completo || 'Sistema',
          meta: { from: prioridade, to: newPrioridade },
        });
    },
    onSuccess: () => {
      toast.success("Prioridade atualizada!");
      queryClient.invalidateQueries({ queryKey: ['sinistros-vida'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const config = prioridadeConfig[prioridade] || prioridadeConfig.media;

  // Non-admin users see read-only badge
  if (!isAdminVizio) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={config.color}>{config.label}</Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Prioridade definida pela corretora</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Admin can edit
  return (
    <Select
      value={prioridade}
      onValueChange={(value) => updateMutation.mutate(value)}
      open={isOpen}
      onOpenChange={setIsOpen}
      disabled={updateMutation.isPending}
    >
      <SelectTrigger className="w-[120px] h-8">
        {updateMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SelectValue>
            <Badge className={config.color}>{config.label}</Badge>
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        {Object.entries(prioridadeConfig).map(([key, cfg]) => (
          <SelectItem key={key} value={key}>
            <Badge className={cfg.color}>{cfg.label}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
