import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Eye, 
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface DocumentosSinistralidade {
  id: string;
  empresa_id: string;
  operadora: string;
  tipo_relatorio: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  competencias: string[] | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  status: string;
  import_job_id: string | null;
  ai_summary: string | null;
  uploaded_by: string;
  created_at: string;
}

interface SinistroDocsSectionProps {
  empresaId: string | null;
  onImportClick: () => void;
  canEdit: boolean;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  uploaded: { label: "Enviado", icon: Clock, color: "bg-muted text-muted-foreground" },
  analyzing: { label: "Analisando", icon: RefreshCw, color: "bg-blue-500/10 text-blue-500" },
  analyzed: { label: "Analisado", icon: CheckCircle2, color: "bg-warning/10 text-warning" },
  applied: { label: "Aplicado", icon: CheckCircle2, color: "bg-success/10 text-success" },
  failed: { label: "Falhou", icon: XCircle, color: "bg-destructive/10 text-destructive" },
};

const tipoRelatorioLabels: Record<string, string> = {
  demonstrativo_resultado: "Demonstrativo de Resultado",
  custo_assistencial: "Custo Assistencial",
  consultas: "Consultas",
  internacoes: "Internações",
  unknown: "Não identificado",
};

export function SinistroDocsSection({ empresaId, onImportClick, canEdit }: SinistroDocsSectionProps) {
  const queryClient = useQueryClient();
  const [deleteDoc, setDeleteDoc] = useState<DocumentosSinistralidade | null>(null);

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['sinistralidade-documentos', empresaId],
    queryFn: async () => {
      let query = supabase
        .from('sinistralidade_documentos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DocumentosSinistralidade[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: DocumentosSinistralidade) => {
      // Delete from storage
      await supabase.storage
        .from('sinistralidade_pdfs')
        .remove([doc.file_path]);

      // Delete record
      const { error } = await supabase
        .from('sinistralidade_documentos')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['sinistralidade-documentos'] });
      setDeleteDoc(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const handleDownload = async (doc: DocumentosSinistralidade) => {
    const { data, error } = await supabase.storage
      .from('sinistralidade_pdfs')
      .download(doc.file_path);

    if (error) {
      toast.error("Erro ao baixar documento");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async (doc: DocumentosSinistralidade) => {
    const { data, error } = await supabase.storage
      .from('sinistralidade_pdfs')
      .createSignedUrl(doc.file_path, 300);

    if (error) {
      toast.error("Erro ao visualizar documento");
      return;
    }

    window.open(data.signedUrl, '_blank');
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatPeriodo = (doc: DocumentosSinistralidade) => {
    if (doc.competencias && doc.competencias.length > 0) {
      if (doc.competencias.length === 1) {
        return doc.competencias[0];
      }
      return `${doc.competencias[0]} a ${doc.competencias[doc.competencias.length - 1]}`;
    }
    if (doc.periodo_inicio && doc.periodo_fim) {
      return `${format(new Date(doc.periodo_inicio), "MM/yyyy")} - ${format(new Date(doc.periodo_fim), "MM/yyyy")}`;
    }
    return "-";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentos de Sinistralidade (Unimed BH)
            </CardTitle>
            <CardDescription>
              PDFs importados para análise de sinistralidade
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={onImportClick}>
              <Upload className="h-4 w-4 mr-2" />
              Importar PDF
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Nenhum documento importado</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-4">
              Envie o PDF da Unimed BH para extrair automaticamente os dados de sinistralidade com inteligência artificial.
            </p>
            {canEdit && (
              <Button onClick={onImportClick}>
                <Upload className="h-4 w-4 mr-2" />
                Importar PDF (Unimed BH)
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Upload</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentos.map((doc) => {
                const status = statusConfig[doc.status] || statusConfig.uploaded;
                const StatusIcon = status.icon;
                
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-destructive" />
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {doc.tipo_relatorio ? tipoRelatorioLabels[doc.tipo_relatorio] || doc.tipo_relatorio : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">{formatPeriodo(doc)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${status.color} gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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
                          title="Baixar"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteDoc(doc)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteDoc?.file_name}"? 
              Os dados já aplicados não serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
