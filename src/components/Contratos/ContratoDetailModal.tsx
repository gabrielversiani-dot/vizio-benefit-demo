import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Download,
  Pencil,
  FileText,
  Building2,
  Calendar,
  Percent,
  Upload,
  Trash2,
  Loader2,
  Eye,
  Heart,
  Shield,
  Stethoscope,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TipoDocumentoArquivo = 'contrato_principal' | 'anexo' | 'aditivo' | 'reajuste' | 'outros';

interface ContratoDoc {
  id: string;
  tipo_documento: TipoDocumentoArquivo;
  arquivo_nome: string;
  mime_type: string;
  tamanho_bytes: number;
  storage_path: string;
  versao: number;
  created_at: string;
}

interface Contrato {
  id: string;
  empresa_id: string;
  titulo: string;
  tipo: string;
  produto: string | null;
  numero_contrato: string | null;
  operadora: string | null;
  status: string;
  data_inicio: string;
  data_fim: string;
  filial_id: string | null;
  observacoes: string | null;
  competencia_referencia: string | null;
  reajuste_percentual: number | null;
  arquivo_url?: string;
  arquivo_nome?: string;
  empresas?: { nome: string };
  faturamento_entidades?: { nome: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: Contrato | null;
  onEdit: () => void;
  canManage: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  ativo: { label: "Ativo", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: XCircle },
  em_renovacao: { label: "Em Renovação", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  suspenso: { label: "Suspenso", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", icon: XCircle },
};

const produtoConfig: Record<string, { label: string; icon: any; color: string }> = {
  saude: { label: "Saúde", icon: Heart, color: "bg-pink-100 text-pink-800" },
  odonto: { label: "Odonto", icon: Stethoscope, color: "bg-cyan-100 text-cyan-800" },
  vida_em_grupo: { label: "Vida em Grupo", icon: Shield, color: "bg-purple-100 text-purple-800" },
};

const tipoDocConfig: Record<string, string> = {
  contrato_principal: "Principal",
  anexo: "Anexo",
  aditivo: "Aditivo",
  reajuste: "Reajuste",
  outros: "Outros",
};

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function ContratoDetailModal({ open, onOpenChange, contrato, onEdit, canManage }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [uploading, setUploading] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  // Fetch documents
  const { data: documentos = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["contrato-documentos", contrato?.id],
    queryFn: async () => {
      if (!contrato?.id) return [];
      const { data, error } = await supabase
        .from("contrato_documentos")
        .select("*")
        .eq("contrato_id", contrato.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ContratoDoc[];
    },
    enabled: !!contrato?.id,
  });

  // Delete document mutation
  const deleteDocMutation = useMutation({
    mutationFn: async (doc: ContratoDoc) => {
      // Delete from storage
      await supabase.storage.from("contratos").remove([doc.storage_path]);
      // Delete record
      const { error } = await supabase
        .from("contrato_documentos")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento excluído!");
      queryClient.invalidateQueries({ queryKey: ["contrato-documentos", contrato?.id] });
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      setDeleteDocId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir documento");
    },
  });

  const handleDownload = async (doc: ContratoDoc) => {
    try {
      const { data, error } = await supabase.storage
        .from("contratos")
        .download(doc.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.arquivo_nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handlePreview = async (doc: ContratoDoc) => {
    try {
      const { data, error } = await supabase.storage
        .from("contratos")
        .createSignedUrl(doc.storage_path, 3600);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      console.error("Preview error:", err);
      toast.error("Erro ao abrir arquivo");
    }
  };

  const handleUploadNew = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contrato || !user) return;

    // Validate
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 10MB");
      return;
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error("Tipo de arquivo não permitido");
      return;
    }

    setUploading(true);
    try {
      // Get max version
      const maxVersion = documentos.reduce((max, d) => Math.max(max, d.versao), 0);
      const newVersion = maxVersion + 1;

      const timestamp = Date.now();
      const storagePath = `${contrato.empresa_id}/contratos/${contrato.id}/v${newVersion}/${timestamp}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("contratos")
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      const { error: docError } = await supabase
        .from("contrato_documentos")
        .insert({
          empresa_id: contrato.empresa_id,
          contrato_id: contrato.id,
          tipo_documento: 'outros',
          arquivo_nome: file.name,
          mime_type: file.type || 'application/octet-stream',
          tamanho_bytes: file.size,
          storage_path: storagePath,
          versao: newVersion,
          uploaded_by: user.id,
        });

      if (docError) throw docError;

      toast.success("Documento adicionado!");
      queryClient.invalidateQueries({ queryKey: ["contrato-documentos", contrato.id] });
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Erro ao enviar documento");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (!contrato) return null;

  const statusInfo = statusConfig[contrato.status] || statusConfig.ativo;
  const produtoInfo = contrato.produto ? produtoConfig[contrato.produto] : null;
  const StatusIcon = statusInfo.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl">{contrato.titulo}</DialogTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  {produtoInfo && (
                    <Badge className={produtoInfo.color}>
                      {produtoInfo.label}
                    </Badge>
                  )}
                  <Badge variant="outline" className="capitalize">
                    {contrato.tipo}
                  </Badge>
                  <Badge className={statusInfo.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
              {canManage && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              )}
            </div>
          </DialogHeader>

          <Separator />

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {contrato.numero_contrato && (
              <div>
                <p className="text-muted-foreground">Número/Apólice</p>
                <p className="font-medium">{contrato.numero_contrato}</p>
              </div>
            )}
            {contrato.operadora && (
              <div>
                <p className="text-muted-foreground">Operadora</p>
                <p className="font-medium">{contrato.operadora}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Vigência</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(contrato.data_inicio), 'dd/MM/yyyy')} — {format(new Date(contrato.data_fim), 'dd/MM/yyyy')}
              </p>
            </div>
            {contrato.faturamento_entidades?.nome && (
              <div>
                <p className="text-muted-foreground">Filial</p>
                <p className="font-medium flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {contrato.faturamento_entidades.nome}
                </p>
              </div>
            )}
            {contrato.reajuste_percentual && (
              <div>
                <p className="text-muted-foreground">Reajuste</p>
                <p className="font-medium flex items-center gap-1">
                  <Percent className="h-4 w-4" />
                  {contrato.reajuste_percentual}%
                </p>
              </div>
            )}
            {contrato.competencia_referencia && (
              <div>
                <p className="text-muted-foreground">Competência Ref.</p>
                <p className="font-medium">
                  {format(new Date(contrato.competencia_referencia), 'MM/yyyy')}
                </p>
              </div>
            )}
          </div>

          {contrato.observacoes && (
            <div>
              <p className="text-muted-foreground text-sm mb-1">Observações</p>
              <p className="text-sm bg-muted p-3 rounded-md">{contrato.observacoes}</p>
            </div>
          )}

          <Separator />

          {/* Documents Section */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos ({documentos.length})
                </CardTitle>
                {canManage && (
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={handleUploadNew}
                      disabled={uploading}
                      className="absolute inset-0 opacity-0 cursor-pointer w-[140px]"
                    />
                    <Button variant="outline" size="sm" disabled={uploading}>
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      Adicionar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingDocs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : documentos.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">
                  Nenhum documento anexado
                </p>
              ) : (
                <div className="space-y-2">
                  {documentos.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.arquivo_nome}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{tipoDocConfig[doc.tipo_documento] || doc.tipo_documento}</span>
                          <span>•</span>
                          <span>v{doc.versao}</span>
                          <span>•</span>
                          <span>{(doc.tamanho_bytes / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{format(new Date(doc.created_at), 'dd/MM/yy HH:mm')}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreview(doc)}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(doc)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteDocId(doc.id)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Delete document confirmation */}
      <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O arquivo será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const doc = documentos.find(d => d.id === deleteDocId);
                if (doc) deleteDocMutation.mutate(doc);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDocMutation.isPending}
            >
              {deleteDocMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
