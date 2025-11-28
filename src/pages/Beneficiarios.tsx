import { AppLayout } from "@/components/Layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Filter } from "lucide-react";

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

        <Tabs defaultValue="saude" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="saude">Saúde</TabsTrigger>
            <TabsTrigger value="vida">Vida</TabsTrigger>
            <TabsTrigger value="odonto">Odonto</TabsTrigger>
          </TabsList>

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