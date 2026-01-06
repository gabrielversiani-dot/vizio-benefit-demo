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
  Shield, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Search,
  FileText,
  Calendar,
  AlertTriangle,
  DollarSign
} from "lucide-react";
import { useState } from "react";
import { SinistroDetailModal } from "@/components/SinistrosVida/SinistroDetailModal";
import { SinistroFormModal } from "@/components/SinistrosVida/SinistroFormModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const statusConfig: Record<string, { label: string; color: string }> = {
  aprovado: { label: "Aprovado", color: "bg-success text-success-foreground" },
  pago: { label: "Pago", color: "bg-chart-2 text-white" },
  em_analise: { label: "Em Análise", color: "bg-warning text-warning-foreground" },
  pendente_documentos: { label: "Pendente Docs", color: "bg-chart-3 text-white" },
  em_andamento: { label: "Em Andamento", color: "bg-chart-1 text-white" },
  enviado_operadora: { label: "Enviado Operadora", color: "bg-chart-4 text-white" },
  negado: { label: "Negado", color: "bg-destructive text-destructive-foreground" },
  concluido: { label: "Concluído", color: "bg-success text-success-foreground" },
};

const tipoSinistroConfig: Record<string, { label: string; color: string }> = {
  morte_natural: { label: "Morte Natural", color: "#ef4444" },
  morte_acidental: { label: "Morte Acidental", color: "#f97316" },
  invalidez: { label: "Invalidez", color: "#eab308" },
  doenca_grave: { label: "Doença Grave", color: "#8b5cf6" },
  outro: { label: "Outro", color: "#94a3b8" },
};

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#22c55e'];

export default function SinistrosVida() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSinistro, setSelectedSinistro] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { empresaSelecionada, isAdminVizio } = useEmpresa();
  const { canManageSinistrosVida } = usePermissions();

  // Fetch sinistros from database
  const { data: sinistros = [], isLoading } = useQuery({
    queryKey: ['sinistros-vida', empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from('sinistros_vida')
        .select(`
          *,
          empresas:empresa_id (nome)
        `)
        .order('created_at', { ascending: false });

      if (empresaSelecionada) {
        query = query.eq('empresa_id', empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch empresas for the form
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdminVizio,
  });

  // Calculate KPIs
  const totalSinistros = sinistros.length;
  const valorTotal = sinistros.reduce((acc, s) => acc + (s.valor_indenizacao || 0), 0);
  const valorMedio = totalSinistros > 0 ? valorTotal / totalSinistros : 0;
  const aprovados = sinistros.filter(s => s.status === "aprovado" || s.status === "pago").length;
  const taxaAprovacao = totalSinistros > 0 ? (aprovados / totalSinistros) * 100 : 0;
  const emAnalise = sinistros.filter(s => s.status === "em_analise").length;

  // Distribution by type
  const distribuicaoTipo = sinistros.reduce((acc: Record<string, number>, s) => {
    const tipo = s.tipo_sinistro || 'outro';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(distribuicaoTipo).map(([key, value]) => ({
    name: tipoSinistroConfig[key]?.label || key,
    value,
    color: tipoSinistroConfig[key]?.color || '#94a3b8'
  }));

  // Monthly evolution
  const evolucaoMensal = sinistros.reduce((acc: Record<string, { quantidade: number; valor: number }>, s) => {
    const date = new Date(s.data_ocorrencia);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = { quantidade: 0, valor: 0 };
    acc[key].quantidade += 1;
    acc[key].valor += s.valor_indenizacao || 0;
    return acc;
  }, {});

  const chartData = Object.entries(evolucaoMensal)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, data]) => ({
      mes: new Date(key + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      quantidade: data.quantidade,
      valor: data.valor / 1000
    }));

  const filteredSinistros = sinistros.filter(
    (sinistro) =>
      sinistro.beneficiario_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sinistro.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sinistro.empresas?.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid gap-6 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

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
          {canManageSinistrosVida && (
            <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo Sinistro
            </Button>
          )}
        </div>

        {/* Form Modal */}
        <SinistroFormModal open={isFormOpen} onOpenChange={setIsFormOpen} />
        </div>

        {/* KPIs */}
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
              <p className="text-sm text-muted-foreground mt-2">{emAnalise} em análise</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-chart-2" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
              </div>
              <p className="text-3xl font-bold">
                {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Em indenizações</p>
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
              <p className="text-sm text-muted-foreground mt-2">{aprovados} aprovados/pagos</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-chart-4" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Valor Médio</p>
              </div>
              <p className="text-3xl font-bold">
                {valorMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Por sinistro</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {sinistros.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolução Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'valor' ? `R$ ${(value * 1000).toLocaleString('pt-BR')}` : value,
                          name === 'valor' ? 'Valor' : 'Quantidade'
                        ]}
                      />
                      <Bar yAxisId="left" dataKey="quantidade" fill="hsl(var(--chart-1))" name="quantidade" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="valor" fill="hsl(var(--chart-2))" name="valor" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts */}
        {emAnalise > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium">Sinistros Pendentes de Análise</p>
                  <p className="text-sm text-muted-foreground">
                    Existem {emAnalise} sinistro(s) aguardando análise e decisão.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
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
            {filteredSinistros.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                {searchTerm ? "Nenhum resultado encontrado" : "Nenhum sinistro cadastrado"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiário</TableHead>
                    {isAdminVizio && <TableHead>Empresa</TableHead>}
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data Ocorrência</TableHead>
                    <TableHead>Valor Indenização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSinistros.map((sinistro) => {
                    const statusConf = statusConfig[sinistro.status] || { label: sinistro.status, color: "bg-muted" };
                    const tipoConf = tipoSinistroConfig[sinistro.tipo_sinistro] || { label: sinistro.tipo_sinistro, color: "#94a3b8" };
                    
                    return (
                      <TableRow key={sinistro.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sinistro.beneficiario_nome}</p>
                            {sinistro.beneficiario_cpf && (
                              <p className="text-sm text-muted-foreground">{sinistro.beneficiario_cpf}</p>
                            )}
                          </div>
                        </TableCell>
                        {isAdminVizio && (
                          <TableCell>{sinistro.empresas?.nome || '-'}</TableCell>
                        )}
                        <TableCell>
                          <Badge variant="outline" style={{ borderColor: tipoConf.color, color: tipoConf.color }}>
                            {tipoConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(sinistro.data_ocorrencia).toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {sinistro.valor_indenizacao
                            ? sinistro.valor_indenizacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConf.color}>
                            {statusConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-2"
                            onClick={() => {
                              setSelectedSinistro(sinistro);
                              setIsDetailOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4" />
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal with Documents */}
        <SinistroDetailModal
          sinistro={selectedSinistro}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          canEdit={isAdminVizio}
        />
      </div>
    </AppLayout>
  );
}
