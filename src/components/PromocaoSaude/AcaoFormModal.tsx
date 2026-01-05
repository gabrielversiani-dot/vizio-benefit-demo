import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCampanhaDoMes } from "@/config/campanhasMensais";
import { format, parseISO } from "date-fns";

interface AcaoFormModalProps {
  open: boolean;
  onClose: () => void;
  acao?: AcaoSaude | null;
  defaultDate?: Date;
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

const statusOptions = [
  { value: "planejada", label: "Planejada" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

export function AcaoFormModal({ open, onClose, acao, defaultDate }: AcaoFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { empresaSelecionada } = useEmpresa();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    campanha_mes: "",
    data_inicio: "",
    hora_inicio: "",
    data_fim: "",
    hora_fim: "",
    local: "",
    publico_alvo: "",
    responsavel: "",
    status: "planejada",
    visibilidade: "cliente",
    filial_id: "",
  });

  const { data: filiais = [] } = useQuery({
    queryKey: ["filiais", empresaSelecionada],
    queryFn: async () => {
      if (!empresaSelecionada) return [];
      const { data, error } = await supabase
        .from("faturamento_entidades")
        .select("id, nome")
        .eq("empresa_id", empresaSelecionada)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaSelecionada,
  });

  useEffect(() => {
    if (acao) {
      setFormData({
        titulo: acao.titulo || "",
        descricao: acao.descricao || "",
        campanha_mes: acao.campanha_mes || "",
        data_inicio: acao.data_inicio || "",
        hora_inicio: acao.hora_inicio || "",
        data_fim: acao.data_fim || "",
        hora_fim: acao.hora_fim || "",
        local: acao.local || "",
        publico_alvo: acao.publico_alvo || "",
        responsavel: acao.responsavel || "",
        status: acao.status || "planejada",
        visibilidade: acao.visibilidade || "cliente",
        filial_id: acao.filial_id || "",
      });
    } else {
      const dataInicio = defaultDate ? format(defaultDate, "yyyy-MM-dd") : "";
      const mes = defaultDate ? defaultDate.getMonth() + 1 : new Date().getMonth() + 1;
      const campanha = getCampanhaDoMes(mes);
      
      setFormData({
        titulo: "",
        descricao: "",
        campanha_mes: campanha?.nome || "",
        data_inicio: dataInicio,
        hora_inicio: "",
        data_fim: "",
        hora_fim: "",
        local: "",
        publico_alvo: "",
        responsavel: "",
        status: "planejada",
        visibilidade: "cliente",
        filial_id: "",
      });
    }
  }, [acao, defaultDate, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaSelecionada || !user) return;

    if (!formData.titulo.trim() || !formData.data_inicio) {
      toast({ title: "Preencha título e data de início", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        empresa_id: empresaSelecionada,
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || null,
        campanha_mes: formData.campanha_mes || null,
        data_inicio: formData.data_inicio,
        hora_inicio: formData.hora_inicio || null,
        data_fim: formData.data_fim || null,
        hora_fim: formData.hora_fim || null,
        local: formData.local.trim() || null,
        publico_alvo: formData.publico_alvo.trim() || null,
        responsavel: formData.responsavel.trim() || null,
        status: formData.status as "planejada" | "em_andamento" | "concluida" | "cancelada",
        visibilidade: formData.visibilidade as "interna" | "cliente",
        filial_id: formData.filial_id || null,
      };

      if (acao) {
        const { error } = await supabase
          .from("acoes_saude")
          .update(payload)
          .eq("id", acao.id);
        if (error) throw error;
        toast({ title: "Ação atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("acoes_saude")
          .insert({ 
            ...payload, 
            criado_por: user.id,
            tipo: "campanha",
            categoria: "prevencao"
          });
        if (error) throw error;
        toast({ title: "Ação criada com sucesso!" });
      }

      queryClient.invalidateQueries({ queryKey: ["acoes_saude"] });
      onClose();
    } catch (error: any) {
      console.error("Erro ao salvar ação:", error);
      toast({ title: "Erro ao salvar ação", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{acao ? "Editar Ação" : "Nova Ação de Saúde"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Palestra Janeiro Branco"
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes da ação..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="campanha_mes">Campanha do Mês</Label>
              <Input
                id="campanha_mes"
                value={formData.campanha_mes}
                onChange={(e) => setFormData({ ...formData, campanha_mes: e.target.value })}
                placeholder="Ex: Janeiro Branco"
              />
            </div>

            <div>
              <Label htmlFor="filial_id">Filial</Label>
              <Select
                value={formData.filial_id || "_none"}
                onValueChange={(v) => setFormData({ ...formData, filial_id: v === "_none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas (Empresa)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Todas (Empresa)</SelectItem>
                  {filiais.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="data_inicio">Data Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="hora_inicio">Hora Início</Label>
              <Input
                id="hora_inicio"
                type="time"
                value={formData.hora_inicio}
                onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="data_fim">Data Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="hora_fim">Hora Fim</Label>
              <Input
                id="hora_fim"
                type="time"
                value={formData.hora_fim}
                onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="local">Local</Label>
              <Input
                id="local"
                value={formData.local}
                onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                placeholder="Ex: Auditório, Online, etc."
              />
            </div>

            <div>
              <Label htmlFor="publico_alvo">Público-alvo</Label>
              <Input
                id="publico_alvo"
                value={formData.publico_alvo}
                onChange={(e) => setFormData({ ...formData, publico_alvo: e.target.value })}
                placeholder="Ex: Todos os colaboradores"
              />
            </div>

            <div>
              <Label htmlFor="responsavel">Responsável</Label>
              <Input
                id="responsavel"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Switch
                  id="visibilidade"
                  checked={formData.visibilidade === "cliente"}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, visibilidade: checked ? "cliente" : "interna" })
                  }
                />
                <Label htmlFor="visibilidade" className="cursor-pointer">
                  {formData.visibilidade === "cliente" 
                    ? "✅ Visível para cliente" 
                    : "🔒 Apenas interno (corretora)"}
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : acao ? "Salvar" : "Criar Ação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
