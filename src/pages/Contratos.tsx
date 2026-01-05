import { useState } from "react";
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
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileSignature,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Building2,
  Search,
  Files,
  Heart,
  Shield,
  Stethoscope,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContratoFormModal } from "@/components/Contratos/ContratoFormModal";
import { ContratoDetailModal } from "@/components/Contratos/ContratoDetailModal";

type TipoDocumento = 'contrato' | 'aditivo' | 'renovacao';
type StatusContrato = 'ativo' | 'vencido' | 'em_renovacao' | 'suspenso' | 'cancelado';
type Produto = 'saude' | 'odonto' | 'vida';

interface Contrato {
  id: string;
  empresa_id: string;
  titulo: string;
  tipo: TipoDocumento;
  produto: Produto | null;
  numero_contrato: string | null;
  operadora: string | null;
  status: StatusContrato;
  data_inicio: string;
  data_fim: string;
  valor_mensal: number | null;
  arquivo_url: string;
  arquivo_nome: string;
  versao: number;
  contrato_pai_id: string | null;
  filial_id: string | null;
  observacoes: string | null;
  assinado: boolean;
  data_assinatura: string | null;
  competencia_referencia: string | null;
  reajuste_percentual: number | null;
  created_at: string;
  empresas?: { nome: string };
  faturamento_entidades?: { nome: string } | null;
  _documentos_count?: number;
}

