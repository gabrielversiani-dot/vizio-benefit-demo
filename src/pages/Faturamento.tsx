import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";

const mockInvoices = [
  { id: "FAT-2024-001", cliente: "Empresa Alpha Ltda", valor: 12500, status: "pago", vencimento: "2024-11-15", tipo: "Saúde" },
  { id: "FAT-2024-002", cliente: "Beta Tecnologia S.A.", valor: 8900, status: "pendente", vencimento: "2024-12-05", tipo: "Odonto" },
  { id: "FAT-2024-003", cliente: "Gamma Indústria", valor: 15200, status: "pago", vencimento: "2024-11-20", tipo: "Saúde + Vida" },
  { id: "FAT-2024-004", cliente: "Delta Comércio", valor: 6700, status: "atrasado", vencimento: "2024-11-10", tipo: "Vida" },
  { id: "FAT-2024-005", cliente: "Epsilon Serviços", valor: 11300, status: "pendente", vencimento: "2024-12-08", tipo: "Saúde" },
];

const statusConfig = {
  pago: { label: "Pago", color: "bg-success text-success-foreground", icon: CheckCircle },
  pendente: { label: "Pendente", color: "bg-warning text-warning-foreground", icon: Clock },
  atrasado: { label: "Atrasado", color: "bg-destructive text-destructive-foreground", icon: AlertCircle },
};

export default function Faturamento() {
  const totalFaturado = mockInvoices.filter(inv => inv.status === "pago").reduce((acc, inv) => acc + inv.valor, 0);
  const totalPendente = mockInvoices.filter(inv => inv.status === "pendente").reduce((acc, inv) => acc + inv.valor, 0);
  const totalAtrasado = mockInvoices.filter(inv => inv.status === "atrasado").reduce((acc, inv) => acc + inv.valor, 0);

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
              <p className="text-sm text-success mt-2">+12% vs mês anterior</p>
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
              <p className="text-sm text-muted-foreground mt-2">2 faturas pendentes</p>
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
              <p className="text-sm text-destructive mt-2">1 fatura atrasada</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Faturas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockInvoices.map((invoice) => {
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
