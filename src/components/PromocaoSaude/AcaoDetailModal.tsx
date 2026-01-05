import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  User, 
  Download, 
  Upload, 
  Trash2, 
  Eye, 
  EyeOff,
  FileText,
  Image,
  Film,
  File
} from "lucide-react";
import { MaterialUploadModal } from "./MaterialUploadModal";

interface AcaoDetailModalProps {
  open: boolean;
  onClose: () => void;
  acao: AcaoSaude | null;
  isAdmin: boolean;
}

interface AcaoSaude {
  id: string;
  empresa_id: string;
  filial_id: string | null;
  titulo: string;
  descricao: string | null;
  campanha_mes: string | null;
  data_inicio: string;
  hora_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  local: string | null;
  publico_alvo: string | null;
  responsavel: string | null;
  status: string;
  visibilidade: string;
}

interface Material {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  storage_path: string;
  mime_type: string | null;
  tamanho: number | null;
  visivel_cliente: boolean;
  criado_em: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  planejada: { label: "Planejada", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  em_andamento: { label: "Em Andamento", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  concluida: { label: "Concluída", color: "bg-green-500/20 text-green-700 border-green-500/30" },
  cancelada: { label: "Cancelada", color: "bg-red-500/20 text-red-700 border-red-500/30" },
};

const tipoMaterialConfig: Record<string, string> = {
  whatsapp: "WhatsApp",
  folder: "Folder",
  cartaz: "Cartaz",
  brinde: "Brinde",
  email: "E-mail",
  outro: "Outro",
};

export function AcaoDetailModal({ open, onClose, acao, isAdmin }: AcaoDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: materiais = [], isLoading: loadingMateriais } = useQuery({
    queryKey: ["materiais", acao?.id],
    queryFn: async () => {
      if (!acao) return [];
      const { data, error } = await supabase
        .from("promocao_saude_materiais")
        .select("*")
        .eq("acao_id", acao.id)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Material[];
    },
    enabled: !!acao,
  });

  const handleDownload = async (material: Material) => {
    setDownloadingId(material.id);
    try {
      const { data, error } = await supabase.storage
        .from("promocao-saude")
        .createSignedUrl(material.storage_path, 60);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error("URL não gerada");

      window.open(data.signedUrl, "_blank");
    } catch (error: any) {
      console.error("Erro ao baixar:", error);
      toast({ title: "Erro ao baixar arquivo", description: error.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteMaterial = async (material: Material) => {
    if (!confirm("Excluir este material?")) return;

    try {
      // Delete from storage
      await supabase.storage.from("promocao-saude").remove([material.storage_path]);
      
      // Delete from database
      const { error } = await supabase
        .from("promocao_saude_materiais")
        .delete()
        .eq("id", material.id);

      if (error) throw error;

      toast({ title: "Material excluído" });
      queryClient.invalidateQueries({ queryKey: ["materiais", acao?.id] });
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-5 w-5" />;
    if (mimeType.startsWith("image/")) return <Image className="h-5 w-5 text-green-600" />;
    if (mimeType.startsWith("video/")) return <Film className="h-5 w-5 text-purple-600" />;
    if (mimeType === "application/pdf") return <FileText className="h-5 w-5 text-red-600" />;
    return <File className="h-5 w-5 text-blue-600" />;
  };

  if (!acao) return null;

  const status = statusConfig[acao.status] || statusConfig.planejada;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">{acao.titulo}</DialogTitle>
                {acao.campanha_mes && (
                  <p className="text-sm text-muted-foreground mt-1">{acao.campanha_mes}</p>
                )}
              </div>
              <Badge variant="outline" className={status.color}>
                {status.label}
              </Badge>
            </div>
          </DialogHeader>

          <Tabs defaultValue="detalhes" className="mt-4">
            <TabsList>
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="materiais">
                Materiais ({materiais.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="detalhes" className="space-y-4 mt-4">
              {acao.descricao && (
                <p className="text-muted-foreground">{acao.descricao}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(parseISO(acao.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                    {acao.data_fim && ` - ${format(parseISO(acao.data_fim), "dd/MM/yyyy", { locale: ptBR })}`}
                  </span>
                </div>

                {(acao.hora_inicio || acao.hora_fim) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {acao.hora_inicio || "--:--"} - {acao.hora_fim || "--:--"}
                    </span>
                  </div>
                )}

                {acao.local && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{acao.local}</span>
                  </div>
                )}

                {acao.publico_alvo && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{acao.publico_alvo}</span>
                  </div>
                )}

                {acao.responsavel && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{acao.responsavel}</span>
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 text-sm p-3 bg-muted/50 rounded-lg">
                  {acao.visibilidade === "cliente" ? (
                    <>
                      <Eye className="h-4 w-4 text-green-600" />
                      <span className="text-green-700">Visível para cliente</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 text-orange-600" />
                      <span className="text-orange-700">Apenas interno</span>
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="materiais" className="mt-4">
              {isAdmin && (
                <div className="mb-4">
                  <Button onClick={() => setUploadModalOpen(true)} size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Material
                  </Button>
                </div>
              )}

              {loadingMateriais ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : materiais.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum material disponível
                </div>
              ) : (
                <div className="space-y-2">
                  {materiais.map((material) => (
                    <Card key={material.id} className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {getFileIcon(material.mime_type)}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{material.titulo}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{tipoMaterialConfig[material.tipo] || material.tipo}</span>
                              {material.tamanho && (
                                <span>• {(material.tamanho / 1024 / 1024).toFixed(2)} MB</span>
                              )}
                              {isAdmin && (
                                <span className={material.visivel_cliente ? "text-green-600" : "text-orange-600"}>
                                  • {material.visivel_cliente ? "Visível" : "Interno"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(material)}
                            disabled={downloadingId === material.id}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMaterial(material)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {acao && (
        <MaterialUploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          acaoId={acao.id}
          empresaId={acao.empresa_id}
        />
      )}
    </>
  );
}
