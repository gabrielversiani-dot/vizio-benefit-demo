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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface DeleteIndicadorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteMonthly: boolean) => Promise<void>;
  isLoading: boolean;
  periodoLabel?: string;
}

export function DeleteIndicadorModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  periodoLabel,
}: DeleteIndicadorModalProps) {
  const [deleteMonthly, setDeleteMonthly] = useState(false);

  const handleConfirm = async () => {
    await onConfirm(deleteMonthly);
    setDeleteMonthly(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setDeleteMonthly(false);
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir indicador do período?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Isso removerá o resumo do período (Média do Período)
              {periodoLabel && <strong> ({periodoLabel})</strong>}.
            </p>
            <p className="text-muted-foreground">
              Os dados importados associados podem ser mantidos ou excluídos conforme sua escolha.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start space-x-3 py-4 px-1">
          <Checkbox
            id="delete-monthly"
            checked={deleteMonthly}
            onCheckedChange={(checked) => setDeleteMonthly(checked === true)}
            disabled={isLoading}
          />
          <div className="grid gap-1.5 leading-none">
            <Label
              htmlFor="delete-monthly"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Excluir também os dados mensais desse PDF
            </Label>
            <p className="text-xs text-muted-foreground">
              Remove os registros de sinistralidade mensal importados junto com este relatório.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Excluir"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
