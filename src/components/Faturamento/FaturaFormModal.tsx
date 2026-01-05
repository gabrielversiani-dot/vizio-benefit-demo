import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Upload, FileText, X, Download, AlertCircle, Building2 } from "lucide-react";
import { format } from "date-fns";

type FaturaFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fatura: any | null;
  mode: "create" | "edit";
  onSuccess: () => void;
};

type Subfatura = {
  id?: string;
  entidade_id: string | null;
  descricao: string;
  valor: number;
};

type Documento = {
  id?: string;
  tipo: "boleto" | "nf" | "demonstrativo" | "outro";
  filename: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  file?: File;
};

type Entidade = {
  id: string;
  nome: string;
  tipo: "coligada" | "subestipulante";
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function FaturaFormModal({ open, onOpenChange, fatura, mode, onSuccess }: FaturaFormModalProps) {
  const { empresaSelecionada, isAdminVizio, empresas } = useEmpresa();
  const queryClient = useQueryClient();
  
  // Form state
  const [empresaId, setEmpresaId] = useState(empresaSelecionada || "");
  const [filialId, setFilialId] = useState<string | null>(null);
  const [produto, setProduto] = useState<"saude" | "vida" | "odonto">("saude");
  const [competencia, setCompetencia] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [status, setStatus] = useState<"aguardando_pagamento" | "pago" | "atraso" | "cancelado">("aguardando_pagamento");
  const [pagoEm, setPagoEm] = useState("");
  const [observacao, setObservacao] = useState("");
  
  // Subfaturas
  const [subfaturas, setSubfaturas] = useState<Subfatura[]>([]);
  
  // Documentos
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [documentoTipo, setDocumentoTipo] = useState<"boleto" | "nf" | "demonstrativo" | "outro">("boleto");
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New filial form state
  const [showNewFilialForm, setShowNewFilialForm] = useState(false);
  const [newFilialNome, setNewFilialNome] = useState("");
  const [newFilialTipo, setNewFilialTipo] = useState<"coligada" | "subestipulante">("coligada");
  const [isCreatingFilial, setIsCreatingFilial] = useState(false);

  const handleCreateFilial = async () => {
    if (!newFilialNome.trim()) {
      toast.error("Informe o nome da filial");
      return;
    }
    if (!empresaId) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }

    setIsCreatingFilial(true);
    try {
      const { data, error } = await supabase
        .from("faturamento_entidades")
        .insert({
          empresa_id: empresaId,
          nome: newFilialNome.trim(),
          tipo: newFilialTipo,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Filial cadastrada com sucesso!");
      setFilialId(data.id);
      setNewFilialNome("");
      setShowNewFilialForm(false);
      queryClient.invalidateQueries({ queryKey: ["faturamento-entidades", empresaId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar filial");
    } finally {
      setIsCreatingFilial(false);
    }
  };

  // Reset filial when empresa changes
  useEffect(() => {
    if (mode === "create") {
      setFilialId(null);
    }
  }, [empresaId, mode]);

  // Fetch entidades for subfaturas
  const { data: entidades = [] } = useQuery({
    queryKey: ["faturamento-entidades", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("faturamento_entidades")
        .select("id, nome, tipo")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Entidade[];
    },
    enabled: !!empresaId,
  });

  // Fetch existing subfaturas when editing
  const { data: existingSubfaturas = [] } = useQuery({
    queryKey: ["faturamento-subfaturas", fatura?.id],
    queryFn: async () => {
      if (!fatura?.id) return [];
      const { data, error } = await supabase
        .from("faturamento_subfaturas")
        .select("*")
        .eq("faturamento_id", fatura.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: mode === "edit" && !!fatura?.id,
  });

  // Fetch existing documentos when editing
  const { data: existingDocumentos = [] } = useQuery({
    queryKey: ["faturamento-documentos", fatura?.id],
    queryFn: async () => {
      if (!fatura?.id) return [];
      const { data, error } = await supabase
        .from("faturamento_documentos")
        .select("*")
        .eq("faturamento_id", fatura.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: mode === "edit" && !!fatura?.id,
  });

  // Initialize form when editing
  useEffect(() => {
    if (mode === "edit" && fatura) {
      setEmpresaId(fatura.empresa_id);
      setFilialId(fatura.filial_id || null);
      setProduto(fatura.produto);
      setCompetencia(fatura.competencia);
      setVencimento(fatura.vencimento);
      setValorTotal(String(fatura.valor_total));
      setStatus(fatura.status);
      setPagoEm(fatura.pago_em || "");
      setObservacao(fatura.observacao || "");
    } else {
      // Reset form for create
      setEmpresaId(empresaSelecionada || "");
      setFilialId(null);
      setProduto("saude");
      setCompetencia("");
      setVencimento("");
      setValorTotal("");
      setStatus("aguardando_pagamento");
      setPagoEm("");
      setObservacao("");
      setSubfaturas([]);
      setDocumentos([]);
    }
  }, [mode, fatura, empresaSelecionada]);

  // Load existing subfaturas
  useEffect(() => {
    if (existingSubfaturas.length > 0) {
      setSubfaturas(existingSubfaturas.map(sf => ({
        id: sf.id,
        entidade_id: sf.entidade_id,
        descricao: sf.descricao || "",
        valor: Number(sf.valor),
      })));
    }
  }, [existingSubfaturas]);

  // Load existing documentos
  useEffect(() => {
    if (existingDocumentos.length > 0) {
      setDocumentos(existingDocumentos.map(doc => ({
        id: doc.id,
        tipo: doc.tipo,
        filename: doc.filename,
        storage_path: doc.storage_path,
        mime_type: doc.mime_type,
        tamanho_bytes: doc.tamanho_bytes,
      })));
    }
  }, [existingDocumentos]);

  // Subfatura handlers
  const addSubfatura = () => {
    setSubfaturas([...subfaturas, { entidade_id: null, descricao: "", valor: 0 }]);
  };

  const updateSubfatura = (index: number, field: keyof Subfatura, value: any) => {
    const updated = [...subfaturas];
    updated[index] = { ...updated[index], [field]: value };
    setSubfaturas(updated);
  };

  const removeSubfatura = (index: number) => {
    setSubfaturas(subfaturas.filter((_, i) => i !== index));
  };

  const totalSubfaturas = subfaturas.reduce((acc, sf) => acc + (Number(sf.valor) || 0), 0);
  const valorTotalNum = Number(valorTotal) || 0;
  const diferencaSubfaturas = valorTotalNum - totalSubfaturas;

  // Document handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadingFiles([...uploadingFiles, ...files]);
  };

  const removeUploadingFile = (index: number) => {
    setUploadingFiles(uploadingFiles.filter((_, i) => i !== index));
  };

  const removeDocumento = async (doc: Documento) => {
    if (doc.id) {
      // Delete from database and storage
      try {
        await supabase.storage.from("faturamento_docs").remove([doc.storage_path]);
        await supabase.from("faturamento_documentos").delete().eq("id", doc.id);
        setDocumentos(documentos.filter(d => d.id !== doc.id));
        toast.success("Documento removido");
      } catch (err) {
        toast.error("Erro ao remover documento");
      }
    }
  };

  const handleSubmit = async () => {
    // Validations
    if (!empresaId) {
      toast.error("Selecione uma empresa");
      return;
    }
    if (!competencia) {
      toast.error("Informe a competência");
      return;
    }
    if (!vencimento) {
      toast.error("Informe o vencimento");
      return;
    }
    if (!valorTotal || Number(valorTotal) <= 0) {
      toast.error("Informe um valor total válido");
      return;
    }
    if (status === "pago" && !pagoEm) {
      toast.error("Informe a data de pagamento");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let faturaId = fatura?.id;

      if (mode === "create") {
        // Create fatura
        const { data: newFatura, error } = await supabase
          .from("faturamentos")
          .insert({
            empresa_id: empresaId,
            filial_id: filialId || null,
            produto,
            competencia: `${competencia}-01`, // Store as first day of month
            vencimento,
            valor_total: Number(valorTotal),
            status,
            pago_em: pagoEm || null,
            observacao: observacao || null,
            criado_por: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        faturaId = newFatura.id;
      } else {
        // Update fatura
        const { error } = await supabase
          .from("faturamentos")
          .update({
            filial_id: filialId || null,
            produto,
            competencia: `${competencia}-01`,
            vencimento,
            valor_total: Number(valorTotal),
            status,
            pago_em: pagoEm || null,
            observacao: observacao || null,
          })
          .eq("id", faturaId);

        if (error) throw error;
      }

      // Handle subfaturas
      if (mode === "edit") {
        // Delete removed subfaturas
        const existingIds = existingSubfaturas.map(sf => sf.id);
        const currentIds = subfaturas.filter(sf => sf.id).map(sf => sf.id);
        const toDelete = existingIds.filter(id => !currentIds.includes(id));
        
        if (toDelete.length > 0) {
          await supabase.from("faturamento_subfaturas").delete().in("id", toDelete);
        }
      }

      // Insert/Update subfaturas
      for (const sf of subfaturas) {
        if (sf.id) {
          // Update existing
          await supabase
            .from("faturamento_subfaturas")
            .update({
              entidade_id: sf.entidade_id,
              descricao: sf.descricao,
              valor: sf.valor,
            })
            .eq("id", sf.id);
        } else {
          // Insert new
          await supabase.from("faturamento_subfaturas").insert({
            faturamento_id: faturaId,
            entidade_id: sf.entidade_id,
            descricao: sf.descricao,
            valor: sf.valor,
          });
        }
      }

      // Upload new files
      for (const file of uploadingFiles) {
        const timestamp = Date.now();
        const storagePath = `${empresaId}/${produto}/${competencia}/${faturaId}/${timestamp}-${documentoTipo}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("faturamento_docs")
          .upload(storagePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        await supabase.from("faturamento_documentos").insert({
          faturamento_id: faturaId,
          tipo: documentoTipo,
          filename: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          tamanho_bytes: file.size,
          uploaded_by: user.id,
        });
      }

      toast.success(mode === "create" ? "Fatura criada com sucesso!" : "Fatura atualizada com sucesso!");
      onSuccess();
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error(err.message || "Erro ao salvar fatura");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova Fatura" : "Editar Fatura"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Cadastre uma nova fatura com subfaturas e documentos"
              : "Edite os dados da fatura, subfaturas e documentos"
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="subfaturas">Subfaturas</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 mt-4">
            {/* Empresa selector for admin_vizio */}
            {isAdminVizio && (
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

            {/* Filial selector (optional) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Filial (opcional)</Label>
                {!showNewFilialForm && empresaId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                    onClick={() => setShowNewFilialForm(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Nova filial
                  </Button>
                )}
              </div>
              
              {showNewFilialForm ? (
                <Card className="border-dashed">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      Cadastrar nova filial
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Nome da filial"
                        value={newFilialNome}
                        onChange={(e) => setNewFilialNome(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Select value={newFilialTipo} onValueChange={(v: any) => setNewFilialTipo(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coligada">Coligada</SelectItem>
                          <SelectItem value="subestipulante">Subestipulante</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateFilial}
                        disabled={isCreatingFilial || !newFilialNome.trim()}
                      >
                        {isCreatingFilial ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowNewFilialForm(false);
                          setNewFilialNome("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Select 
                    value={filialId || "none"} 
                    onValueChange={(v) => setFilialId(v === "none" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma filial (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma filial</SelectItem>
                      {entidades.length > 0 ? (
                        entidades.map(e => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome} ({e.tipo === "coligada" ? "Coligada" : "Subestipulante"})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>Nenhuma filial cadastrada</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {entidades.length === 0 && empresaId && (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma filial cadastrada. Clique em "Nova filial" para adicionar.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Produto *</Label>
                <Select value={produto} onValueChange={(v: any) => setProduto(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saude">Saúde</SelectItem>
                    <SelectItem value="vida">Vida</SelectItem>
                    <SelectItem value="odonto">Odonto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="atraso">Em Atraso</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Competência *</Label>
                <Input
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              {status === "pago" && (
                <div className="space-y-2">
                  <Label>Data de Pagamento *</Label>
                  <Input
                    type="date"
                    value={pagoEm}
                    onChange={(e) => setPagoEm(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="subfaturas" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Subfaturas</CardTitle>
                    <CardDescription>
                      Detalhe valores por coligada ou subestipulante
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addSubfatura}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {subfaturas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma subfatura cadastrada
                  </p>
                ) : (
                  subfaturas.map((sf, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Select
                        value={sf.entidade_id || "none"}
                        onValueChange={(v) => updateSubfatura(index, "entidade_id", v === "none" ? null : v)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Entidade (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem entidade</SelectItem>
                          {entidades.map(e => (
                            <SelectItem key={e.id} value={e.id}>
                              <span className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {e.tipo === "coligada" ? "C" : "S"}
                                </Badge>
                                {e.nome}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="Descrição"
                        value={sf.descricao}
                        onChange={(e) => updateSubfatura(index, "descricao", e.target.value)}
                        className="flex-1"
                      />

                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Valor"
                        value={sf.valor || ""}
                        onChange={(e) => updateSubfatura(index, "valor", Number(e.target.value))}
                        className="w-32"
                      />

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSubfatura(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}

                {subfaturas.length > 0 && (
                  <div className="flex justify-between items-center pt-3 border-t">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total subfaturas: </span>
                      <span className="font-semibold">{formatCurrency(totalSubfaturas)}</span>
                    </div>
                    {diferencaSubfaturas !== 0 && (
                      <div className={`text-sm flex items-center gap-1 ${diferencaSubfaturas > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                        <AlertCircle className="h-4 w-4" />
                        <span>
                          Diferença: {formatCurrency(Math.abs(diferencaSubfaturas))}
                          {diferencaSubfaturas > 0 ? " (falta)" : " (excede)"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documentos" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Documentos</CardTitle>
                    <CardDescription>
                      Boletos, notas fiscais e outros documentos
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload area */}
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Arraste arquivos ou clique para selecionar
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Select value={documentoTipo} onValueChange={(v: any) => setDocumentoTipo(v)}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="nf">Nota Fiscal</SelectItem>
                        <SelectItem value="demonstrativo">Demonstrativo</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <label>
                      <Input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        accept=".pdf,.xml,.jpg,.jpeg,.png"
                      />
                      <Button variant="outline" asChild>
                        <span>Selecionar Arquivos</span>
                      </Button>
                    </label>
                  </div>
                </div>

                {/* Files to upload */}
                {uploadingFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Arquivos para enviar:</p>
                    {uploadingFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{file.name}</span>
                          <Badge variant="outline">{documentoTipo}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeUploadingFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Existing documents */}
                {documentos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Documentos anexados:</p>
                    {documentos.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{doc.filename}</span>
                          <Badge variant="outline">{doc.tipo}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              const { data } = await supabase.storage
                                .from("faturamento_docs")
                                .createSignedUrl(doc.storage_path, 60);
                              if (data?.signedUrl) {
                                window.open(data.signedUrl, "_blank");
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDocumento(doc)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : mode === "create" ? "Criar Fatura" : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
