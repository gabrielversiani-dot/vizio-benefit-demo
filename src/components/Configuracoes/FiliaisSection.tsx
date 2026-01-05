import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building2, Plus, Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

type Entidade = {
  id: string;
  empresa_id: string;
  nome: string;
  tipo: "coligada" | "subestipulante";
  cnpj: string | null;
  ativo: boolean;
  created_at: string;
};

type Empresa = {
  id: string;
  nome: string;
};

export function FiliaisSection() {
  const queryClient = useQueryClient();
  const { empresaSelecionada, isAdminVizio } = useEmpresa();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form state
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"coligada" | "subestipulante">("coligada");
  const [cnpj, setCnpj] = useState("");
  const [empresaId, setEmpresaId] = useState("");

  // Fetch empresas (for admin_vizio)
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
    enabled: isAdminVizio,
  });

  // Fetch entidades/filiais
  const { data: entidades = [], isLoading } = useQuery({
    queryKey: ["faturamento-entidades", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("faturamento_entidades")
        .select("*")
        .order("nome");
      
      if (empresaSelecionada) {
        query = query.eq("empresa_id", empresaSelecionada);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Entidade[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { nome: string; tipo: "coligada" | "subestipulante"; cnpj: string | null; empresa_id: string }) => {
      const { error } = await supabase
        .from("faturamento_entidades")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Filial/Entidade criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["faturamento-entidades"] });
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar filial/entidade");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { nome: string; tipo: "coligada" | "subestipulante"; cnpj: string | null } }) => {
      const { error } = await supabase
        .from("faturamento_entidades")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Filial/Entidade atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["faturamento-entidades"] });
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar filial/entidade");
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("faturamento_entidades")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamento-entidades"] });
      toast.success("Status atualizado!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar status");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("faturamento_entidades")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Filial/Entidade excluída!");
      queryClient.invalidateQueries({ queryKey: ["faturamento-entidades"] });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir. Pode haver faturas vinculadas.");
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setNome("");
    setTipo("coligada");
    setCnpj("");
    setEmpresaId("");
  };

  const handleEdit = (entidade: Entidade) => {
    setEditingId(entidade.id);
    setNome(entidade.nome);
    setTipo(entidade.tipo);
    setCnpj(entidade.cnpj || "");
    setEmpresaId(entidade.empresa_id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const targetEmpresaId = empresaSelecionada || empresaId;
    if (!targetEmpresaId) {
      toast.error("Selecione uma empresa");
      return;
    }

    const data = {
      nome: nome.trim(),
      tipo,
      cnpj: cnpj.trim() || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate({ ...data, empresa_id: targetEmpresaId });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Filiais e Entidades</CardTitle>
                <CardDescription>
                  Coligadas e subestipulantes para faturamento
                </CardDescription>
              </div>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nova Filial
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Form */}
          {showForm && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
              <h4 className="font-medium">{editingId ? "Editar Filial" : "Nova Filial"}</h4>
              
              {/* Empresa selector (only for admin_vizio without selected empresa) */}
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

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Matriz, Unidade Contagem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as "coligada" | "subestipulante")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coligada">Coligada</SelectItem>
                      <SelectItem value="subestipulante">Subestipulante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CNPJ (opcional)</Label>
                  <Input
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={resetForm} disabled={isPending}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  {editingId ? "Salvar" : "Criar"}
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entidades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma filial ou entidade cadastrada</p>
              <p className="text-sm">Clique em "Nova Filial" para adicionar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entidades.map((entidade) => (
                  <TableRow key={entidade.id}>
                    <TableCell className="font-medium">{entidade.nome}</TableCell>
                    <TableCell>
                      <Badge variant={entidade.tipo === "coligada" ? "default" : "secondary"}>
                        {entidade.tipo === "coligada" ? "Coligada" : "Subestipulante"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entidade.cnpj || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={entidade.ativo ? "default" : "outline"}
                        className={entidade.ativo ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : ""}
                      >
                        {entidade.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActiveMutation.mutate({ id: entidade.id, ativo: !entidade.ativo })}
                          title={entidade.ativo ? "Desativar" : "Ativar"}
                        >
                          {entidade.ativo ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(entidade)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(entidade.id)}
                          title="Excluir"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir filial/entidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Se houver faturas vinculadas a esta entidade, a exclusão falhará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
