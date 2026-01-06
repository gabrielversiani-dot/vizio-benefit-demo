import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  Clock, 
  User, 
  Building2, 
  Tag,
  AlertTriangle,
  CheckCircle2,
  History
} from "lucide-react";
import { useDemandaHistorico } from "@/hooks/useDemandaHistorico";
import { DemandaTimeline } from "./DemandaTimeline";
import { formatSLA, calculateSLASeconds } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  aguardando_documentacao: { label: "Aguardando Doc.", color: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
  concluido: { label: "Concluído", color: "bg-green-500/20 text-green-700 border-green-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-700 border-red-500/30" },
};

const tipoConfig: Record<string, string> = {
  certificado: "Certificado",
  carteirinha: "Carteirinha",
  alteracao_cadastral: "Alteração Cadastral",
  reembolso: "Reembolso",
  autorizacao: "Autorização",
  agendamento: "Agendamento",
  outro: "Outro",
};

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-slate-500/20 text-slate-700" },
  media: { label: "Média", color: "bg-blue-500/20 text-blue-700" },
  alta: { label: "Alta", color: "bg-orange-500/20 text-orange-700" },
  urgente: { label: "Urgente", color: "bg-red-500/20 text-red-700" },
};

interface Demanda {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  prioridade: string;
  prazo: string | null;
  created_at: string;
  concluida_em?: string | null;
  source: string;
  descricao?: string | null;
  rd_deal_name?: string | null;
  responsavel_nome?: string | null;
  empresa_id: string;
}

interface DemandaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demanda: Demanda | null;
}

export function DemandaDetailModal({ open, onOpenChange, demanda }: DemandaDetailModalProps) {
  const { data: historico = [], isLoading: isLoadingHistorico } = useDemandaHistorico({
    demandaId: demanda?.id,
    empresaId: demanda?.empresa_id,
  });

  if (!demanda) return null;

  const isConcluida = demanda.status === 'concluido';
  const slaSeconds = isConcluida && demanda.concluida_em 
    ? calculateSLASeconds(demanda.created_at, demanda.concluida_em)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl mb-2">{demanda.titulo}</DialogTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn(statusConfig[demanda.status]?.color)}>
                  {isConcluida && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {statusConfig[demanda.status]?.label || demanda.status}
                </Badge>
                <Badge variant="secondary" className={cn(prioridadeConfig[demanda.prioridade]?.color)}>
                  {prioridadeConfig[demanda.prioridade]?.label || demanda.prioridade}
                </Badge>
                <Badge variant="outline">{tipoConfig[demanda.tipo] || demanda.tipo}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="detalhes" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Timeline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="detalhes" className="space-y-4 mt-4">
              {/* SLA Card - prominent when concluded */}
              {isConcluida && slaSeconds !== null && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-800">Demanda Concluída</p>
                      <p className="text-sm text-green-700">
                        SLA Total: <span className="font-bold">{formatSLA(slaSeconds)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Data de Abertura
                  </div>
                  <p className="font-medium">
                    {format(new Date(demanda.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                {isConcluida && demanda.concluida_em && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      Data de Conclusão
                    </div>
                    <p className="font-medium">
                      {format(new Date(demanda.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}

                {demanda.prazo && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Prazo
                    </div>
                    <p className="font-medium">
                      {format(new Date(demanda.prazo), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}

                {demanda.responsavel_nome && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      Responsável
                    </div>
                    <p className="font-medium">{demanda.responsavel_nome}</p>
                  </div>
                )}

                {demanda.rd_deal_name && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      Negociação RD
                    </div>
                    <p className="font-medium">{demanda.rd_deal_name}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    Origem
                  </div>
                  <Badge variant="secondary" className={demanda.source === 'rd_station' ? 'bg-purple-100 text-purple-700' : ''}>
                    {demanda.source === 'rd_station' ? 'RD Station' : 'Manual'}
                  </Badge>
                </div>
              </div>

              {demanda.descricao && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Descrição</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {demanda.descricao}
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              {isLoadingHistorico ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <DemandaTimeline 
                  events={historico} 
                  showDemandaTitle={false}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
