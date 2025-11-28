import { useState } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download, 
  Upload, 
  Settings, 
  Bell, 
  Users, 
  Shield,
  Plus,
  Trash2,
  Calendar,
  Info,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mockReports = [
  { id: 1, nome: "Relatório Mensal de Sinistralidade", tipo: "PDF", frequencia: "Mensal", ativo: true },
  { id: 2, nome: "Análise de Faturamento Trimestral", tipo: "Excel", frequencia: "Trimestral", ativo: true },
  { id: 3, nome: "Dashboard de Vidas Ativas", tipo: "PDF", frequencia: "Semanal", ativo: false },
];

// Templates de importação
const downloadTemplate = (type: string) => {
  let csvContent = "";
  let filename = "";

  switch (type) {
    case "empresas":
      filename = "template_empresas.csv";
      csvContent = "nome;cnpj;razao_social;contato_email;contato_telefone\n" +
                   "Empresa Exemplo Ltda;12.345.678/0001-90;Empresa Exemplo LTDA;contato@exemplo.com.br;(11) 98765-4321\n" +
                   "Outra Empresa S.A.;98.765.432/0001-10;Outra Empresa Sociedade Anônima;financeiro@outra.com.br;(21) 91234-5678";
      break;
    case "usuarios":
      filename = "template_usuarios.csv";
      csvContent = "email;senha;nome_completo\n" +
                   "joao.silva@exemplo.com.br;SenhaSegura123!;João Silva\n" +
                   "maria.santos@exemplo.com.br;OutraSenha456!;Maria Santos";
      break;
    case "perfis":
      filename = "template_perfis.csv";
      csvContent = "email;empresa_cnpj;cargo;telefone\n" +
                   "joao.silva@exemplo.com.br;12.345.678/0001-90;Gerente de RH;(11) 99887-6655\n" +
                   "maria.santos@exemplo.com.br;98.765.432/0001-10;Analista Financeiro;(21) 98876-5544";
      break;
    case "roles":
      filename = "template_roles.csv";
      csvContent = "email;role\n" +
                   "admin@exemplo.com.br;admin_vizio\n" +
                   "gestor@exemplo.com.br;admin_empresa\n" +
                   "rh@exemplo.com.br;rh_gestor\n" +
                   "usuario@exemplo.com.br;visualizador";
      break;
    default:
      return;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast.success(`Template ${filename} baixado com sucesso!`);
};

const parseCSV = async (file: File): Promise<{ headers: string[], data: Record<string, string>[] } | null> => {
  try {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      toast.error('Arquivo CSV vazio ou inválido');
      return null;
    }

    const headers = lines[0].split(';').map(h => h.trim());
    const data = lines.slice(1).map(line => {
      const values = line.split(';').map(v => v.trim());
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {} as Record<string, string>);
    });

    return { headers, data };
  } catch (error) {
    console.error('Erro ao ler arquivo:', error);
    toast.error('Erro ao ler arquivo CSV');
    return null;
  }
};

const handleImport = async (type: string, data: Record<string, string>[]) => {
  try {
    switch (type) {
      case 'empresas':
        await importEmpresas(data);
        break;
      case 'usuarios':
        await importUsuarios(data);
        break;
      case 'perfis':
        await importPerfis(data);
        break;
      case 'roles':
        await importRoles(data);
        break;
    }

    toast.success(`${data.length} registro(s) importado(s) com sucesso!`);
  } catch (error) {
    console.error('Erro na importação:', error);
    toast.error('Erro ao importar arquivo');
  }
};

const importEmpresas = async (data: Record<string, string>[]) => {
  for (const row of data) {
    const { error } = await supabase
      .from('empresas')
      .upsert({
        nome: row.nome,
        cnpj: row.cnpj,
        razao_social: row.razao_social || null,
        contato_email: row.contato_email || null,
        contato_telefone: row.contato_telefone || null
      }, {
        onConflict: 'cnpj',
        ignoreDuplicates: false
      });
    
    if (error) throw error;
  }
};

