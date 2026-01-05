import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, Save, AlertTriangle, Info, Eye, FileCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditableGrid, GridColumn, GridRow } from "../EditableGrid";
import { PreviewApplyModal, PreviewItem } from "../PreviewApplyModal";
import { UndoBanner } from "../UndoBanner";
import { AIAssistantModal } from "../AIAssistantModal";
import { useSetupDraft } from "@/hooks/useSetupDraft";
import { useSetupUndo } from "@/hooks/useSetupUndo";

interface EmpresasStepProps {
  onStatusUpdate: (status: { created: number; updated: number; errors: number }) => void;
}

// CNPJ validation
const validateCNPJ = (cnpj: string): boolean => {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let size = cleaned.length - 2;
  let numbers = cleaned.substring(0, size);
  const digits = cleaned.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  size = size + 1;
  numbers = cleaned.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits.charAt(1));
};

const columns: GridColumn[] = [
  {
    key: 'nome',
    label: 'Nome',
    type: 'text',
    required: true,
    placeholder: 'Nome fantasia',
    validate: (v) => !v.trim() ? 'Nome é obrigatório' : null,
  },
  {
    key: 'cnpj',
    label: 'CNPJ',
    type: 'text',
    required: true,
    placeholder: '00.000.000/0001-00',
    validate: (v) => {
      if (!v.trim()) return 'CNPJ é obrigatório';
      if (!validateCNPJ(v)) return 'CNPJ inválido';
      return null;
    },
  },
  {
    key: 'razao_social',
    label: 'Razão Social',
    type: 'text',
    placeholder: 'Razão social completa',
  },
  {
    key: 'contato_email',
    label: 'Email',
    type: 'email',
    placeholder: 'contato@empresa.com',
    validate: (v) => {
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email inválido';
      return null;
    },
  },
  {
    key: 'contato_telefone',
    label: 'Telefone',
    type: 'text',
    placeholder: '(00) 00000-0000',
  },
];

