import { getCampanhaDoMes, CampanhaMensal } from "@/config/campanhasMensais";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Lightbulb } from "lucide-react";

interface CampanhaBadgeProps {
  mes: number;
  showSugestoes?: boolean;
}

export function CampanhaBadge({ mes, showSugestoes = false }: CampanhaBadgeProps) {
  const campanha = getCampanhaDoMes(mes);
  
  if (!campanha) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Badge 
          variant="outline" 
          className="cursor-pointer hover:opacity-80 transition-opacity gap-1.5 px-3 py-1"
          style={{ 
            borderColor: campanha.corPrimaria,
            color: campanha.corPrimaria,
            backgroundColor: `${campanha.corPrimaria}10`
          }}
        >
          <span 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: campanha.corPrimaria }}
          />
          {campanha.nome}
          <Info className="h-3 w-3 ml-1" />
        </Badge>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${campanha.corPrimaria}20` }}
            >
              <div 
                className="w-6 h-6 rounded-full"
                style={{ backgroundColor: campanha.corPrimaria }}
              />
            </div>
            <div>
              <DialogTitle>{campanha.nome}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{campanha.descricao}</p>
            </div>
          </div>
        </DialogHeader>

        {showSugestoes && campanha.sugestoes.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              <h4 className="font-medium text-sm">Sugestões de Ações</h4>
            </div>
            <ul className="space-y-2">
              {campanha.sugestoes.map((sugestao, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {sugestao}
                </li>
              ))}
            </ul>
          </div>
        )}

        {campanha.cores.length > 1 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Cores:</span>
            {campanha.cores.map((cor, idx) => (
              <div
                key={idx}
                className="w-6 h-6 rounded-full border"
                style={{ backgroundColor: cor }}
                title={cor}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
