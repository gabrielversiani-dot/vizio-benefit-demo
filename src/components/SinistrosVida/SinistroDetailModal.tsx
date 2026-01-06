import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SinistroDocumentos } from "./SinistroDocumentos";
import { SinistroTimeline } from "./SinistroTimeline";
import { SinistroStatusEditor } from "./SinistroStatusEditor";
import { SinistroPrioridadeEditor } from "./SinistroPrioridadeEditor";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  User, 
  Building2, 
  DollarSign, 
  FileText, 
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Clock
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { formatSLA } from "@/lib/formatSLA";

interface Sinistro {
  id: string;
  beneficiario_nome: string;
  beneficiario_cpf?: string;
  tipo_sinistro: string;
  status: string;
  prioridade?: string;
  data_ocorrencia: string;
  data_comunicacao?: string;
  valor_indenizacao?: number;
  valor_estimado?: number;
  observacoes?: string;
  empresa_id: string;
  empresas?: { nome: string };
  aberto_por_role?: string;
  rd_deal_id?: string;
  rd_sync_status?: string;
  rd_sync_error?: string;
  rd_last_sync_at?: string;
  concluido_em?: string;
  sla_minutos?: number;
  created_at: string;
}

interface SinistroDetailModalProps {
  sinistro: Sinistro | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

const tipoSinistroConfig: Record<string, string> = {
  morte_natural: "Morte Natural",
  morte_acidental: "Morte Acidental",
  invalidez: "Invalidez Permanente",
  doenca_grave: "Doença Grave",
  outro: "Outro",
};

export function SinistroDetailModal({ sinistro, open, onOpenChange, canEdit }: SinistroDetailModalProps) {
  const { isAdminVizio } = usePermissions();

  if (!sinistro) return null;

  const slaFormatted = sinistro.sla_minutos 
    ? formatSLA(sinistro.sla_minutos * 60) 
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl">Detalhes do Sinistro</DialogTitle>
            <div className="flex items-center gap-2">
              <SinistroPrioridadeEditor
                sinistroId={sinistro.id}
                prioridade={sinistro.prioridade || 'media'}
                empresaId={sinistro.empresa_id}
              />
              <SinistroStatusEditor
                sinistroId={sinistro.id}
                status={sinistro.status}
                empresaId={sinistro.empresa_id}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* RD Station Info (Admin only) */}
          {isAdminVizio && sinistro.rd_deal_id && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">RD Station CRM</span>
                  {sinistro.rd_sync_status === 'ok' ? (
                    <Badge variant="outline" className="text-success border-success">
                      Sincronizado
                    </Badge>
                  ) : sinistro.rd_sync_status === 'erro' ? (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Erro
                    </Badge>
                  ) : null}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={`https://crm.rdstation.com/deals/${sinistro.rd_deal_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir no RD
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </a>
                </Button>
              </div>
              {sinistro.rd_sync_error && (
                <div className="mt-2 flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>{sinistro.rd_sync_error}</span>
                </div>
              )}
              {sinistro.rd_last_sync_at && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Última sync: {format(new Date(sinistro.rd_last_sync_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          )}

          {/* SLA Info */}
          {slaFormatted && (
            <div className="rounded-lg border p-4 bg-success/5 border-success/30">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">
                  Sinistro concluído em {slaFormatted}
                </span>
              </div>
              {sinistro.concluido_em && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Concluído em {format(new Date(sinistro.concluido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          )}

          {/* Beneficiário */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Beneficiário
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Nome</p>
                <p className="font-medium">{sinistro.beneficiario_nome}</p>
              </div>
              {sinistro.beneficiario_cpf && (
                <div>
                  <p className="text-muted-foreground">CPF</p>
                  <p className="font-medium">{sinistro.beneficiario_cpf}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Empresa */}
          {sinistro.empresas && (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Empresa
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{sinistro.empresas.nome}</p>
                  {sinistro.aberto_por_role && (
                    <Badge variant="outline" className="text-xs">
                      Aberto pela {sinistro.aberto_por_role === 'vizio' ? 'Vizio' : 'Empresa'}
                    </Badge>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Informações do Sinistro */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Informações do Sinistro
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium">{tipoSinistroConfig[sinistro.tipo_sinistro] || sinistro.tipo_sinistro}</p>
              </div>
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-medium font-mono text-xs">{sinistro.id.slice(0, 8)}...</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Datas */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Datas
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Data do Evento</p>
                <p className="font-medium">
                  {format(new Date(sinistro.data_ocorrencia), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Data de Abertura</p>
                <p className="font-medium">
                  {format(new Date(sinistro.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              {sinistro.data_comunicacao && (
                <div>
                  <p className="text-muted-foreground">Data da Comunicação</p>
                  <p className="font-medium">
                    {format(new Date(sinistro.data_comunicacao), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Valores */}
          {(sinistro.valor_estimado || sinistro.valor_indenizacao) && (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valores
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {sinistro.valor_estimado && (
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Estimado</p>
                      <p className="text-xl font-bold">
                        {sinistro.valor_estimado.toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </p>
                    </div>
                  )}
                  {sinistro.valor_indenizacao && (
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Pago</p>
                      <p className="text-xl font-bold text-success">
                        {sinistro.valor_indenizacao.toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Observações */}
          {sinistro.observacoes && (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold">Observações</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {sinistro.observacoes}
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Timeline */}
          <SinistroTimeline sinistroId={sinistro.id} />

          <Separator />

          {/* Documentos */}
          <SinistroDocumentos 
            sinistroId={sinistro.id} 
            empresaId={sinistro.empresa_id}
            canEdit={canEdit}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
