import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertCircle, 
  FileText, 
  FileSignature, 
  ClipboardList, 
  Upload, 
  TrendingUp,
  ExternalLink,
  CheckCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

interface PendenciasData {
  faturasVencidas: Array<{
    id: string;
    competencia: string;
    valor_total: number;
    vencimento: string;
    produto: string;
  }>;
  contratosVencendo: Array<{
    id: string;
    titulo: string;
    data_fim: string;
    operadora: string | null;
  }>;
  demandasPendentes: Array<{
    id: string;
    titulo: string;
    status: string;
    updated_at: string;
    prioridade: string;
  }>;
  importJobs: Array<{
    id: string;
    arquivo_nome: string;
    status: string;
    data_type: string;
    created_at: string;
  }>;
  sinistralidade85: Array<{
    id: string;
    competencia: string;
    indice_sinistralidade: number;
    categoria: string;
  }>;
}

interface PendenciasListProps {
  data: PendenciasData | null | undefined;
  isLoading: boolean;
  onMarkAsPaid?: (id: string) => void;
}

export function PendenciasList({ data, isLoading, onMarkAsPaid }: PendenciasListProps) {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Central de Pendências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasPendencias = 
    (data?.faturasVencidas?.length || 0) > 0 ||
    (data?.contratosVencendo?.length || 0) > 0 ||
    (data?.demandasPendentes?.length || 0) > 0 ||
    (data?.importJobs?.length || 0) > 0 ||
    (data?.sinistralidade85?.length || 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Central de Pendências
          {hasPendencias && (
            <Badge variant="destructive" className="ml-2 text-[10px]">
              Atenção
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasPendencias ? (
          <div className="flex items-center gap-3 p-4 bg-success/5 rounded-lg border border-success/20">
            <CheckCircle className="h-5 w-5 text-success" />
            <p className="text-sm text-muted-foreground">
              Nenhuma pendência no momento. Tudo em dia! 🎉
            </p>
          </div>
        ) : (
          <>
            {/* Faturas vencidas */}
            {data?.faturasVencidas?.map((fatura) => (
              <div
                key={fatura.id}
                className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">
                      Fatura em atraso - {fatura.produto}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fatura.valor_total?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {" • "}
                      Venceu {formatDistanceToNow(new Date(fatura.vencimento), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
                {isAdmin && onMarkAsPaid && (
                  <Button size="sm" variant="outline" onClick={() => onMarkAsPaid(fatura.id)}>
                    Marcar pago
                  </Button>
                )}
              </div>
            ))}

            {/* Contratos vencendo */}
            {data?.contratosVencendo?.map((contrato) => (
              <div
                key={contrato.id}
                className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20"
              >
                <div className="flex items-center gap-3">
                  <FileSignature className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-sm font-medium">{contrato.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence em {formatDistanceToNow(new Date(contrato.data_fim), { locale: ptBR })}
                      {contrato.operadora && ` • ${contrato.operadora}`}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/contratos`)}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Ver
                </Button>
              </div>
            ))}

            {/* Demandas pendentes */}
            {data?.demandasPendentes?.slice(0, 3).map((demanda) => (
              <div
                key={demanda.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
              >
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {demanda.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Atualizado {formatDistanceToNow(new Date(demanda.updated_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/demandas`)}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Abrir
                </Button>
              </div>
            ))}

            {/* Import jobs com erro */}
            {isAdmin && data?.importJobs?.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
              >
                <div className="flex items-center gap-3">
                  <Upload className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">
                      Importação {job.status === "failed" ? "falhou" : "aguardando revisão"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {job.arquivo_nome} • {job.data_type}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/admin/importacao/${job.id}`)}
                >
                  Corrigir
                </Button>
              </div>
            ))}

            {/* Sinistralidade alta */}
            {data?.sinistralidade85?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-sm font-medium">
                      Sinistralidade alta: {s.indice_sinistralidade?.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.competencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                      {" • "}{s.categoria}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-warning border-warning/30">
                  Atenção
                </Badge>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
