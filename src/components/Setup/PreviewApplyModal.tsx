import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, RefreshCw, SkipForward, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export interface PreviewItem {
  identifier: string;
  action: 'create' | 'update' | 'skip' | 'error';
  details?: string;
  changes?: { field: string; from?: string; to: string }[];
}

interface PreviewApplyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: PreviewItem[];
  onConfirm: () => void;
  isApplying?: boolean;
}

export function PreviewApplyModal({
  open,
  onOpenChange,
  title,
  items,
  onConfirm,
  isApplying = false,
}: PreviewApplyModalProps) {
  const createCount = items.filter(i => i.action === 'create').length;
  const updateCount = items.filter(i => i.action === 'update').length;
  const skipCount = items.filter(i => i.action === 'skip').length;
  const errorCount = items.filter(i => i.action === 'error').length;

  const getActionIcon = (action: PreviewItem['action']) => {
    switch (action) {
      case 'create':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'update':
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      case 'skip':
        return <SkipForward className="h-4 w-4 text-muted-foreground" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getActionBadge = (action: PreviewItem['action']) => {
    switch (action) {
      case 'create':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Criar</Badge>;
      case 'update':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Atualizar</Badge>;
      case 'skip':
        return <Badge variant="secondary">Ignorar</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Revisão: {title}
          </DialogTitle>
          <DialogDescription>
            Revise as alterações antes de aplicar. Esta ação pode ser desfeita em até 2 minutos.
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-center">
            <p className="text-2xl font-bold text-green-600">{createCount}</p>
            <p className="text-xs text-muted-foreground">Criar</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-center">
            <p className="text-2xl font-bold text-blue-600">{updateCount}</p>
            <p className="text-xs text-muted-foreground">Atualizar</p>
          </div>
          <div className="p-3 rounded-lg bg-muted text-center">
            <p className="text-2xl font-bold text-muted-foreground">{skipCount}</p>
            <p className="text-xs text-muted-foreground">Ignorar</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 text-center">
            <p className="text-2xl font-bold text-destructive">{errorCount}</p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </div>
        </div>

        <Separator />

        {/* Items list */}
        <ScrollArea className="flex-1 max-h-[300px]">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  item.action === 'error' ? 'border-destructive/50 bg-destructive/5' :
                  item.action === 'skip' ? 'border-muted bg-muted/30' :
                  'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getActionIcon(item.action)}
                    <span className="font-medium">{item.identifier}</span>
                  </div>
                  {getActionBadge(item.action)}
                </div>
                {item.details && (
                  <p className="text-sm text-muted-foreground mt-1">{item.details}</p>
                )}
                {item.changes && item.changes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {item.changes.map((change, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium">{change.field}:</span>
                        {change.from && (
                          <span className="line-through text-destructive ml-1">{change.from}</span>
                        )}
                        <span className="text-green-600 ml-1">→ {change.to}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isApplying || errorCount === items.length}
            className="gap-2"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Aplicando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Aplicar {createCount + updateCount} alteração(ões)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
