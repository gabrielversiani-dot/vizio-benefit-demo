import { useState, useEffect } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Upload,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileSignature,
  Calendar,
  DollarSign,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TipoDocumento = 'contrato' | 'aditivo' | 'renovacao';
type StatusContrato = 'ativo' | 'vencido' | 'em_renovacao' | 'suspenso' | 'cancelado';

interface Contrato {
  id: string;
  empresa_id: string;
  titulo: string;
  tipo: TipoDocumento;
  numero_contrato: string | null;
  status: StatusContrato;
  data_inicio: string;
  data_fim: string;
  valor_mensal: number | null;
  arquivo_url: string;
  arquivo_nome: string;
  versao: number;
  contrato_pai_id: string | null;
  observacoes: string | null;
  assinado: boolean;
  data_assinatura: string | null;
  created_at: string;
  empresas?: { nome: string };
}

const statusConfig = {
  ativo: { label: "Ativo", color: "bg-success text-success-foreground", icon: CheckCircle2 },
  vencido: { label: "Vencido", color: "bg-destructive text-destructive-foreground", icon: XCircle },
  em_renovacao: { label: "Em Renovação", color: "bg-warning text-warning-foreground", icon: Clock },
  suspenso: { label: "Suspenso", color: "bg-chart-3 text-chart-3-foreground", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground", icon: XCircle },
};

const tipoConfig = {
  contrato: { label: "Contrato", icon: FileText },
  aditivo: { label: "Aditivo", icon: FileSignature },
  renovacao: { label: "Renovação", icon: FileSignature },
};

export default function Contratos() {
  const { user } = useAuth();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdminVizio, setIsAdminVizio] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusContrato | 'todos'>('todos');
  const [tipoFilter, setTipoFilter] = useState<TipoDocumento | 'todos'>('todos');
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contratoToDelete, setContratoToDelete] = useState<Contrato | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    empresa_id: "",
    titulo: "",
    tipo: "contrato" as TipoDocumento,
    numero_contrato: "",
    status: "ativo" as StatusContrato,
    data_inicio: "",
    data_fim: "",
    valor_mensal: "",
    observacoes: "",
    assinado: false,
    data_assinatura: "",
  });
  const [arquivo, setArquivo] = useState<File | null>(null);

  useEffect(() => {
    checkAdminRole();
    fetchEmpresas();
    fetchContratos();
  }, []);

  const checkAdminRole = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin_vizio')
      .single();
    
    setIsAdminVizio(!!data);
  };

  const fetchEmpresas = async () => {
    const { data } = await supabase
      .from('empresas')
      .select('id, nome, cnpj')
      .eq('ativo', true)
      .order('nome');
    
    if (data) setEmpresas(data);
  };

  const fetchContratos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('contratos')
        .select('*, empresas(nome)')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setContratos(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar contratos:', error);
      toast.error('Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamanho (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 50MB');
        return;
      }
      // Validar tipo
      const allowedTypes = ['.pdf', '.doc', '.docx'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        toast.error('Tipo de arquivo não permitido. Use PDF ou DOC');
        return;
      }
      setArquivo(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Se editando, arquivo é opcional; se criando, é obrigatório
    if (!editingContrato && !arquivo) {
      toast.error('Selecione um arquivo');
      return;
    }

    setUploading(true);
    try {
      let fileUrl = editingContrato?.arquivo_url || '';
      let fileName = editingContrato?.arquivo_nome || '';

      // Se houver novo arquivo, fazer upload
      if (arquivo) {
        const empresaId = formData.empresa_id;
        const timestamp = Date.now();
        const newFilePath = `${empresaId}/${timestamp}_${arquivo.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('contratos')
          .upload(newFilePath, arquivo);

        if (uploadError) throw uploadError;

        // Se editando, deletar arquivo antigo
        if (editingContrato) {
          const oldPath = editingContrato.arquivo_url.includes('/contratos/')
            ? editingContrato.arquivo_url.split('/contratos/')[1]
            : editingContrato.arquivo_url;
          await supabase.storage.from('contratos').remove([oldPath]);
        }

        fileUrl = newFilePath;
        fileName = arquivo.name;
      }

      const payload = {
        ...formData,
        arquivo_url: fileUrl,
        arquivo_nome: fileName,
        valor_mensal: formData.valor_mensal ? parseFloat(formData.valor_mensal) : null,
      };

      if (editingContrato) {
        // Atualizar
        const { error: updateError } = await supabase
          .from('contratos')
          .update(payload)
          .eq('id', editingContrato.id);

        if (updateError) throw updateError;
        toast.success('Contrato atualizado com sucesso!');
      } else {
        // Inserir
        const { error: insertError } = await supabase
          .from('contratos')
          .insert({
            ...payload,
            criado_por: user.id,
          });

        if (insertError) throw insertError;
        toast.success('Contrato cadastrado com sucesso!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchContratos();
    } catch (error: any) {
      console.error('Erro ao salvar contrato:', error);
      toast.error('Erro ao salvar contrato');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      empresa_id: "",
      titulo: "",
      tipo: "contrato",
      numero_contrato: "",
      status: "ativo",
      data_inicio: "",
      data_fim: "",
      valor_mensal: "",
      observacoes: "",
      assinado: false,
      data_assinatura: "",
    });
    setArquivo(null);
    setEditingContrato(null);
  };

  const handleEdit = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setFormData({
      empresa_id: contrato.empresa_id,
      titulo: contrato.titulo,
      tipo: contrato.tipo,
      numero_contrato: contrato.numero_contrato || "",
      status: contrato.status,
      data_inicio: contrato.data_inicio,
      data_fim: contrato.data_fim,
      valor_mensal: contrato.valor_mensal?.toString() || "",
      observacoes: contrato.observacoes || "",
      assinado: contrato.assinado,
      data_assinatura: contrato.data_assinatura || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!contratoToDelete) return;

    try {
      // Deletar arquivo do storage
      const filePath = contratoToDelete.arquivo_url.includes('/contratos/')
        ? contratoToDelete.arquivo_url.split('/contratos/')[1]
        : contratoToDelete.arquivo_url;

      await supabase.storage.from('contratos').remove([filePath]);

      // Deletar registro do banco
      const { error } = await supabase
        .from('contratos')
        .delete()
        .eq('id', contratoToDelete.id);

      if (error) throw error;

      toast.success('Contrato excluído com sucesso!');
      fetchContratos();
    } catch (error: any) {
      console.error('Erro ao excluir contrato:', error);
      toast.error('Erro ao excluir contrato');
    } finally {
      setDeleteDialogOpen(false);
      setContratoToDelete(null);
    }
  };

  const handlePreview = async (contrato: Contrato) => {
    try {
      const filePath = contrato.arquivo_url.includes('/contratos/')
        ? contrato.arquivo_url.split('/contratos/')[1]
        : contrato.arquivo_url;

      const { data, error } = await supabase.storage
        .from('contratos')
        .createSignedUrl(filePath, 3600); // URL válida por 1 hora

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('Erro ao abrir preview:', error);
      toast.error('Erro ao abrir arquivo');
    }
  };

  const handleDownload = async (contrato: Contrato) => {
    try {
      // Extrair o caminho do arquivo (pode ser path direto ou URL antiga)
      const filePath = contrato.arquivo_url.includes('/contratos/')
        ? contrato.arquivo_url.split('/contratos/')[1]
        : contrato.arquivo_url;

      const { data, error } = await supabase.storage
        .from('contratos')
        .download(filePath);

      if (error) throw error;

      // Criar URL e fazer download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = contrato.arquivo_nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Download iniciado');
    } catch (error: any) {
      console.error('Erro ao baixar arquivo:', error);
      toast.error('Erro ao baixar arquivo');
    }
  };

  const filteredContratos = contratos.filter((c) => {
    if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
    if (tipoFilter !== 'todos' && c.tipo !== tipoFilter) return false;
    return true;
  });

  // Agrupar por ano e mês
  const groupedContratos = filteredContratos.reduce((acc, contrato) => {
    const date = new Date(contrato.created_at);
    const key = format(date, 'yyyy-MM');
    if (!acc[key]) acc[key] = [];
    acc[key].push(contrato);
    return acc;
  }, {} as Record<string, Contrato[]>);

  const sortedGroups = Object.keys(groupedContratos).sort().reverse();

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Gestão de Contratos</h1>
            <p className="mt-2 text-muted-foreground">
              Contratos, aditivos e renovações organizados cronologicamente
            </p>
          </div>
          
          {isAdminVizio && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                  <Plus className="h-4 w-4" />
                  Novo Contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingContrato ? 'Editar Contrato' : 'Cadastrar Novo Contrato'}</DialogTitle>
                  <DialogDescription>
                    {editingContrato ? 'Atualize os dados do contrato' : 'Faça upload de contratos, aditivos ou renovações'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="empresa">Empresa *</Label>
                      <Select
                        value={formData.empresa_id}
                        onValueChange={(value) => setFormData({ ...formData, empresa_id: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {empresas.map((empresa) => (
                            <SelectItem key={empresa.id} value={empresa.id}>
                              {empresa.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo *</Label>
                      <Select
                        value={formData.tipo}
                        onValueChange={(value: TipoDocumento) => setFormData({ ...formData, tipo: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contrato">Contrato</SelectItem>
                          <SelectItem value="aditivo">Aditivo</SelectItem>
                          <SelectItem value="renovacao">Renovação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="titulo">Título *</Label>
                    <Input
                      id="titulo"
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      placeholder="Ex: Contrato de Prestação de Serviços"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numero">Número do Contrato</Label>
                      <Input
                        id="numero"
                        value={formData.numero_contrato}
                        onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
                        placeholder="Ex: CT-2024-001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Status *</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value: StatusContrato) => setFormData({ ...formData, status: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="vencido">Vencido</SelectItem>
                          <SelectItem value="em_renovacao">Em Renovação</SelectItem>
                          <SelectItem value="suspenso">Suspenso</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="data_inicio">Data Início *</Label>
                      <Input
                        id="data_inicio"
                        type="date"
                        value={formData.data_inicio}
                        onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="data_fim">Data Fim *</Label>
                      <Input
                        id="data_fim"
                        type="date"
                        value={formData.data_fim}
                        onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="valor">Valor Mensal</Label>
                      <Input
                        id="valor"
                        type="number"
                        step="0.01"
                        value={formData.valor_mensal}
                        onChange={(e) => setFormData({ ...formData, valor_mensal: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="arquivo">
                      Arquivo {editingContrato ? '(deixe vazio para manter o atual)' : '*'} (PDF, DOC, DOCX - Max 50MB)
                    </Label>
                    <Input
                      id="arquivo"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      required={!editingContrato}
                    />
                    {arquivo && (
                      <p className="text-sm text-muted-foreground">
                        Novo arquivo: {arquivo.name}
                      </p>
                    )}
                    {editingContrato && !arquivo && (
                      <p className="text-sm text-muted-foreground">
                        Arquivo atual: {editingContrato.arquivo_nome}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      placeholder="Informações adicionais..."
                      rows={3}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      disabled={uploading}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={uploading || (!editingContrato && !arquivo)}>
                      {uploading ? (
                        <>
                          <Upload className="h-4 w-4 mr-2 animate-spin" />
                          {editingContrato ? 'Atualizando...' : 'Enviando...'}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {editingContrato ? 'Atualizar' : 'Cadastrar'}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value: any) => setStatusFilter(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                      <SelectItem value="em_renovacao">Em Renovação</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={tipoFilter}
                    onValueChange={(value: any) => setTipoFilter(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="contrato">Contrato</SelectItem>
                      <SelectItem value="aditivo">Aditivo</SelectItem>
                      <SelectItem value="renovacao">Renovação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {loading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredContratos.length === 0 ? (
          <Card>
            <CardContent className="h-[400px] flex flex-col items-center justify-center text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Nenhum contrato cadastrado
              </p>
              {isAdminVizio && (
                <p className="text-sm text-muted-foreground mt-2">
                  Clique no botão "Novo Contrato" para começar
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {sortedGroups.map((key) => {
              const [year, month] = key.split('-');
              const date = new Date(parseInt(year), parseInt(month) - 1);
              const monthName = format(date, 'MMMM yyyy', { locale: ptBR });

              return (
                <div key={key}>
                  <h2 className="text-2xl font-bold mb-4 capitalize">{monthName}</h2>
                  <div className="space-y-4">
                    {groupedContratos[key].map((contrato) => {
                      const statusInfo = statusConfig[contrato.status];
                      const tipoInfo = tipoConfig[contrato.tipo];
                      const StatusIcon = statusInfo.icon;
                      const TipoIcon = tipoInfo.icon;

                      return (
                        <Card key={contrato.id} className="hover:shadow-lg transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <TipoIcon className="h-6 w-6 text-primary" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="text-lg font-semibold">{contrato.titulo}</h3>
                                      <Badge variant="secondary" className="text-xs">
                                        {tipoInfo.label}
                                      </Badge>
                                      {contrato.assinado && (
                                        <Badge className="bg-success text-success-foreground text-xs">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Assinado
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {contrato.empresas?.nome}
                                      {contrato.numero_contrato && ` • ${contrato.numero_contrato}`}
                                      {contrato.versao > 1 && ` • Versão ${contrato.versao}`}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mt-4">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-muted-foreground">Vigência</p>
                                      <p className="font-medium">
                                        {format(new Date(contrato.data_inicio), 'dd/MM/yyyy')} - {format(new Date(contrato.data_fim), 'dd/MM/yyyy')}
                                      </p>
                                    </div>
                                  </div>

                                  {contrato.valor_mensal && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="text-muted-foreground">Valor Mensal</p>
                                        <p className="font-medium">
                                          R$ {contrato.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 text-sm">
                                    <Badge className={statusInfo.color}>
                                      <StatusIcon className="h-3 w-3 mr-1" />
                                      {statusInfo.label}
                                    </Badge>
                                  </div>
                                </div>

                                {contrato.observacoes && (
                                  <p className="mt-3 text-sm text-muted-foreground">
                                    {contrato.observacoes}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 ml-4">
                                <Button
                                  onClick={() => handlePreview(contrato)}
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  Visualizar
                                </Button>
                                <Button
                                  onClick={() => handleDownload(contrato)}
                                  size="sm"
                                  className="gap-2"
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </Button>
                                {isAdminVizio && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleEdit(contrato)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          setContratoToDelete(contrato);
                                          setDeleteDialogOpen(true);
                                        }}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o contrato "{contratoToDelete?.titulo}"? 
                O arquivo também será removido. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
