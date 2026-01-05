import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Upload, 
  Settings, 
  Bell, 
  Users, 
  Shield,
  Plus,
  Trash2,
  LogOut,
  AlertTriangle,
  Rocket
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SetupWizard } from "@/components/Setup/SetupWizard";

export default function Configuracoes() {
  const { signOut, user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Fetch current user's role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) return;
      
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        setCurrentUserRole(roleData?.role || null);
      } catch (error) {
        console.error('Error fetching role:', error);
      } finally {
        setLoadingRole(false);
      }
    };

    fetchUserRole();
  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
  };

  const clearAllData = async () => {
    try {
      // Deletar na ordem correta devido às foreign keys
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .neq('user_id', user?.id);

      if (rolesError) throw rolesError;

      const { error: profilesError } = await supabase
        .from('profiles')
        .delete()
        .neq('id', user?.id);

      if (profilesError) throw profilesError;

      const { error: empresasError } = await supabase
        .from('empresas')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (empresasError) throw empresasError;

      toast.success('Todos os dados foram apagados com sucesso!');
      setShowDeleteConfirm(false);
    } catch (error: any) {
      console.error('Erro ao apagar dados:', error);
      toast.error(`Erro: ${error.message || 'Não foi possível apagar os dados'}`);
    }
  };

  const isAdminVizio = currentUserRole === 'admin_vizio';

  // If showing setup wizard, render only that
  if (showSetupWizard && isAdminVizio) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Setup Inicial</h1>
              <p className="mt-2 text-muted-foreground">
                Configure empresas, usuários e permissões do sistema
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowSetupWizard(false)}>
              Voltar às Configurações
            </Button>
          </div>
          <SetupWizard />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Configurações</h1>
            <p className="mt-2 text-muted-foreground">
              Gerencie as preferências e configurações da plataforma
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>

        {/* Setup Inicial - Destaque para admin_vizio */}
        {isAdminVizio && (
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Setup Inicial do Sistema</CardTitle>
                  <CardDescription>
                    Configure empresas, usuários e permissões passo a passo com formulários interativos
                  </CardDescription>
                </div>
                <Button onClick={() => setShowSetupWizard(true)} className="gap-2">
                  <Rocket className="h-4 w-4" />
                  Iniciar Setup
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-background border text-center">
                  <div className="text-2xl font-bold text-primary">1</div>
                  <p className="text-xs text-muted-foreground">Empresas</p>
                </div>
                <div className="p-3 rounded-lg bg-background border text-center">
                  <div className="text-2xl font-bold text-primary">2</div>
                  <p className="text-xs text-muted-foreground">Usuários</p>
                </div>
                <div className="p-3 rounded-lg bg-background border text-center">
                  <div className="text-2xl font-bold text-primary">3</div>
                  <p className="text-xs text-muted-foreground">Perfis</p>
                </div>
                <div className="p-3 rounded-lg bg-background border text-center">
                  <div className="text-2xl font-bold text-primary">4</div>
                  <p className="text-xs text-muted-foreground">Funções</p>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Usuário Admin Atual</p>
                    <p className="text-xs text-muted-foreground">{user?.email || 'Carregando...'}</p>
                    {loadingRole ? (
                      <p className="text-xs text-muted-foreground italic">Verificando role...</p>
                    ) : currentUserRole ? (
                      <Badge 
                        variant={currentUserRole === 'admin_vizio' ? 'default' : 'secondary'}
                        className="mt-1"
                      >
                        Role: {currentUserRole}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="mt-1">
                        Sem role atribuída
                      </Badge>
                    )}
                  </div>
                  {currentUserRole && (
                    <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                      ✓ Admin Configurado
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Outras Configurações */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Notificações */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <CardTitle>Notificações</CardTitle>
                  <CardDescription>Gerencie alertas e avisos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Alertas de sinistralidade</p>
                  <p className="text-sm text-muted-foreground">
                    Receber alertas quando exceder limite
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Faturas próximas ao vencimento</p>
                  <p className="text-sm text-muted-foreground">
                    Notificar 7 dias antes do vencimento
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Novos beneficiários</p>
                  <p className="text-sm text-muted-foreground">
                    Alertar sobre novas inclusões
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* Usuários e Permissões */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <CardTitle>Usuários e Acessos</CardTitle>
                  <CardDescription>Gerencie permissões da equipe</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Adicionar novo usuário</Label>
                <div className="flex gap-2">
                  <Input placeholder="email@viziocapital.com.br" type="email" />
                  <Button>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">admin@viziocapital.com.br</p>
                    <p className="text-muted-foreground">Administrador</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">analista@viziocapital.com.br</p>
                    <p className="text-muted-foreground">Analista</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Configurações de segurança</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Autenticação em dois fatores</p>
                  <p className="text-sm text-muted-foreground">
                    Adicionar camada extra de segurança
                  </p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Expiração de sessão</p>
                  <p className="text-sm text-muted-foreground">
                    Desconectar após 30 minutos
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <Button variant="outline" className="w-full">
                Alterar Senha
              </Button>
            </CardContent>
          </Card>

          {/* Importação/Exportação */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <CardTitle>Importação & Exportação</CardTitle>
                  <CardDescription>Gerencie seus dados</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Importar beneficiários</Label>
                <div className="flex gap-2">
                  <Input type="file" accept=".csv,.xlsx" />
                  <Button>
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: CSV, Excel
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Exportar dados completos</Label>
                <Button variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Baixar backup completo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Zona de Perigo - apenas para admin_vizio */}
          {isAdminVizio && (
            <Card className="border-destructive">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
                    <CardDescription>Ações irreversíveis</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Limpar todos os dados</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Remove todas as empresas, perfis e roles (exceto seu usuário atual). Esta ação não pode ser desfeita.
                  </p>
                  <Button 
                    variant="destructive" 
                    className="w-full gap-2"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Apagar Todos os Dados
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar exclusão de dados
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá apagar permanentemente todas as empresas, perfis e roles do sistema.
              Apenas seu usuário atual será preservado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={clearAllData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
