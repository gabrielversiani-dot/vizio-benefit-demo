import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Json } from "@/integrations/supabase/types";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Rocket,
  Building2,
  User,
  Lock,
  Save,
  Loader2
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
import { FiliaisSection } from "@/components/Configuracoes/FiliaisSection";

interface UserProfile {
  nome_completo: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
}

interface EmpresaData {
  nome: string;
  cnpj: string;
  razao_social: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
}

interface Filial {
  id: string;
  nome: string;
  tipo: string;
  cnpj: string | null;
}

interface UserPreferences {
  notif_fatura_proxima_vencimento: boolean;
  notif_fatura_em_atraso: boolean;
  notif_sinistralidade_importado: boolean;
}

export default function Configuracoes() {
  const { signOut, user } = useAuth();
  const { isAdmin, isAdminVizio, userRole } = usePermissions();
  const { empresaSelecionada: empresaId } = useEmpresa();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Empresa state
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);
  
  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences>({
    notif_fatura_proxima_vencimento: true,
    notif_fatura_em_atraso: true,
    notif_sinistralidade_importado: true,
  });
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('nome_completo, email, telefone, cargo')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoadingProfile(false);
        setLoadingRole(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  // Fetch empresa data for clients
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!empresaId) return;
      
      try {
        const [empresaRes, filiaisRes] = await Promise.all([
          supabase.from('empresas').select('nome, cnpj, razao_social, contato_email, contato_telefone').eq('id', empresaId).single(),
          supabase.from('faturamento_entidades').select('id, nome, tipo, cnpj').eq('empresa_id', empresaId).eq('ativo', true)
        ]);
        
        if (empresaRes.data) setEmpresa(empresaRes.data);
        if (filiaisRes.data) setFiliais(filiaisRes.data);
      } catch (error) {
        console.error('Error fetching empresa:', error);
      } finally {
        setLoadingEmpresa(false);
      }
    };

    fetchEmpresa();
  }, [empresaId]);

  // Fetch user preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user?.id) return;
      
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('preferences')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data?.preferences) {
          const prefs = data.preferences as Record<string, unknown>;
          setPreferences({
            notif_fatura_proxima_vencimento: prefs.notif_fatura_proxima_vencimento as boolean ?? true,
            notif_fatura_em_atraso: prefs.notif_fatura_em_atraso as boolean ?? true,
            notif_sinistralidade_importado: prefs.notif_sinistralidade_importado as boolean ?? true,
          });
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
      }
    };

    fetchPreferences();
  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
  };

  const handleSaveProfile = async () => {
    if (!user?.id || !profile) return;
    
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome_completo: profile.nome_completo,
          telefone: profile.telefone,
          cargo: profile.cargo,
        })
        .eq('id', user.id);
      
      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user?.id || !empresaId) return;
    
    setSavingPreferences(true);
    try {
      // Check if exists first
      const { data: existing } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const prefsJson: Json = {
        notif_fatura_proxima_vencimento: preferences.notif_fatura_proxima_vencimento,
        notif_fatura_em_atraso: preferences.notif_fatura_em_atraso,
        notif_sinistralidade_importado: preferences.notif_sinistralidade_importado,
      };
      
      if (existing) {
        // Update
        const { error } = await supabase
          .from('user_preferences')
          .update({ preferences: prefsJson })
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('user_preferences')
          .insert([{
            user_id: user.id,
            empresa_id: empresaId,
            preferences: prefsJson,
          }]);
        if (error) throw error;
      }
      toast.success('Preferências salvas com sucesso!');
    } catch (error: any) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSavingPreferences(false);
    }
  };

  const clearAllData = async () => {
    try {
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

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'admin_vizio': return 'Administrador Vizio';
      case 'admin_empresa': return 'Administrador da Empresa';
      case 'rh_gestor': return 'Gestor de RH';
      case 'visualizador': return 'Visualizador';
      default: return 'Sem função atribuída';
    }
  };

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

  // CLIENT VIEW - Simplified settings with tabs
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Configurações</h1>
              <p className="mt-2 text-muted-foreground">
                Gerencie seu perfil e preferências
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>

          <Tabs defaultValue="perfil" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="perfil" className="gap-2">
                <User className="h-4 w-4" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="empresa" className="gap-2">
                <Building2 className="h-4 w-4" />
                Empresa
              </TabsTrigger>
              <TabsTrigger value="notificacoes" className="gap-2">
                <Bell className="h-4 w-4" />
                Notificações
              </TabsTrigger>
              <TabsTrigger value="seguranca" className="gap-2">
                <Lock className="h-4 w-4" />
                Segurança
              </TabsTrigger>
            </TabsList>

            {/* Tab: Perfil */}
            <TabsContent value="perfil">
              <Card>
                <CardHeader>
                  <CardTitle>Meu Perfil</CardTitle>
                  <CardDescription>Atualize suas informações pessoais</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingProfile ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Nome completo</Label>
                          <Input 
                            value={profile?.nome_completo || ''} 
                            onChange={(e) => setProfile(p => p ? {...p, nome_completo: e.target.value} : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input value={profile?.email || ''} disabled className="bg-muted" />
                          <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Telefone</Label>
                          <Input 
                            value={profile?.telefone || ''} 
                            onChange={(e) => setProfile(p => p ? {...p, telefone: e.target.value} : null)}
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo</Label>
                          <Input 
                            value={profile?.cargo || ''} 
                            onChange={(e) => setProfile(p => p ? {...p, cargo: e.target.value} : null)}
                            placeholder="Ex: Analista de RH"
                          />
                        </div>
                      </div>
                      <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                        {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar alterações
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Empresa */}
            <TabsContent value="empresa">
              <Card>
                <CardHeader>
                  <CardTitle>Dados da Empresa</CardTitle>
                  <CardDescription>Informações da sua empresa (somente leitura)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loadingEmpresa ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : empresa ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input value={empresa.nome} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                          <Label>CNPJ</Label>
                          <Input value={empresa.cnpj} disabled className="bg-muted" />
                        </div>
                        {empresa.razao_social && (
                          <div className="space-y-2 md:col-span-2">
                            <Label>Razão Social</Label>
                            <Input value={empresa.razao_social} disabled className="bg-muted" />
                          </div>
                        )}
                        {empresa.contato_email && (
                          <div className="space-y-2">
                            <Label>Email de Contato</Label>
                            <Input value={empresa.contato_email} disabled className="bg-muted" />
                          </div>
                        )}
                        {empresa.contato_telefone && (
                          <div className="space-y-2">
                            <Label>Telefone de Contato</Label>
                            <Input value={empresa.contato_telefone} disabled className="bg-muted" />
                          </div>
                        )}
                      </div>

                      {filiais.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-medium mb-3">Filiais e Entidades</h4>
                            <div className="space-y-2">
                              {filiais.map(f => (
                                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                                  <div>
                                    <p className="font-medium">{f.nome}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {f.tipo === 'coligada' ? 'Coligada' : 'Subestipulante'}
                                      {f.cnpj && ` • ${f.cnpj}`}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-sm text-muted-foreground">
                          <strong>Produtos contratados:</strong> Saúde, Vida, Odonto
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          <strong>Operadoras:</strong> Unimed BH
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Nenhuma empresa vinculada</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Notificações */}
            <TabsContent value="notificacoes">
              <Card>
                <CardHeader>
                  <CardTitle>Preferências de Notificação</CardTitle>
                  <CardDescription>Escolha quais alertas deseja receber</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Fatura próxima do vencimento</p>
                      <p className="text-sm text-muted-foreground">
                        Receber aviso 7 dias antes do vencimento
                      </p>
                    </div>
                    <Switch 
                      checked={preferences.notif_fatura_proxima_vencimento}
                      onCheckedChange={(v) => setPreferences(p => ({...p, notif_fatura_proxima_vencimento: v}))}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Fatura em atraso</p>
                      <p className="text-sm text-muted-foreground">
                        Receber aviso quando fatura estiver em atraso
                      </p>
                    </div>
                    <Switch 
                      checked={preferences.notif_fatura_em_atraso}
                      onCheckedChange={(v) => setPreferences(p => ({...p, notif_fatura_em_atraso: v}))}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Relatório de sinistralidade importado</p>
                      <p className="text-sm text-muted-foreground">
                        Receber aviso quando novos dados de sinistralidade forem disponibilizados
                      </p>
                    </div>
                    <Switch 
                      checked={preferences.notif_sinistralidade_importado}
                      onCheckedChange={(v) => setPreferences(p => ({...p, notif_sinistralidade_importado: v}))}
                    />
                  </div>
                  <Button onClick={handleSavePreferences} disabled={savingPreferences} className="gap-2 mt-4">
                    {savingPreferences ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar preferências
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Segurança */}
            <TabsContent value="seguranca">
              <Card>
                <CardHeader>
                  <CardTitle>Acesso e Segurança</CardTitle>
                  <CardDescription>Gerencie seu acesso à plataforma</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Sua função atual</p>
                        <Badge variant="secondary" className="mt-1">
                          {getRoleLabel(userRole)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full gap-2" onClick={() => {
                      // Trigger password reset flow
                      if (user?.email) {
                        supabase.auth.resetPasswordForEmail(user.email).then(() => {
                          toast.success('Email de redefinição de senha enviado!');
                        });
                      }
                    }}>
                      <Lock className="h-4 w-4" />
                      Alterar senha
                    </Button>
                    
                    <Button variant="outline" onClick={handleLogout} className="w-full gap-2 text-destructive hover:text-destructive">
                      <LogOut className="h-4 w-4" />
                      Encerrar sessão
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    );
  }

  // ADMIN VIEW - Full settings
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
                    ) : userRole ? (
                      <Badge 
                        variant={userRole === 'admin_vizio' ? 'default' : 'secondary'}
                        className="mt-1"
                      >
                        Role: {userRole}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="mt-1">
                        Sem role atribuída
                      </Badge>
                    )}
                  </div>
                  {userRole && (
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
        </div>

        {/* Filiais Section - full width */}
        <FiliaisSection />

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