const importUsuarios = async (data: Record<string, string>[]) => {
  for (const row of data) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: row.email,
      password: row.senha,
      options: {
        data: {
          nome_completo: row.nome_completo
        }
      }
    });

    if (authError) throw authError;
  }
};

const importPerfis = async (data: Record<string, string>[]) => {
  for (const row of data) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', row.email)
      .maybeSingle();

    if (!profiles) {
      console.warn(`Usuário não encontrado: ${row.email}`);
      continue;
    }

    let empresaId = null;
    if (row.empresa_cnpj) {
      const { data: empresa } = await supabase
        .from('empresas')
        .select('id')
        .eq('cnpj', row.empresa_cnpj)
        .maybeSingle();
      empresaId = empresa?.id;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        telefone: row.telefone || null,
        cargo: row.cargo || null,
        empresa_id: empresaId
      })
      .eq('id', profiles.id);

    if (error) throw error;
  }
};

const importRoles = async (data: Record<string, string>[]) => {
  for (const row of data) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', row.email)
      .maybeSingle();

    if (!profiles) {
      console.warn(`Usuário não encontrado: ${row.email}`);
      continue;
    }

    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: profiles.id,
        role: row.role as any
      });

    if (error && error.code !== '23505') {
      throw error;
    }
  }
};

