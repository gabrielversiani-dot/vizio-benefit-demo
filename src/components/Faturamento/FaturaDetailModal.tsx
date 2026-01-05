import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileText, Heart, Shield, Smile, CheckCircle, Clock, AlertCircle, Calendar, Building2 } from "lucide-react";

type FaturaDetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fatura: any;
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pago: { label: "Pago", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  aguardando_pagamento: { label: "Aguardando", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  atraso: { label: "Em Atraso", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", icon: AlertCircle },
};

const produtoConfig: Record<string, { label: string; color: string; icon: typeof Heart }> = {
  saude: { label: "Saúde", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: Heart },
  vida: { label: "Vida", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: Shield },
  odonto: { label: "Odonto", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300", icon: Smile },
};

const docTipoLabels: Record<string, string> = {
  boleto: "Boleto",
  nf: "Nota Fiscal",
  demonstrativo: "Demonstrativo",
  outro: "Outro",
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function FaturaDetailModal({ open, onOpenChange, fatura }: FaturaDetailModalProps) {
  // Fetch subfaturas
  const { data: subfaturas = [] } = useQuery({
    queryKey: ["faturamento-subfaturas-detail", fatura.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faturamento_subfaturas")
        .select(`
          *,
          entidade:faturamento_entidades(nome, tipo)
        `)
        .eq("faturamento_id", fatura.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Fetch documentos
  const { data: documentos = [] } = useQuery({
    queryKey: ["faturamento-documentos-detail", fatura.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faturamento_documentos")
        .select("*")
        .eq("faturamento_id", fatura.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Fetch empresa name
  const { data: empresa } = useQuery({
    queryKey: ["empresa-detail", fatura.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("nome")
        .eq("id", fatura.empresa_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const statusInfo = statusConfig[fatura.status];
  const produtoInfo = produtoConfig[fatura.produto];
  const StatusIcon = statusInfo?.icon || Clock;
  const ProdutoIcon = produtoInfo?.icon || Heart;

  const handleDownload = async (storagePath: string) => {
    const { data } = await supabase.storage
      .from("faturamento_docs")
      .createSignedUrl(storagePath, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const totalSubfaturas = subfaturas.reduce((acc, sf) => acc + Number(sf.valor), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Detalhes da Fatura</span>
            <Badge className={`${produtoInfo?.color} flex items-center gap-1`}>
              <ProdutoIcon className="h-3 w-3" />
              {produtoInfo?.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Competência {format(new Date(fatura.competencia), "MMMM/yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm">Empresa</span>
                </div>
                <p className="font-semibold">{empresa?.nome || "-"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Vencimento</span>
                </div>
                <p className="font-semibold">
                  {format(new Date(fatura.vencimento), "dd/MM/yyyy")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-muted-foreground text-sm mb-1">Valor Total</div>
                <p className="text-2xl font-bold">{formatCurrency(Number(fatura.valor_total))}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-muted-foreground text-sm mb-1">Status</div>
                <Badge className={`${statusInfo?.color} flex items-center gap-1 w-fit`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusInfo?.label}
                </Badge>
                {fatura.pago_em && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Pago em {format(new Date(fatura.pago_em), "dd/MM/yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Observações */}
          {fatura.observacao && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{fatura.observacao}</p>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="subfaturas">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="subfaturas">
                Subfaturas ({subfaturas.length})
              </TabsTrigger>
              <TabsTrigger value="documentos">
                Documentos ({documentos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="subfaturas" className="mt-4">
              {subfaturas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma subfatura cadastrada
                </p>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entidade</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subfaturas.map((sf: any) => (
                        <TableRow key={sf.id}>
                          <TableCell>
                            {sf.entidade ? (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {sf.entidade.tipo === "coligada" ? "Coligada" : "Subestipulante"}
                                </Badge>
                                {sf.entidade.nome}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{sf.descricao || "-"}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(Number(sf.valor))}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={2} className="font-semibold">
                          Total Subfaturas
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(totalSubfaturas)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="documentos" className="mt-4">
              {documentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum documento anexado
                </p>
              ) : (
                <div className="space-y-2">
                  {documentos.map((doc: any) => (
                    <Card key={doc.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.filename}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline">{docTipoLabels[doc.tipo]}</Badge>
                              <span>{(doc.tamanho_bytes / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span>{format(new Date(doc.created_at), "dd/MM/yyyy")}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(doc.storage_path)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