export function EmpresasStep({ onStatusUpdate }: EmpresasStepProps) {
  const [rows, setRows] = useState<GridRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeUndo, setActiveUndo] = useState<{ id: string; count: number; expiresAt: string } | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  const { saveDraft, getStepDraft, isLoaded } = useSetupDraft();
  const { createSnapshot, getSnapshot, removeSnapshot } = useSetupUndo();

  // Handle AI parsed data
  const handleAIParsed = (parsedRows: Record<string, any>[]) => {
    const newRows: GridRow[] = parsedRows.map(() => ({
      id: crypto.randomUUID(),
      data: {},
      errors: {},
    }));
    
    parsedRows.forEach((data, i) => {
      newRows[i].data = data;
      // Run validation
      columns.forEach(col => {
        if (col.validate) {
          const error = col.validate(data[col.key] || '');
          if (error) newRows[i].errors[col.key] = error;
        }
      });
    });
    
    setRows(prev => [...prev, ...newRows]);
  };

  // Handle AI corrections
  const handleAICorrections = (corrections: Array<{ row: number; field: string; value: string }>) => {
    setRows(prev => {
      const updated = [...prev];
      corrections.forEach(c => {
        if (updated[c.row]) {
          updated[c.row] = {
            ...updated[c.row],
            data: { ...updated[c.row].data, [c.field]: c.value },
          };
          // Re-validate
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

  // Load draft on mount
  useEffect(() => {
    if (isLoaded) {
      const draftData = getStepDraft('empresas');
      if (draftData.length > 0) {
        setRows(draftData);
        toast.info('Rascunho restaurado', { description: `${draftData.length} empresa(s)` });
      }
    }
  }, [isLoaded, getStepDraft]);

  // Auto-save draft
  const handleAutoSave = (updatedRows: GridRow[]) => {
    saveDraft('empresas', updatedRows);
  };

  // Validate all rows
  const handleValidate = async () => {
    setIsValidating(true);
    const items: PreviewItem[] = [];
    
    const updatedRows = [...rows];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      updatedRows[i] = { ...row, status: 'validating' };
      setRows([...updatedRows]);

      // Check if has validation errors
      if (Object.keys(row.errors).length > 0 || !row.data.nome?.trim() || !row.data.cnpj?.trim()) {
        items.push({
          identifier: row.data.cnpj || row.data.nome || `Linha ${i + 1}`,
          action: 'error',
          details: Object.values(row.errors).join(', ') || 'Campos obrigatórios não preenchidos',
        });
        updatedRows[i] = { ...row, status: 'error' };
        continue;
      }

      // Check if exists in database
      const { data: existing } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('cnpj', row.data.cnpj)
        .maybeSingle();

      if (existing) {
        items.push({
          identifier: row.data.cnpj,
          action: 'update',
          details: `Atualizar "${existing.nome}" → "${row.data.nome}"`,
        });
        updatedRows[i] = { ...row, status: undefined };
      } else {
        items.push({
          identifier: row.data.cnpj,
          action: 'create',
          details: row.data.nome,
        });
        updatedRows[i] = { ...row, status: undefined };
      }
    }

    setRows(updatedRows);
    setPreviewItems(items);
    setIsValidating(false);
    setShowPreview(true);
  };

  // Apply changes
  const handleApply = async () => {
    setIsSaving(true);
    setProgress(0);
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    const updatedRows = [...rows];
    const previousData: Record<string, any>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(Math.round(((i + 1) / rows.length) * 100));

      if (Object.keys(row.errors).length > 0) {
        errors++;
        updatedRows[i] = { ...row, status: 'error' };
        continue;
      }

      try {
        // Check if exists
        const { data: existing } = await supabase
          .from('empresas')
          .select('*')
          .eq('cnpj', row.data.cnpj)
          .maybeSingle();

        if (existing) {
          // Store previous data for undo
          previousData.push({ ...existing, _action: 'update' });
          
          // Update
          const { error: updateError } = await supabase
            .from('empresas')
            .update({
              nome: row.data.nome,
              razao_social: row.data.razao_social || null,
              contato_email: row.data.contato_email || null,
              contato_telefone: row.data.contato_telefone || null,
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
          updated++;
          updatedRows[i] = { ...row, status: 'success' };
        } else {
          // Insert
          const { data: inserted, error: insertError } = await supabase
            .from('empresas')
            .insert({
              nome: row.data.nome,
              cnpj: row.data.cnpj,
              razao_social: row.data.razao_social || null,
              contato_email: row.data.contato_email || null,
              contato_telefone: row.data.contato_telefone || null,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          
          previousData.push({ id: inserted.id, _action: 'create' });
          created++;
          updatedRows[i] = { ...row, status: 'success' };
        }
      } catch (err: any) {
        console.error('Error saving empresa:', err);
        errors++;
        updatedRows[i] = { ...row, status: 'error', errors: { ...row.errors, _general: err.message } };
      }
    }

    setRows(updatedRows);
    onStatusUpdate({ created, updated, errors });
    setIsSaving(false);
    setShowPreview(false);

    // Create undo snapshot
    if (created + updated > 0) {
      const snapshotId = createSnapshot('empresas', previousData, updatedRows.map(r => r.data));
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      setActiveUndo({ id: snapshotId, count: created + updated, expiresAt });
    }

    if (errors === 0) {
      toast.success(`${created} criada(s), ${updated} atualizada(s)`);
    } else {
      toast.error(`${errors} erro(s). Verifique os registros.`);
    }
  };

  // Undo changes
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
        if (item._action === 'create') {
          // Delete created item
          await supabase.from('empresas').delete().eq('id', item.id);
        } else if (item._action === 'update') {
          // Restore previous values
          const { _action, ...data } = item;
          await supabase.from('empresas').update(data).eq('id', data.id);
        }
      }
      
      toast.success('Alterações desfeitas com sucesso');
      removeSnapshot(activeUndo.id);
      setActiveUndo(null);
      
      // Reset row statuses
      setRows(rows.map(r => ({ ...r, status: undefined })));
      onStatusUpdate({ created: 0, updated: 0, errors: 0 });
      
    } catch (err: any) {
      console.error('Undo error:', err);
      toast.error('Erro ao desfazer: ' + err.message);
    }
    
    setIsSaving(false);
  };

  const hasErrors = rows.some(row => Object.keys(row.errors).length > 0);
  const hasEmptyRequired = rows.some(row => !row.data.nome?.trim() || !row.data.cnpj?.trim());

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Cadastre as empresas do sistema. O CNPJ é a chave única - empresas existentes serão atualizadas.
          Seu progresso é salvo automaticamente como rascunho.
        </AlertDescription>
      </Alert>

      <EditableGrid
        columns={columns}
        rows={rows}
        onRowsChange={setRows}
        emptyMessage="Nenhuma empresa. Clique em 'Adicionar' ou cole do Excel."
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
            disabled={isSaving || hasErrors || hasEmptyRequired || rows.length === 0}
            className="gap-2"
          >
            <FileCheck className="h-4 w-4" />
            Aplicar
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewApplyModal
        open={showPreview}
        onOpenChange={setShowPreview}
        title="Empresas"
        items={previewItems}
        onConfirm={handleApply}
        isApplying={isSaving}
      />

      {/* Undo Banner */}
      {activeUndo && (
        <UndoBanner
          snapshotId={activeUndo.id}
          step="empresas"
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
      {/* AI Assistant Modal */}
      <AIAssistantModal
        open={showAIAssistant}
        onOpenChange={setShowAIAssistant}
        step="empresas"
        currentRows={rows}
        onApplyParsed={handleAIParsed}
        onApplyCorrections={handleAICorrections}
      />
    </div>
  );
}
