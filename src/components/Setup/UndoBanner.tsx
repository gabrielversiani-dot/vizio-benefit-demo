import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Undo2, Clock, X } from "lucide-react";

interface UndoBannerProps {
  snapshotId: string;
  step: string;
  itemCount: number;
  expiresAt: string;
  onUndo: () => void;
  onDismiss: () => void;
  isUndoing?: boolean;
}

export function UndoBanner({
  snapshotId,
  step,
  itemCount,
  expiresAt,
  onUndo,
  onDismiss,
  isUndoing = false,
}: UndoBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const expiryTime = new Date(expiresAt).getTime();
    const totalDuration = 2 * 60 * 1000; // 2 minutes

    const updateTimer = () => {
      const remaining = expiryTime - Date.now();
      if (remaining <= 0) {
        onDismiss();
        return;
      }
      setTimeRemaining(Math.ceil(remaining / 1000));
      setProgress((remaining / totalDuration) * 100);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onDismiss]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stepLabels: Record<string, string> = {
    empresas: 'Empresas',
    perfis: 'Perfis',
    roles: 'Funções',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-lg shadow-lg overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Undo2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Desfazer disponível</p>
              <p className="text-xs text-muted-foreground">
                {itemCount} {stepLabels[step] || step} aplicado(s)
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Expira em {formatTime(timeRemaining)}
          </span>
          <Badge variant="outline" className="ml-auto text-xs">
            {Math.ceil(progress)}%
          </Badge>
        </div>

        <Progress value={progress} className="h-1 mt-2" />

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 gap-2"
          onClick={onUndo}
          disabled={isUndoing}
        >
          <Undo2 className="h-4 w-4" />
          {isUndoing ? 'Desfazendo...' : 'Desfazer alterações'}
        </Button>
      </div>
    </div>
  );
}
