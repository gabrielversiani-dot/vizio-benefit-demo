import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SinistroDocumentos } from "./SinistroDocumentos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, User, Building2, DollarSign, FileText } from "lucide-react";

interface Sinistro {
  id: string;
  beneficiario_nome: string;
  beneficiario_cpf?: string;
  tipo_sinistro: string;
  status: string;
  data_ocorrencia: string;
  data_comunicacao?: string;
  valor_indenizacao?: number;
  observacoes?: string;
  empresa_id: string;
  empresas?: { nome: string };
}

interface SinistroDetailModalProps {
  sinistro: Sinistro | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  aprovado: { label: "Aprovado", color: "bg-success text-success-foreground" },
  pago: { label: "Pago", color: "bg-chart-2 text-white" },
  em_analise: { label: "Em Análise", color: "bg-warning text-warning-foreground" },
  aguardando_docs: { label: "Aguardando Docs", color: "bg-chart-3 text-white" },
  em_pagamento: { label: "Em Pagamento", color: "bg-chart-1 text-white" },
  negado: { label: "Negado", color: "bg-destructive text-destructive-foreground" },
};

const tipoSinistroConfig: Record<string, string> = {
  morte_natural: "Morte Natural",
  morte_acidental: "Morte Acidental",
  invalidez: "Invalidez Permanente",
  doenca_grave: "Doença Grave",
  outro: "Outro",
};

export function SinistroDetailModal({ sinistro, open, onOpenChange, canEdit }: SinistroDetailModalProps) {
  if (!sinistro) return null;

  const statusInfo = statusConfig[sinistro.status] || { label: sinistro.status, color: "bg-muted" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Detalhes do Sinistro</DialogTitle>
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
                <p className="text-sm font-medium">{sinistro.empresas.nome}</p>
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

          {/* Valor */}
          {sinistro.valor_indenizacao && (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valor da Indenização
                </h3>
                <p className="text-2xl font-bold text-primary">
                  {sinistro.valor_indenizacao.toLocaleString('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  })}
                </p>
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
