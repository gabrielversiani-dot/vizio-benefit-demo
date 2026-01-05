import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Upload, 
  FileText, 
  Image, 
  Download, 
  Trash2, 
  Eye,
  Loader2,
  File
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SinistroDocumentosProps {
  sinistroId: string;
  empresaId: string;
  canEdit: boolean;
}

interface Documento {
  id: string;
  nome_arquivo: string;
  tipo_mime: string;
  tamanho: number;
  storage_path: string;
  created_at: string;
  uploaded_by: string;
}

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.docx";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function SinistroDocumentos({ sinistroId, empresaId, canEdit }: SinistroDocumentosProps) {
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docToDelete, setDocToDelete] = useState<Documento | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['sinistro-documentos', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_documentos')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Documento[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${empresaId}/sinistros/${sinistroId}/${timestamp}-${sanitizedName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('sinistros')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Insert record
      const { error: insertError } = await supabase
        .from('sinistro_documentos')
        .insert({
          sinistro_id: sinistroId,
          empresa_id: empresaId,
          nome_arquivo: file.name,
          tipo_mime: file.type,
          tamanho: file.size,
          storage_path: storagePath,
          uploaded_by: user.id,
        });

      if (insertError) {
        // Rollback storage upload
        await supabase.storage.from('sinistros').remove([storagePath]);
        throw insertError;
      }
    },
    onSuccess: () => {
      toast.success("Documento enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['sinistro-documentos', sinistroId] });
      setIsUploadOpen(false);
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar documento: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: Documento) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('sinistros')
        .remove([doc.storage_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error: deleteError } = await supabase
        .from('sinistro_documentos')
        .delete()
        .eq('id', doc.id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success("Documento excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['sinistro-documentos', sinistroId] });
      setIsDeleteOpen(false);
      setDocToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir documento: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Máximo: 10MB");
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleDownload = async (doc: Documento) => {
    const { data, error } = await supabase.storage
      .from('sinistros')
      .download(doc.storage_path);

    if (error) {
      toast.error("Erro ao baixar documento");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nome_arquivo;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async (doc: Documento) => {
    const { data, error } = await supabase.storage
      .from('sinistros')
      .createSignedUrl(doc.storage_path, 300); // 5 min

    if (error) {
      toast.error("Erro ao visualizar documento");
      return;
    }

    // For images and PDFs, open in new tab
    if (doc.tipo_mime.startsWith('image/') || doc.tipo_mime === 'application/pdf') {
      window.open(data.signedUrl, '_blank');
    } else {
      // For other types, download
      handleDownload(doc);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-chart-2" />;
    if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-destructive" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Documentos do Sinistro</CardTitle>
        {canEdit && (
          <Button size="sm" onClick={() => setIsUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Enviar Documento
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum documento anexado</p>
            {canEdit && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setIsUploadOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Anexar primeiro documento
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {documentos.map((doc) => (
              <div 
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(doc.tipo_mime)}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.nome_arquivo}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.tamanho)} • {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
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
                      onClick={() => {
                        setDocToDelete(doc);
                        setIsDeleteOpen(true);
                      }}
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

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Documento</DialogTitle>
            <DialogDescription>
              Anexe documentos relacionados a este sinistro (PDF, imagens, DOCX)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo</Label>
              <Input
                id="file"
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileSelect}
              />
              <p className="text-xs text-muted-foreground">
                Tipos aceitos: PDF, JPG, PNG, WEBP, DOCX • Máximo: 10MB
              </p>
            </div>
            {selectedFile && (
              <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                {getFileIcon(selectedFile.type)}
                <div>
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{docToDelete?.nome_arquivo}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => docToDelete && deleteMutation.mutate(docToDelete)}
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
