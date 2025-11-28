import { AppLayout } from "@/components/Layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Filter, Users, UserCheck, UserX, TrendingUp, DollarSign } from "lucide-react";
import { LineChart, Line, PieChart, Pie, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

// Mock data for charts
const evolucaoData = [
  { mes: "Jun", total: 820 },
  { mes: "Jul", total: 845 },
  { mes: "Ago", total: 880 },
  { mes: "Set", total: 920 },
  { mes: "Out", total: 950 },
  { mes: "Nov", total: 1024 },
];

const categoriaData = [
  { name: "Saúde", value: 612, color: "#3b82f6" },
  { name: "Vida", value: 248, color: "#8b5cf6" },
  { name: "Odonto", value: 164, color: "#06b6d4" },
];

const localData = [
  { local: "São Paulo", total: 324 },
  { local: "Rio de Janeiro", total: 218 },
  { local: "Belo Horizonte", total: 156 },
  { local: "Brasília", total: 142 },
  { local: "Curitiba", total: 108 },
];

const custosData = [
  { mes: "Jun", custo: 125000 },
  { mes: "Jul", custo: 132000 },
  { mes: "Ago", custo: 138000 },
  { mes: "Set", custo: 145000 },
  { mes: "Out", custo: 152000 },
  { mes: "Nov", custo: 163000 },
];

const faixaEtariaData = [
  { faixa: "18-25", total: 186 },
  { faixa: "26-35", total: 324 },
  { faixa: "36-45", total: 268 },
  { faixa: "46-55", total: 162 },
  { faixa: "56+", total: 84 },
];

export default function Beneficiarios() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Beneficiários</h1>
            <p className="text-muted-foreground mt-1">
              Gestão de beneficiários por categoria
            </p>
          </div>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar Beneficiário
          </Button>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
            <TabsTrigger value="saude">Saúde</TabsTrigger>
            <TabsTrigger value="vida">Vida</TabsTrigger>
            <TabsTrigger value="odonto">Odonto</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Beneficiários</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1.024</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+74</span> novos este mês
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                  <UserCheck className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">956</div>
                  <p className="text-xs text-muted-foreground">93.4% do total</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Inativos</CardTitle>
                  <UserX className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">68</div>
                  <p className="text-xs text-muted-foreground">6.6% do total</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Titulares</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">428</div>
                  <p className="text-xs text-muted-foreground">41.8% do total</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Custo Mensal</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ 163k</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+7.2%</span> vs mês anterior
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Evolução de Beneficiários */}
              <Card>
                <CardHeader>
                  <CardTitle>Evolução de Beneficiários</CardTitle>
                  <CardDescription>Últimos 6 meses</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={evolucaoData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Distribuição por Categoria */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Categoria</CardTitle>
                  <CardDescription>Total de beneficiários por tipo</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoriaData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoriaData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Beneficiários por Local */}
              <Card>
                <CardHeader>
                  <CardTitle>Beneficiários por Local</CardTitle>
                  <CardDescription>Top 5 cidades</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={localData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="local" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Evolução de Custos */}
              <Card>
                <CardHeader>
                  <CardTitle>Evolução de Custos</CardTitle>
                  <CardDescription>Custos mensais em R$</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={custosData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="custo" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Distribuição por Faixa Etária */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Distribuição por Faixa Etária</CardTitle>
                  <CardDescription>Quantidade de beneficiários por idade</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={faixaEtariaData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="faixa" type="category" />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="saude" className="space-y-4 mt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar beneficiários de saúde..."
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>João Silva</CardTitle>
                      <CardDescription>CPF: 123.456.789-00</CardDescription>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tipo</p>
                      <p className="font-medium">Titular</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Local</p>
                      <p className="font-medium">São Paulo - SP</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plano</p>
                      <p className="font-medium">Premium</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data de Adesão</p>
                      <p className="font-medium">01/01/2024</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Maria Santos</CardTitle>
                      <CardDescription>CPF: 987.654.321-00</CardDescription>
                    </div>
                    <Badge variant="secondary">Inativo</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tipo</p>
                      <p className="font-medium">Dependente</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Local</p>
                      <p className="font-medium">Rio de Janeiro - RJ</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plano</p>
                      <p className="font-medium">Básico</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data de Adesão</p>
                      <p className="font-medium">15/03/2024</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vida" className="space-y-4 mt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar beneficiários de vida..."
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Carlos Oliveira</CardTitle>
                      <CardDescription>CPF: 456.789.123-00</CardDescription>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tipo</p>
                      <p className="font-medium">Titular</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Local</p>
                      <p className="font-medium">Belo Horizonte - MG</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cobertura</p>
                      <p className="font-medium">R$ 100.000,00</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data de Adesão</p>
                      <p className="font-medium">10/02/2024</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="odonto" className="space-y-4 mt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar beneficiários de odonto..."
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Ana Costa</CardTitle>
                      <CardDescription>CPF: 321.654.987-00</CardDescription>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tipo</p>
                      <p className="font-medium">Titular</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Local</p>
                      <p className="font-medium">Curitiba - PR</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plano</p>
                      <p className="font-medium">Completo</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data de Adesão</p>
                      <p className="font-medium">20/01/2024</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}