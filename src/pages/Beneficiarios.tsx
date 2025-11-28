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

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
            <TabsTrigger value="saude">Saúde</TabsTrigger>
            <TabsTrigger value="vida">Vida</TabsTrigger>
            <TabsTrigger value="odonto">Odonto</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Conteúdo em desenvolvimento</p>
              </CardContent>
            </Card>
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