const statusConfig = {
  ativo: { label: "Ativo", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: XCircle },
  em_renovacao: { label: "Em Renovação", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  suspenso: { label: "Suspenso", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", icon: XCircle },
};

const tipoConfig = {
  contrato: { label: "Contrato", icon: FileText },
  aditivo: { label: "Aditivo", icon: FileSignature },
  renovacao: { label: "Reajuste", icon: FileSignature },
};

const produtoConfig = {
  saude: { label: "Saúde", icon: Heart, color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300" },
  odonto: { label: "Odonto", icon: Stethoscope, color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300" },
  vida: { label: "Vida em Grupo", icon: Shield, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
};

export default function Contratos() {
  const { user } = useAuth();
  const { empresaSelecionada, isAdminVizio, userRole } = useEmpresa();
  const queryClient = useQueryClient();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [detailContrato, setDetailContrato] = useState<Contrato | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contratoToDelete, setContratoToDelete] = useState<Contrato | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusContrato | 'todos'>('todos');
  const [tipoFilter, setTipoFilter] = useState<TipoDocumento | 'todos'>('todos');
  const [produtoFilter, setProdutoFilter] = useState<Produto | 'todos'>('todos');
  const [filialFilter, setFilialFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const canManage = isAdminVizio || userRole === 'admin_empresa' || userRole === 'rh_gestor';
  const canDelete = isAdminVizio || userRole === 'admin_empresa';

  // Fetch contratos with document count
  const { data: contratos = [], isLoading: loadingContratos } = useQuery({
    queryKey: ["contratos", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("contratos")
        .select(`
          *,
          empresas(nome),
          faturamento_entidades(nome)
        `)
        .order("created_at", { ascending: false });
      
      if (empresaSelecionada) {
        query = query.eq("empresa_id", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get document counts
      const contratoIds = data?.map(c => c.id) || [];
      if (contratoIds.length > 0) {
        const { data: docCounts } = await supabase
          .from("contrato_documentos")
          .select("contrato_id")
          .in("contrato_id", contratoIds);
        
        const countMap = (docCounts || []).reduce((acc, d) => {
          acc[d.contrato_id] = (acc[d.contrato_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return (data || []).map(c => ({
          ...c,
          _documentos_count: countMap[c.id] || 0,
        })) as Contrato[];
      }

      return (data || []) as Contrato[];
    },
  });

  // Fetch filiais for filter
  const { data: filiais = [] } = useQuery({
    queryKey: ["filiais-filter", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("faturamento_entidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      
      if (empresaSelecionada) {
        query = query.eq("empresa_id", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (contrato: Contrato) => {
      // Delete all documents from storage
      const { data: docs } = await supabase
        .from("contrato_documentos")
        .select("storage_path")
        .eq("contrato_id", contrato.id);

      if (docs && docs.length > 0) {
        const paths = docs.map(d => d.storage_path);
        await supabase.storage.from("contratos").remove(paths);
      }

      // Delete legacy file if exists
      if (contrato.arquivo_url) {
        const filePath = contrato.arquivo_url.includes('/contratos/')
          ? contrato.arquivo_url.split('/contratos/')[1]
          : contrato.arquivo_url;
        await supabase.storage.from("contratos").remove([filePath]);
      }

      // Delete the contract (cascade will delete contrato_documentos)
      const { error } = await supabase
        .from("contratos")
        .delete()
        .eq("id", contrato.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      setDeleteDialogOpen(false);
      setContratoToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir contrato");
    },
  });

  // Filter contratos
  const filteredContratos = contratos.filter((c) => {
    if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
    if (tipoFilter !== 'todos' && c.tipo !== tipoFilter) return false;
    if (produtoFilter !== 'todos' && c.produto !== produtoFilter) return false;
    if (filialFilter !== 'todos' && c.filial_id !== filialFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = c.titulo.toLowerCase().includes(q);
      const matchNumero = c.numero_contrato?.toLowerCase().includes(q);
      const matchOperadora = c.operadora?.toLowerCase().includes(q);
      if (!matchTitle && !matchNumero && !matchOperadora) return false;
    }
    return true;
  });

  const handleEdit = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setIsFormOpen(true);
  };

  const handleNewContrato = () => {
    setEditingContrato(null);
    setIsFormOpen(true);
  };

  const handleDownloadLegacy = async (contrato: Contrato) => {
    try {
      const filePath = contrato.arquivo_url.includes('/contratos/')
        ? contrato.arquivo_url.split('/contratos/')[1]
        : contrato.arquivo_url;

      const { data, error } = await supabase.storage
        .from('contratos')
        .download(filePath);

      if (error) throw error;

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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Contratos</h1>
            <p className="text-muted-foreground">
              Contratos, aditivos e reajustes por produto
            </p>
          </div>
          
          {canManage && (
            <Button onClick={handleNewContrato} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Contrato
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>
              
              {/* Search */}
              <div className="flex-1 min-w-[200px] max-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar título, número, operadora..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Produto */}
              <div className="space-y-1">
                <Label className="text-xs">Produto</Label>
                <Select value={produtoFilter} onValueChange={(v) => setProdutoFilter(v as any)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="saude">Saúde</SelectItem>
                    <SelectItem value="odonto">Odonto</SelectItem>
                    <SelectItem value="vida">Vida em Grupo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo */}
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as any)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="aditivo">Aditivo</SelectItem>
                    <SelectItem value="renovacao">Reajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[140px]">
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

              {/* Filial */}
              {filiais.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Filial</Label>
                  <Select value={filialFilter} onValueChange={setFilialFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {filiais.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contratos ({filteredContratos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingContratos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContratos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum contrato encontrado</p>
                {canManage && (
                  <p className="text-sm mt-1">
                    Clique em "Novo Contrato" para começar
                  </p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    {isAdminVizio && !empresaSelecionada && <TableHead>Empresa</TableHead>}
                    <TableHead>Filial</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Docs</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContratos.map((contrato) => {
                    const statusInfo = statusConfig[contrato.status];
                    const tipoInfo = tipoConfig[contrato.tipo];
                    const produtoInfo = contrato.produto ? produtoConfig[contrato.produto] : null;
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={contrato.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{contrato.titulo}</p>
                            {contrato.numero_contrato && (
                              <p className="text-xs text-muted-foreground">
                                {contrato.numero_contrato}
                              </p>
                            )}
                            {contrato.operadora && (
                              <p className="text-xs text-muted-foreground">
                                {contrato.operadora}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        {isAdminVizio && !empresaSelecionada && (
                          <TableCell className="text-muted-foreground">
                            {contrato.empresas?.nome || "—"}
                          </TableCell>
                        )}
                        <TableCell>
                          {contrato.faturamento_entidades?.nome ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3 w-3" />
                              {contrato.faturamento_entidades.nome}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {produtoInfo ? (
                            <Badge className={produtoInfo.color}>
                              {produtoInfo.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tipoInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(new Date(contrato.data_inicio), 'dd/MM/yyyy')}</p>
                            <p className="text-muted-foreground">
                              até {format(new Date(contrato.data_fim), 'dd/MM/yyyy')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Files className="h-4 w-4" />
                            <span>{contrato._documentos_count || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDetailContrato(contrato)}
                              title="Detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {contrato.arquivo_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadLegacy(contrato)}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(contrato)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  {canDelete && (
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
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Form Modal */}
        <ContratoFormModal
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingContrato(null);
          }}
          contrato={editingContrato}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["contratos"] });
            setIsFormOpen(false);
            setEditingContrato(null);
          }}
        />

        {/* Detail Modal */}
        <ContratoDetailModal
          open={!!detailContrato}
          onOpenChange={(open) => !open && setDetailContrato(null)}
          contrato={detailContrato}
          onEdit={() => {
            if (detailContrato && canManage) {
              setEditingContrato(detailContrato);
              setDetailContrato(null);
              setIsFormOpen(true);
            }
          }}
          canManage={canManage}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o contrato "{contratoToDelete?.titulo}"?
                Todos os documentos vinculados também serão removidos.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => contratoToDelete && deleteMutation.mutate(contratoToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
