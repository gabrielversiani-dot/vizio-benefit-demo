import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, Info, RefreshCw, Eye, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditableGrid, GridColumn, GridRow } from "../EditableGrid";
import { PreviewApplyModal, PreviewItem } from "../PreviewApplyModal";
import { UndoBanner } from "../UndoBanner";
import { AIAssistantModal } from "../AIAssistantModal";
import { useSetupDraft } from "@/hooks/useSetupDraft";
import { useSetupUndo } from "@/hooks/useSetupUndo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PerfisStepProps {
  onStatusUpdate: (status: { updated: number; errors: number }) => void;
}

export function PerfisStep({ onStatusUpdate }: PerfisStepProps) {
  const [rows, setRows] = useState<GridRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [empresas, setEmpresas] = useState<{ cnpj: string; id: string; nome: string }[]>([]);
  const [activeUndo, setActiveUndo] = useState<{ id: string; count: number; expiresAt: string } | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const hasRestoredRef = useRef(false);
  
  const { saveDraft, getStepDraft, clearStepDraft, isLoaded, wasRestoreShown, markRestoreShown } = useSetupDraft();
  const { createSnapshot, getSnapshot, removeSnapshot } = useSetupUndo();

  // Load empresas for validation
  useEffect(() => {
    const loadEmpresas = async () => {
      const { data } = await supabase.from('empresas').select('id, cnpj, nome');
      if (data) setEmpresas(data);
    };
    loadEmpresas();
  }, []);

  // Load draft on mount - only once
  useEffect(() => {
    if (!isLoaded || hasRestoredRef.current) return;
    
    const draftData = getStepDraft('perfis');
    if (draftData.length > 0) {
      setRows(draftData);
      hasRestoredRef.current = true;
      
      if (!wasRestoreShown('perfis')) {
        markRestoreShown('perfis');
        toast.info('Rascunho restaurado', { 
          description: `${draftData.length} perfil(is)`,
          action: { label: 'Dispensar', onClick: () => {} },
        });
      }
    }
  }, [isLoaded]);

  // Handle clearing draft
  const handleClearDraft = () => {
    clearStepDraft('perfis');
    setRows([]);
    toast.success('Rascunho limpo');
  };

  const columns: GridColumn[] = [
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: 'usuario@empresa.com',
      validate: (v) => {
        if (!v.trim()) return 'Email é obrigatório';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email inválido';
        return null;
      },
    },
    {
      key: 'empresa_cnpj',
      label: 'CNPJ da Empresa',
      type: 'text',
      required: true,
      placeholder: '00.000.000/0001-00',
      validate: (v) => {
        if (!v.trim()) return 'CNPJ é obrigatório';
        const found = empresas.find(e => e.cnpj === v);
        if (!found && empresas.length > 0) return 'Empresa não encontrada';
        return null;
      },
    },
    {
      key: 'cargo',
      label: 'Cargo',
      type: 'text',
      placeholder: 'Ex: Gerente de RH',
    },
    {
      key: 'telefone',
      label: 'Telefone',
      type: 'text',
      placeholder: '(00) 00000-0000',
    },
  ];

  const handleAutoSave = (updatedRows: GridRow[]) => {
    saveDraft('perfis', updatedRows);
  };

  // Handle AI parsed data
  const handleAIParsed = (parsedRows: Record<string, any>[]) => {
    const newRows: GridRow[] = parsedRows.map(() => ({
      id: crypto.randomUUID(),
      data: {},
      errors: {},
    }));
    
    parsedRows.forEach((data, i) => {
      newRows[i].data = data;
      columns.forEach(col => {
        if (col.validate) {
          const error = col.validate(data[col.key] || '');
          if (error) newRows[i].errors[col.key] = error;
        }
      });
    });
    
    setRows(prev => [...prev, ...newRows]);
  };

  const handleAICorrections = (corrections: Array<{ row: number; field: string; value: string }>) => {
    setRows(prev => {
      const updated = [...prev];
      corrections.forEach(c => {
        if (updated[c.row]) {
          updated[c.row] = {
            ...updated[c.row],
            data: { ...updated[c.row].data, [c.field]: c.value },
          };
          const col = columns.find(col => col.key === c.field);
          if (col?.validate) {
            const error = col.validate(c.value);
            if (error) {
              updated[c.row].errors = { ...updated[c.row].errors, [c.field]: error };
            } else {
              const { [c.field]: _, ...rest } = updated[c.row].errors;
              updated[c.row].errors = rest;
            }
          }
        }
      });
      return updated;
    });
  };

  const loadExistingProfiles = async () => {
    setIsLoading(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, cargo, telefone, empresa_id, empresas(cnpj)')
        .order('email');

      if (profiles) {
        const loadedRows: GridRow[] = profiles.map(p => ({
          id: p.id,
          data: {
            email: p.email,
            empresa_cnpj: (p.empresas as any)?.cnpj || '',
            cargo: p.cargo || '',
            telefone: p.telefone || '',
          },
          errors: {},
        }));
        setRows(loadedRows);
        saveDraft('perfis', loadedRows);
        toast.success(`${profiles.length} perfil(is) carregado(s)`);
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
      toast.error('Erro ao carregar perfis');
    }
    setIsLoading(false);
  };

  const handleValidate = async () => {
    setIsValidating(true);
    const items: PreviewItem[] = [];
    const updatedRows = [...rows];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      updatedRows[i] = { ...row, status: 'validating' };
      setRows([...updatedRows]);

      if (Object.keys(row.errors).length > 0 || !row.data.email?.trim() || !row.data.empresa_cnpj?.trim()) {
        items.push({
          identifier: row.data.email || `Linha ${i + 1}`,
          action: 'error',
          details: Object.values(row.errors).join(', ') || 'Campos obrigatórios não preenchidos',
        });
        updatedRows[i] = { ...row, status: 'error' };
        continue;
      }

      // Check profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, empresa_id, cargo, telefone')
        .eq('email', row.data.email)
        .maybeSingle();

      if (!profile) {
        items.push({
          identifier: row.data.email,
          action: 'error',
          details: 'Usuário não encontrado',
        });
        updatedRows[i] = { ...row, status: 'error' };
        continue;
      }

      // Check empresa exists
      const empresa = empresas.find(e => e.cnpj === row.data.empresa_cnpj);
      if (!empresa) {
        items.push({
          identifier: row.data.email,
          action: 'error',
          details: 'Empresa não encontrada',
        });
        updatedRows[i] = { ...row, status: 'error' };
        continue;
      }

      // Check if update is needed
      const changes: { field: string; from?: string; to: string }[] = [];
      if (profile.empresa_id !== empresa.id) {
        changes.push({ field: 'Empresa', to: empresa.nome });
      }
      if (row.data.cargo && profile.cargo !== row.data.cargo) {
        changes.push({ field: 'Cargo', from: profile.cargo || '-', to: row.data.cargo });
      }
      if (row.data.telefone && profile.telefone !== row.data.telefone) {
        changes.push({ field: 'Telefone', from: profile.telefone || '-', to: row.data.telefone });
      }

      if (changes.length === 0) {
        items.push({
          identifier: row.data.email,
          action: 'skip',
          details: 'Nenhuma alteração necessária',
        });
      } else {
        items.push({
          identifier: row.data.email,
          action: 'update',
          changes,
        });
      }
      updatedRows[i] = { ...row, status: undefined };
    }

    setRows(updatedRows);
    setPreviewItems(items);
    setIsValidating(false);
    setShowPreview(true);
  };

  const handleApply = async () => {
    setIsSaving(true);
    setProgress(0);
    
    let updated = 0;
    let errors = 0;
    const updatedRows = [...rows];
    const previousData: Record<string, any>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(Math.round(((i + 1) / rows.length) * 100));

      const previewItem = previewItems.find(p => p.identifier === row.data.email);
      if (previewItem?.action !== 'update') continue;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', row.data.email)
          .single();

        if (!profile) continue;

        const empresa = empresas.find(e => e.cnpj === row.data.empresa_cnpj);
        if (!empresa) continue;

        // Store previous data for undo
        previousData.push({ ...profile, _action: 'update' });

        const { error } = await supabase
          .from('profiles')
          .update({
            empresa_id: empresa.id,
            cargo: row.data.cargo || null,
            telefone: row.data.telefone || null,
          })
          .eq('id', profile.id);

        if (error) throw error;
        
        updated++;
        updatedRows[i] = { ...row, status: 'success' };
      } catch (err: any) {
        console.error('Error updating profile:', err);
        errors++;
        updatedRows[i] = { ...row, status: 'error', errors: { ...row.errors, _general: err.message } };
      }
    }

    setRows(updatedRows);
    onStatusUpdate({ updated, errors });
    setIsSaving(false);
    setShowPreview(false);

    if (updated > 0) {
      const snapshotId = createSnapshot('perfis', previousData, updatedRows.map(r => r.data));
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      setActiveUndo({ id: snapshotId, count: updated, expiresAt });
    }

    if (errors === 0) {
      toast.success(`${updated} perfil(is) atualizado(s)`);
    } else {
      toast.error(`${updated} atualizado(s), ${errors} erro(s)`);
    }
  };

  const handleUndo = async () => {
    if (!activeUndo) return;
    
    const snapshot = getSnapshot(activeUndo.id);
    if (!snapshot) {
      toast.error('Tempo para desfazer expirou');
      setActiveUndo(null);
      return;
    }

    setIsSaving(true);
    
    try {
      for (const item of snapshot.previousData) {
        const { _action, ...data } = item;
        await supabase.from('profiles').update({
          empresa_id: data.empresa_id,
          cargo: data.cargo,
          telefone: data.telefone,
        }).eq('id', data.id);
      }
      
      toast.success('Alterações desfeitas com sucesso');
      removeSnapshot(activeUndo.id);
      setActiveUndo(null);
      setRows(rows.map(r => ({ ...r, status: undefined })));
      onStatusUpdate({ updated: 0, errors: 0 });
      
    } catch (err: any) {
      console.error('Undo error:', err);
      toast.error('Erro ao desfazer: ' + err.message);
    }
    
    setIsSaving(false);
  };

  const hasErrors = rows.some(row => Object.keys(row.errors).length > 0);

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Vincule usuários às empresas e atualize informações de perfil.
          O email deve corresponder a um usuário já criado.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadExistingProfiles}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Carregar Perfis Existentes
        </Button>
      </div>

      <EditableGrid
        columns={columns}
        rows={rows}
        onRowsChange={setRows}
        emptyMessage="Nenhum perfil. Clique em 'Carregar Perfis' ou adicione manualmente."
        isLoading={isLoading}
        isSaving={isSaving}
        progress={isSaving ? progress : undefined}
        onAutoSave={handleAutoSave}
      />

      <Separator />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowAIAssistant(true)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Assistente IA
          </Button>
          
          {/* Clear Draft Button */}
          {rows.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  <Trash2 className="h-4 w-4" />
                  Limpar rascunho
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar rascunho?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso removerá todos os dados não salvos da etapa de Perfis.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearDraft}>Limpar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          {hasErrors && <span className="text-sm text-destructive">Corrija os erros antes de aplicar</span>}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleValidate} 
            disabled={isSaving || isValidating || rows.length === 0}
            className="gap-2"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Validar e Revisar
          </Button>
          <Button 
            onClick={handleValidate} 
            disabled={isSaving || hasErrors || rows.length === 0}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Salvar Perfis
          </Button>
        </div>
      </div>

      <PreviewApplyModal
        open={showPreview}
        onOpenChange={setShowPreview}
        title="Perfis"
        items={previewItems}
        onConfirm={handleApply}
        isApplying={isSaving}
      />

      {activeUndo && (
        <UndoBanner
          snapshotId={activeUndo.id}
          step="perfis"
          itemCount={activeUndo.count}
          expiresAt={activeUndo.expiresAt}
          onUndo={handleUndo}
          onDismiss={() => {
            removeSnapshot(activeUndo.id);
            setActiveUndo(null);
          }}
          isUndoing={isSaving}
        />
      )}

      <AIAssistantModal
        open={showAIAssistant}
        onOpenChange={setShowAIAssistant}
        step="perfis"
        currentRows={rows}
        onApplyParsed={handleAIParsed}
        onApplyCorrections={handleAICorrections}
      />
    </div>
  );
}
