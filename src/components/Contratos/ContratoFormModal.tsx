import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Trash2, Loader2, Plus, X, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type TipoDocumento = 'contrato' | 'aditivo' | 'renovacao';
type StatusContrato = 'ativo' | 'vencido' | 'em_renovacao' | 'suspenso' | 'cancelado';
type Produto = 'saude' | 'odonto' | 'vida';
type TipoDocumentoArquivo = 'contrato_principal' | 'anexo' | 'aditivo' | 'reajuste' | 'outros';

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
  competencia_referencia: string | null;
  reajuste_percentual: number | null;
}

interface PendingFile {
  file: File;
  tipo: TipoDocumentoArquivo;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: Contrato | null;
  onSuccess: () => void;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ContratoFormModal({ open, onOpenChange, contrato, onSuccess }: Props) {
  const { user } = useAuth();
  const { empresaSelecionada, isAdminVizio } = useEmpresa();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // Form data
  const [empresaId, setEmpresaId] = useState("");
  const [filialId, setFilialId] = useState("");
  const [produto, setProduto] = useState<Produto | "">("");
  const [tipo, setTipo] = useState<TipoDocumento>("contrato");
  const [titulo, setTitulo] = useState("");
  const [numeroContrato, setNumeroContrato] = useState("");
  const [operadora, setOperadora] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [status, setStatus] = useState<StatusContrato>("ativo");
  const [observacoes, setObservacoes] = useState("");
  const [competenciaReferencia, setCompetenciaReferencia] = useState("");
  const [reajustePercentual, setReajustePercentual] = useState("");
  
  // Files
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  
  // New filial inline form
  const [showNewFilial, setShowNewFilial] = useState(false);
  const [newFilialNome, setNewFilialNome] = useState("");
  const [newFilialTipo, setNewFilialTipo] = useState<"coligada" | "subestipulante">("coligada");
  const [creatingFilial, setCreatingFilial] = useState(false);

  // Fetch empresas
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: isAdminVizio,
  });

  // Fetch filiais based on selected empresa
  const targetEmpresaId = empresaSelecionada || empresaId;
  const { data: filiais = [] } = useQuery({
    queryKey: ["filiais-form", targetEmpresaId],
    queryFn: async () => {
      if (!targetEmpresaId) return [];
      const { data, error } = await supabase
        .from("faturamento_entidades")
        .select("id, nome, tipo")
        .eq("empresa_id", targetEmpresaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!targetEmpresaId,
  });

  // Reset form when opening/closing
  useEffect(() => {
    if (open) {
      if (contrato) {
        setEmpresaId(contrato.empresa_id);
        setFilialId(contrato.filial_id || "");
        setProduto(contrato.produto || "");
        setTipo(contrato.tipo);
        setTitulo(contrato.titulo);
        setNumeroContrato(contrato.numero_contrato || "");
        setOperadora(contrato.operadora || "");
        setDataInicio(contrato.data_inicio);
        setDataFim(contrato.data_fim);
        setStatus(contrato.status);
        setObservacoes(contrato.observacoes || "");
        setCompetenciaReferencia(contrato.competencia_referencia || "");
        setReajustePercentual(contrato.reajuste_percentual?.toString() || "");
      } else {
        setEmpresaId(empresaSelecionada || "");
        setFilialId("");
        setProduto("");
        setTipo("contrato");
        setTitulo("");
        setNumeroContrato("");
        setOperadora("");
        setDataInicio("");
        setDataFim("");
        setStatus("ativo");
        setObservacoes("");
        setCompetenciaReferencia("");
        setReajustePercentual("");
      }
      setPendingFiles([]);
      setStep(1);
      setShowNewFilial(false);
    }
  }, [open, contrato, empresaSelecionada]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Arquivo "${file.name}" muito grande. Máximo 10MB`);
        continue;
      }
      // Validate extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`Tipo de arquivo não permitido: ${ext}`);
        continue;
      }
      // Add to pending
      setPendingFiles(prev => [...prev, { file, tipo: 'contrato_principal' }]);
    }
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileType = (index: number, tipo: TipoDocumentoArquivo) => {
    setPendingFiles(prev => prev.map((f, i) => i === index ? { ...f, tipo } : f));
  };

  const handleCreateFilial = async () => {
    if (!newFilialNome.trim()) {
      toast.error("Nome da filial é obrigatório");
      return;
    }
    if (!targetEmpresaId) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }

    setCreatingFilial(true);
    try {
      const { data, error } = await supabase
        .from("faturamento_entidades")
        .insert({
          empresa_id: targetEmpresaId,
          nome: newFilialNome.trim(),
          tipo: newFilialTipo,
        })
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["filiais-form"] });
      setFilialId(data.id);
      setShowNewFilial(false);
      setNewFilialNome("");
      toast.success("Filial criada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar filial");
    } finally {
      setCreatingFilial(false);
    }
  };

  const validateStep1 = () => {
    if (!targetEmpresaId) {
      toast.error("Selecione uma empresa");
      return false;
    }
    if (!produto) {
      toast.error("Selecione um produto");
      return false;
    }
    if (!titulo.trim()) {
      toast.error("Título é obrigatório");
      return false;
    }
    if (!dataInicio || !dataFim) {
      toast.error("Datas de vigência são obrigatórias");
      return false;
    }
    if (tipo === 'renovacao' && !reajustePercentual) {
      toast.error("Percentual de reajuste é obrigatório para tipo Reajuste");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;

    // For new contracts, require at least one document
    if (!contrato && pendingFiles.length === 0) {
      toast.error("Adicione pelo menos um documento");
      return;
    }

    setSaving(true);
    try {
      const contratoData = {
        empresa_id: targetEmpresaId,
        filial_id: filialId || null,
        produto: produto || null,
        tipo,
        titulo: titulo.trim(),
        numero_contrato: numeroContrato.trim() || null,
        operadora: operadora.trim() || null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        status,
        observacoes: observacoes.trim() || null,
        competencia_referencia: competenciaReferencia || null,
        reajuste_percentual: reajustePercentual ? parseFloat(reajustePercentual) : null,
      };

      let contratoId: string;

      if (contrato) {
        // Update existing
        const { error } = await supabase
          .from("contratos")
          .update(contratoData)
          .eq("id", contrato.id);
        if (error) throw error;
        contratoId = contrato.id;
      } else {
        // Create new - need arquivo_url and arquivo_nome for legacy compatibility
        const { data, error } = await supabase
          .from("contratos")
          .insert({
            ...contratoData,
            criado_por: user.id,
            arquivo_url: '',
            arquivo_nome: '',
          })
          .select()
          .single();
        if (error) throw error;
        contratoId = data.id;
      }

      // Upload pending files
      for (const pf of pendingFiles) {
        const timestamp = Date.now();
        const storagePath = `${targetEmpresaId}/contratos/${contratoId}/v1/${timestamp}-${pf.file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("contratos")
          .upload(storagePath, pf.file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Erro ao enviar ${pf.file.name}`);
          continue;
        }

        // Create document record
        const { error: docError } = await supabase
          .from("contrato_documentos")
          .insert({
            empresa_id: targetEmpresaId,
            contrato_id: contratoId,
            tipo_documento: pf.tipo,
            arquivo_nome: pf.file.name,
            mime_type: pf.file.type || 'application/octet-stream',
            tamanho_bytes: pf.file.size,
            storage_path: storagePath,
            uploaded_by: user.id,
          });

        if (docError) {
          console.error("Doc record error:", docError);
        }
      }

      toast.success(contrato ? "Contrato atualizado!" : "Contrato criado com sucesso!");
      onSuccess();
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || "Erro ao salvar contrato");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contrato ? "Editar Contrato" : "Novo Contrato"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "Passo 1: Dados do contrato" : "Passo 2: Documentos"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            {/* Empresa */}
            {isAdminVizio && !empresaSelecionada && (
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filial */}
            <div className="space-y-2">
              <Label>Filial (opcional)</Label>
              {!showNewFilial ? (
              <div className="flex gap-2">
                  <Select value={filialId || "_none"} onValueChange={(v) => setFilialId(v === "_none" ? "" : v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Nenhuma filial selecionada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhuma</SelectItem>
                      {filiais.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNewFilial(true)}
                    title="Nova filial"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Card className="p-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={newFilialNome}
                        onChange={(e) => setNewFilialNome(e.target.value)}
                        placeholder="Ex: Matriz"
                      />
                    </div>
                    <div className="w-[140px] space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={newFilialTipo} onValueChange={(v) => setNewFilialTipo(v as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coligada">Coligada</SelectItem>
                          <SelectItem value="subestipulante">Subestipulante</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateFilial}
                      disabled={creatingFilial}
                    >
                      {creatingFilial ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowNewFilial(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              )}
              {filiais.length === 0 && !showNewFilial && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma filial cadastrada. Você pode criar uma clicando no botão +
                </p>
              )}
            </div>

            {/* Produto and Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Produto *</Label>
                <Select value={produto} onValueChange={(v) => setProduto(v as Produto)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saude">Saúde</SelectItem>
                    <SelectItem value="odonto">Odonto</SelectItem>
                    <SelectItem value="vida">Vida em Grupo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDocumento)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="aditivo">Aditivo</SelectItem>
                    <SelectItem value="renovacao">Reajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Contrato Unimed BH 2025"
              />
            </div>

            {/* Número and Operadora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número/Apólice</Label>
                <Input
                  value={numeroContrato}
                  onChange={(e) => setNumeroContrato(e.target.value)}
                  placeholder="Ex: CT-2025-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Operadora</Label>
                <Input
                  value={operadora}
                  onChange={(e) => setOperadora(e.target.value)}
                  placeholder="Ex: Unimed BH"
                />
              </div>
            </div>

            {/* Vigência */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início Vigência *</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim Vigência *</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </div>

            {/* Reajuste fields (only for tipo=renovacao) */}
            {tipo === 'renovacao' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Competência Referência</Label>
                  <Input
                    type="date"
                    value={competenciaReferencia}
                    onChange={(e) => setCompetenciaReferencia(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reajuste % *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={reajustePercentual}
                    onChange={(e) => setReajustePercentual(e.target.value)}
                    placeholder="Ex: 8.5"
                  />
                </div>
              </div>
            )}

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusContrato)}>
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

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais..."
                rows={3}
              />
            </div>
          </div>
        ) : (
          /* Step 2: Documents */
          <div className="space-y-4">
            {/* Upload area */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Arraste arquivos ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (máx. 10MB cada)
              </p>
              <Input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="max-w-[200px] mx-auto"
              />
            </div>

            {/* Pending files list */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Arquivos selecionados ({pendingFiles.length})</Label>
                {pendingFiles.map((pf, i) => (
                  <Card key={i} className="p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{pf.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(pf.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Select
                        value={pf.tipo}
                        onValueChange={(v) => updateFileType(i, v as TipoDocumentoArquivo)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contrato_principal">Principal</SelectItem>
                          <SelectItem value="anexo">Anexo</SelectItem>
                          <SelectItem value="aditivo">Aditivo</SelectItem>
                          <SelectItem value="reajuste">Reajuste</SelectItem>
                          <SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePendingFile(i)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {pendingFiles.length === 0 && !contrato && (
              <p className="text-sm text-center text-muted-foreground py-4">
                Adicione pelo menos um documento para criar o contrato
              </p>
            )}

            {contrato && pendingFiles.length === 0 && (
              <p className="text-sm text-center text-muted-foreground py-4">
                Documentos existentes podem ser gerenciados na tela de detalhes
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => validateStep1() && setStep(2)}>
                Próximo
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || (!contrato && pendingFiles.length === 0)}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  contrato ? "Atualizar" : "Criar Contrato"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
