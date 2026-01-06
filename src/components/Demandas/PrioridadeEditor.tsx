import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, Loader2, RotateCcw, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-slate-500/20 text-slate-700 border-slate-300" },
  media: { label: "Média", color: "bg-blue-500/20 text-blue-700 border-blue-300" },
  alta: { label: "Alta", color: "bg-orange-500/20 text-orange-700 border-orange-300" },
  urgente: { label: "Urgente", color: "bg-red-500/20 text-red-700 border-red-300" },
};

const prioridadeOptions = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
] as const;

interface PrioridadeEditorProps {
  demandaId: string;
  prioridade: string;
  prioridadeManual?: boolean;
  canEdit: boolean;
  empresaId: string;
}

export function PrioridadeEditor({
  demandaId,
  prioridade,
  prioridadeManual,
  canEdit,
  empresaId,
}: PrioridadeEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (newPrioridade: string) => {
      const { data, error } = await supabase
        .from("demandas")
        .update({ prioridade: newPrioridade as any })
        .eq("id", demandaId)
        .eq("empresa_id", empresaId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Prioridade atualizada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["demandas"] });
      queryClient.invalidateQueries({ queryKey: ["demandas-historico-geral"] });
      queryClient.invalidateQueries({ queryKey: ["demanda-historico"] });
    },
    onError: (error: Error) => {
      console.error("Error updating priority:", error);
      toast.error("Erro ao atualizar prioridade");
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .update({ 
          prioridade_manual: false,
          prioridade: "media" as any 
        })
        .eq("id", demandaId)
        .eq("empresa_id", empresaId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Prioridade resetada para automática");
      queryClient.invalidateQueries({ queryKey: ["demandas"] });
      queryClient.invalidateQueries({ queryKey: ["demandas-historico-geral"] });
      queryClient.invalidateQueries({ queryKey: ["demanda-historico"] });
    },
    onError: (error: Error) => {
      console.error("Error resetting priority:", error);
      toast.error("Erro ao resetar prioridade");
    },
  });

  const isPending = updateMutation.isPending || resetMutation.isPending;
  const config = prioridadeConfig[prioridade] || prioridadeConfig.media;

  const handleSelect = (value: string) => {
    if (value !== prioridade) {
      updateMutation.mutate(value);
    }
    setIsOpen(false);
  };

  const handleReset = () => {
    resetMutation.mutate();
    setIsOpen(false);
  };

  // Read-only view for non-admins
  if (!canEdit) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn(config.color, "cursor-default")}
            >
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {prioridadeManual 
              ? "Prioridade definida pela corretora" 
              : "Prioridade automática"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Editable view for admins
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 hover:bg-transparent"
                disabled={isPending}
              >
                <Badge
                  variant="secondary"
                  className={cn(
                    config.color,
                    "cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                  )}
                >
                  {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      {config.label}
                      <ChevronDown className="h-3 w-3 ml-0.5" />
                    </>
                  )}
                </Badge>
                {prioridadeManual && (
                  <Pencil className="h-3 w-3 ml-1 text-muted-foreground" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {prioridadeManual 
              ? "Prioridade manual (clique para editar)" 
              : "Clique para definir prioridade manual"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent align="start" className="w-40">
        {prioridadeOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "cursor-pointer",
              option.value === prioridade && "bg-muted"
            )}
          >
            <Badge
              variant="secondary"
              className={cn(prioridadeConfig[option.value].color, "mr-2")}
            >
              {option.label}
            </Badge>
            {option.value === prioridade && (
              <span className="text-xs text-muted-foreground ml-auto">atual</span>
            )}
          </DropdownMenuItem>
        ))}
        
        {prioridadeManual && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleReset}
              className="cursor-pointer text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-2" />
              Limpar manual
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