export default function Configuracoes() {
  const [previewData, setPreviewData] = useState<{
    type: string;
    headers: string[];
    data: Record<string, string>[];
  } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleFileSelect = async (type: string, file: File) => {
    const parsed = await parseCSV(file);
    if (parsed) {
      setPreviewData({ type, ...parsed });
      setIsPreviewOpen(true);
    }
  };

  const confirmImport = async () => {
    if (previewData) {
      await handleImport(previewData.type, previewData.data);
      setIsPreviewOpen(false);
      setPreviewData(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Configurações</h1>
          <p className="mt-2 text-muted-foreground">
            Gerencie as preferências e configurações da plataforma
          </p>
        </div>

        {/* Seção de Importação Inicial - DESTAQUE */}
        <Card className="border-2 border-warning/30 bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-warning/20 flex items-center justify-center">
                <Upload className="h-6 w-6 text-warning" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">Importação Inicial de Dados</CardTitle>
                <CardDescription>
                  Configure o sistema importando dados na ordem correta
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-4">
                {/* Passo 1: Empresas */}
                <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    1
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">Empresas</h3>
                        <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Comece importando as empresas (tabela <code className="text-xs bg-muted px-1 py-0.5 rounded">empresas</code>)
                      </p>
                      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p className="font-medium">Formato do arquivo CSV (separador: ponto e vírgula):</p>
                          <p className="font-mono">nome; cnpj; razao_social; contato_email; contato_telefone</p>
                          <p className="mt-2">Exemplo:</p>
                          <p className="font-mono text-xs">Empresa XYZ Ltda; 12.345.678/0001-90; Empresa XYZ LTDA; contato@xyz.com; (11) 98765-4321</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => downloadTemplate("empresas")}
                      >
                        <Download className="h-4 w-4" />
                        Baixar Template
                      </Button>
                      <Input 
                        id="import-empresas"
                        type="file" 
                        accept=".csv" 
                        className="flex-1"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect('empresas', file);
                          e.target.value = '';
                        }}
                      />
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={() => document.getElementById('import-empresas')?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Importar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Passo 2: Usuários no Auth */}
                <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    2
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">Usuários (Autenticação)</h3>
                        <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Criar usuários através do sistema de autenticação. Os perfis serão criados automaticamente via trigger.
                      </p>
                      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p className="font-medium">Formato do arquivo CSV (separador: ponto e vírgula):</p>
                          <p className="font-mono">email; senha; nome_completo</p>
                          <p className="mt-2">Exemplo:</p>
                          <p className="font-mono text-xs">joao.silva@empresa.com; SenhaSegura123!; João Silva</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => downloadTemplate("usuarios")}
                      >
                        <Download className="h-4 w-4" />
                        Baixar Template
                      </Button>
                      <Input 
                        id="import-usuarios"
                        type="file" 
                        accept=".csv" 
                        className="flex-1"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect('usuarios', file);
                          e.target.value = '';
                        }}
                      />
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={() => document.getElementById('import-usuarios')?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Importar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Passo 3: Perfis */}
                <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    3
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">Perfis (Atualização)</h3>
                        <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Atualizar perfis vinculando usuários às empresas (tabela <code className="text-xs bg-muted px-1 py-0.5 rounded">profiles</code>)
                      </p>
                      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p className="font-medium">Formato do arquivo CSV (separador: ponto e vírgula):</p>
                          <p className="font-mono">email; empresa_cnpj; cargo; telefone</p>
                          <p className="mt-2">Exemplo:</p>
                          <p className="font-mono text-xs">joao.silva@empresa.com; 12.345.678/0001-90; Gerente RH; (11) 99887-6655</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => downloadTemplate("perfis")}
                      >
                        <Download className="h-4 w-4" />
                        Baixar Template
                      </Button>
                      <Input 
                        id="import-perfis"
                        type="file" 
                        accept=".csv" 
                        className="flex-1"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect('perfis', file);
                          e.target.value = '';
                        }}
                      />
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={() => document.getElementById('import-perfis')?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Importar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Passo 4: Roles */}
                <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    4
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">Funções/Roles</h3>
                        <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Atribuir permissões aos usuários (tabela <code className="text-xs bg-muted px-1 py-0.5 rounded">user_roles</code>)
                      </p>
                      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p className="font-medium">Formato do arquivo CSV (separador: ponto e vírgula):</p>
                          <p className="font-mono">email; role</p>
                          <p className="mt-2">Roles disponíveis:</p>
                          <p className="font-mono text-xs">admin_vizio | admin_empresa | rh_gestor | visualizador</p>
                          <p className="mt-2">Exemplo:</p>
                          <p className="font-mono text-xs">admin@vizio.com; admin_vizio</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => downloadTemplate("roles")}
                      >
                        <Download className="h-4 w-4" />
                        Baixar Template
                      </Button>
                      <Input 
                        id="import-roles"
                        type="file" 
                        accept=".csv" 
                        className="flex-1"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect('roles', file);
                          e.target.value = '';
                        }}
                      />
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={() => document.getElementById('import-roles')?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Importar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Usuário Admin Atual</p>
                    <p className="text-xs text-muted-foreground">gabriel.versiani@capitalvizio.com.br</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Atribuir Role Admin
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção de Relatórios */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Relatórios Personalizados</CardTitle>
                  <CardDescription>
                    Configure e gerencie seus relatórios automatizados
                  </CardDescription>
                </div>
              </div>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Relatório
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{report.nome}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Download className="h-3.5 w-3.5" />
                          {report.tipo}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {report.frequencia}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={report.ativo} />
                      <span className="text-sm text-muted-foreground">
                        {report.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              <Separator className="my-6" />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="report-email">E-mail para envio automático</Label>
                  <Input
                    id="report-email"
                    type="email"
                    placeholder="financeiro@viziocapital.com.br"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-format">Formato padrão</Label>
                  <select
                    id="report-format"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel (XLSX)</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline">Cancelar</Button>
                <Button>Salvar Configurações</Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
      </div>

      {/* Modal de Preview */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview dos Dados - {previewData?.type}
            </DialogTitle>
            <DialogDescription>
              Revise os dados antes de importar. Total de {previewData?.data.length} registro(s).
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  {previewData?.headers.map((header) => (
                    <TableHead key={header} className="font-bold">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData?.data.map((row, index) => (
                  <TableRow key={index}>
                    {previewData.headers.map((header) => (
                      <TableCell key={header}>
                        {row[header] || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmImport}>
              Confirmar Importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
