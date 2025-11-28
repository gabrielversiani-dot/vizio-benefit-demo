import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Search,
  FileText,
  Calendar
} from "lucide-react";
import { useState } from "react";

const mockSinistros = [
  {
    id: "SVG-2024-001",
    beneficiario: "Carlos Alberto Santos",
    cpf: "123.456.789-00",
    empresa: "Empresa Alpha Ltda",
    evento: "Morte Natural",
    dataEvento: "2024-11-15",
    dataAbertura: "2024-11-16",
    valorSegurado: 150000,
    status: "aprovado",
    documentos: "completo",
  },
  {
    id: "SVG-2024-002",
    beneficiario: "Maria Fernanda Costa",
    cpf: "987.654.321-00",
    empresa: "Beta Tecnologia S.A.",
    evento: "Morte Acidental",
    dataEvento: "2024-11-20",
    dataAbertura: "2024-11-21",
    valorSegurado: 200000,
    status: "em_analise",
    documentos: "parcial",
  },
  {
    id: "SVG-2024-003",
    beneficiario: "João Pedro Oliveira",
    cpf: "456.789.123-00",
    empresa: "Gamma Indústria",
    evento: "Invalidez Permanente",
    dataEvento: "2024-11-18",
    dataAbertura: "2024-11-19",
    valorSegurado: 100000,
    status: "aguardando_docs",
    documentos: "pendente",
  },
  {
    id: "SVG-2024-004",
    beneficiario: "Ana Paula Silva",
    cpf: "321.654.987-00",
    empresa: "Delta Comércio",
    evento: "Morte Natural",
    dataEvento: "2024-11-10",
    dataAbertura: "2024-11-11",
    valorSegurado: 180000,
    status: "em_pagamento",
    documentos: "completo",
  },
];

const statusConfig = {
  aprovado: { label: "Aprovado", color: "bg-success text-success-foreground" },
  em_analise: { label: "Em Análise", color: "bg-warning text-warning-foreground" },
  aguardando_docs: { label: "Aguardando Docs", color: "bg-chart-3 text-chart-3-foreground" },
  em_pagamento: { label: "Em Pagamento", color: "bg-chart-1 text-chart-1-foreground" },
  negado: { label: "Negado", color: "bg-destructive text-destructive-foreground" },
};

const documentosConfig = {
  completo: { label: "Completo", color: "bg-success text-success-foreground" },
  parcial: { label: "Parcial", color: "bg-warning text-warning-foreground" },
  pendente: { label: "Pendente", color: "bg-destructive text-destructive-foreground" },
};

export default function SinistrosVida() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const totalSinistros = mockSinistros.length;
  const valorTotal = mockSinistros.reduce((acc, s) => acc + s.valorSegurado, 0);
  const valorMedio = valorTotal / totalSinistros;
  const aprovados = mockSinistros.filter(s => s.status === "aprovado").length;
  const taxaAprovacao = (aprovados / totalSinistros) * 100;

  const filteredSinistros = mockSinistros.filter(
    (sinistro) =>
      sinistro.beneficiario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sinistro.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sinistro.empresa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Sinistros de Vida em Grupo</h1>
            <p className="mt-2 text-muted-foreground">
              Gestão completa de sinistros de seguro de vida em grupo
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Sinistro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Registrar Novo Sinistro</DialogTitle>
                <DialogDescription>
                  Preencha as informações do sinistro de vida em grupo
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="beneficiario">Beneficiário</Label>
                    <Input id="beneficiario" placeholder="Nome completo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input id="cpf" placeholder="000.000.000-00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="empresa">Empresa</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alpha">Empresa Alpha Ltda</SelectItem>
                      <SelectItem value="beta">Beta Tecnologia S.A.</SelectItem>
                      <SelectItem value="gamma">Gamma Indústria</SelectItem>
                      <SelectItem value="delta">Delta Comércio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="evento">Tipo de Evento</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morte_natural">Morte Natural</SelectItem>
                        <SelectItem value="morte_acidental">Morte Acidental</SelectItem>
                        <SelectItem value="invalidez">Invalidez Permanente</SelectItem>
                        <SelectItem value="doenca_grave">Doença Grave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataEvento">Data do Evento</Label>
                    <Input id="dataEvento" type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor Segurado (R$)</Label>
                  <Input id="valor" type="number" placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea 
                    id="observacoes" 
                    placeholder="Detalhes adicionais sobre o sinistro..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => setIsDialogOpen(false)}>
                  Registrar Sinistro
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-chart-1/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-chart-1" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total de Sinistros</p>
              </div>
              <p className="text-3xl font-bold">{totalSinistros}</p>
              <p className="text-sm text-muted-foreground mt-2">Últimos 30 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-chart-2" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Valor Médio</p>
              </div>
              <p className="text-3xl font-bold">R$ {valorMedio.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground mt-2">Por sinistro</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Aprovação</p>
              </div>
              <p className="text-3xl font-bold">{taxaAprovacao.toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground mt-2">{aprovados} aprovados</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-chart-4" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Tempo Médio</p>
              </div>
              <p className="text-3xl font-bold">12 dias</p>
              <p className="text-sm text-muted-foreground mt-2">De análise</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Listagem de Sinistros</CardTitle>
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por beneficiário, ID ou empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Beneficiário</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Data Evento</TableHead>
                  <TableHead>Valor Segurado</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSinistros.map((sinistro) => {
                  const statusConf = statusConfig[sinistro.status as keyof typeof statusConfig];
                  const docsConf = documentosConfig[sinistro.documentos as keyof typeof documentosConfig];
                  
                  return (
                    <TableRow key={sinistro.id}>
                      <TableCell className="font-medium">{sinistro.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sinistro.beneficiario}</p>
                          <p className="text-sm text-muted-foreground">{sinistro.cpf}</p>
                        </div>
                      </TableCell>
                      <TableCell>{sinistro.empresa}</TableCell>
                      <TableCell>{sinistro.evento}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(sinistro.dataEvento).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        R$ {sinistro.valorSegurado.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={docsConf.color}>
                          {docsConf.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConf.color}>
                          {statusConf.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="gap-2">
                          <FileText className="h-4 w-4" />
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
