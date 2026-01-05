import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Image, Video, File } from "lucide-react";

interface MaterialUploadModalProps {
  open: boolean;
  onClose: () => void;
  acaoId: string;
  empresaId: string;
}

const tipoOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "folder", label: "Folder" },
  { value: "cartaz", label: "Cartaz" },
  { value: "brinde", label: "Brinde" },
  { value: "email", label: "E-mail Marketing" },
  { value: "outro", label: "Outro" },
];

export function MaterialUploadModal({ open, onClose, acaoId, empresaId }: MaterialUploadModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "outro",
    visivel_cliente: true,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.titulo) {
        setFormData({ ...formData, titulo: file.name.replace(/\.[^/.]+$/, "") });
      }
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload className="h-8 w-8 text-muted-foreground" />;
    const type = selectedFile.type;
    if (type.startsWith("image/")) return <Image className="h-8 w-8 text-green-600" />;
    if (type.startsWith("video/")) return <Video className="h-8 w-8 text-purple-600" />;
    if (type === "application/pdf") return <FileText className="h-8 w-8 text-red-600" />;
    return <File className="h-8 w-8 text-blue-600" />;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ title: "Selecione um arquivo", variant: "destructive" });
      return;
    }

    if (!formData.titulo.trim()) {
      toast({ title: "Preencha o título", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Upload file to storage
      const timestamp = Date.now();
      const fileName = `${timestamp}-${selectedFile.name}`;
      const storagePath = `${empresaId}/acoes/${acaoId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("promocao-saude")
        .upload(storagePath, selectedFile);

      if (uploadError) throw uploadError;

      // Create material record
      const { error: dbError } = await supabase
        .from("promocao_saude_materiais")
        .insert({
          empresa_id: empresaId,
          acao_id: acaoId,
          tipo: formData.tipo as "whatsapp" | "folder" | "cartaz" | "brinde" | "email" | "outro",
          titulo: formData.titulo.trim(),
          descricao: formData.descricao.trim() || null,
          storage_bucket: "promocao-saude",
          storage_path: storagePath,
          mime_type: selectedFile.type,
          tamanho: selectedFile.size,
          visivel_cliente: formData.visivel_cliente,
        });

      if (dbError) throw dbError;

      toast({ title: "Material enviado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["materiais", acaoId] });
      onClose();
      
      // Reset form
      setSelectedFile(null);
      setFormData({ titulo: "", descricao: "", tipo: "outro", visivel_cliente: true });
    } catch (error: any) {
      console.error("Erro ao enviar material:", error);
      toast({ title: "Erro ao enviar material", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Material</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File upload area */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            />
            <div className="flex flex-col items-center gap-2">
              {getFileIcon()}
              {selectedFile ? (
                <div>
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar ou arraste um arquivo
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Nome do material"
              required
            />
          </div>

          <div>
            <Label htmlFor="tipo">Tipo de Material</Label>
            <Select
              value={formData.tipo}
              onValueChange={(v) => setFormData({ ...formData, tipo: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipoOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Instruções de uso, público-alvo, etc."
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Switch
              id="visivel_cliente"
              checked={formData.visivel_cliente}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, visivel_cliente: checked })
              }
            />
            <Label htmlFor="visivel_cliente" className="cursor-pointer text-sm">
              {formData.visivel_cliente 
                ? "✅ Visível para cliente (pode baixar)" 
                : "🔒 Apenas interno"}
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !selectedFile}>
              {loading ? "Enviando..." : "Enviar Material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
