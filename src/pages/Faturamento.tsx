import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";

// Dados reais virão do banco de dados
const invoices: any[] = [];

const statusConfig = {
  pago: { label: "Pago", color: "bg-success text-success-foreground", icon: CheckCircle },
  pendente: { label: "Pendente", color: "bg-warning text-warning-foreground", icon: Clock },
  atrasado: { label: "Atrasado", color: "bg-destructive text-destructive-foreground", icon: AlertCircle },
};

export default function Faturamento() {
  const totalFaturado = invoices.filter(inv => inv.status === "pago").reduce((acc, inv) => acc + inv.valor, 0);
  const totalPendente = invoices.filter(inv => inv.status === "pendente").reduce((acc, inv) => acc + inv.valor, 0);
  const totalAtrasado = invoices.filter(inv => inv.status === "atrasado").reduce((acc, inv) => acc + inv.valor, 0);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Faturamento</h1>
          <p className="mt-2 text-muted-foreground">
            Gestão completa de faturas e recebíveis
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total Faturado</p>
              </div>
              <p className="text-3xl font-bold">R$ {totalFaturado.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground mt-2">Aguardando dados</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">A Receber</p>
              </div>
              <p className="text-3xl font-bold">R$ {totalPendente.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground mt-2">0 faturas pendentes</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Em Atraso</p>
              </div>
              <p className="text-3xl font-bold">R$ {totalAtrasado.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground mt-2">0 faturas atrasadas</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Faturas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Nenhuma fatura cadastrada
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => {
                  const config = statusConfig[invoice.status as keyof typeof statusConfig];
                  const StatusIcon = config.icon;
                  
                  return (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <DollarSign className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-semibold">{invoice.cliente}</p>
                            <Badge variant="secondary" className="text-xs">
                              {invoice.tipo}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{invoice.id}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Venc: {new Date(invoice.vencimento).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xl font-bold">
                            R$ {invoice.valor.toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <Badge className={config.color}>
                          <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
