import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type DeleteFaturaModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fatura: any;
  onSuccess: () => void;
};

const produtoLabels: Record<string, string> = {
  saude: "Saúde",
  vida: "Vida",
  odonto: "Odonto",
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function DeleteFaturaModal({ open, onOpenChange, fatura, onSuccess }: DeleteFaturaModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // First, get all document paths to delete from storage
      const { data: docs } = await supabase
        .from("faturamento_documentos")
        .select("storage_path")
        .eq("faturamento_id", fatura.id);

      // Delete documents from storage
      if (docs && docs.length > 0) {
        const paths = docs.map(d => d.storage_path);
        await supabase.storage.from("faturamento_docs").remove(paths);
      }

      // Delete fatura (cascades to subfaturas and documentos)
      const { error } = await supabase
        .from("faturamentos")
        .delete()
        .eq("id", fatura.id);

      if (error) throw error;

      toast.success("Fatura excluída com sucesso");
      onSuccess();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error("Erro ao excluir fatura", {
        description: err.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir fatura?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Tem certeza que deseja excluir esta fatura? Esta ação não pode ser desfeita.
            </p>
            <div className="bg-muted p-3 rounded-lg text-foreground">
              <p><strong>Produto:</strong> {produtoLabels[fatura.produto]}</p>
              <p><strong>Competência:</strong> {format(new Date(fatura.competencia), "MMMM/yyyy", { locale: ptBR })}</p>
              <p><strong>Valor:</strong> {formatCurrency(Number(fatura.valor_total))}</p>
            </div>
            <p className="text-sm text-destructive">
              Isso também excluirá todas as subfaturas e documentos associados.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Excluindo..." : "Excluir Fatura"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
