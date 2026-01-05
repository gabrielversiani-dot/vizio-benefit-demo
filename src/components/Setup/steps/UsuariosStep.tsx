import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, Info, ShieldAlert, Eye, UserPlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditableGrid, GridColumn, GridRow } from "../EditableGrid";
import { PreviewApplyModal, PreviewItem } from "../PreviewApplyModal";
import { AIAssistantModal } from "../AIAssistantModal";
import { useSetupDraft } from "@/hooks/useSetupDraft";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface UsuariosStepProps {
  onStatusUpdate: (status: { created: number; errors: number }) => void;
}

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
    key: 'password',
    label: 'Senha',
    type: 'password',
    required: true,
    placeholder: 'Mínimo 6 caracteres',
    validate: (v) => {
      if (!v) return 'Senha é obrigatória';
      if (v.length < 6) return 'Mínimo 6 caracteres';
      return null;
    },
  },
  {
    key: 'nome_completo',
    label: 'Nome Completo',
    type: 'text',
    required: true,
    placeholder: 'Nome do usuário',
    validate: (v) => !v.trim() ? 'Nome é obrigatório' : null,
  },
];

export function UsuariosStep({ onStatusUpdate }: UsuariosStepProps) {
  const [rows, setRows] = useState<GridRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('');
  const [empresas, setEmpresas] = useState<{ id: string; nome: string; cnpj: string }[]>([]);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  const { saveDraft, getStepDraft, isLoaded } = useSetupDraft();

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

  // Load empresas
  useEffect(() => {
    const loadEmpresas = async () => {
      const { data } = await supabase.from('empresas').select('id, nome, cnpj').order('nome');
      if (data) setEmpresas(data);
    };
    loadEmpresas();
  }, []);

  // Load draft on mount
  useEffect(() => {
    if (isLoaded) {
      const draftData = getStepDraft('usuarios');
      if (draftData.length > 0) {
        setRows(draftData);
        toast.info('Rascunho restaurado', { description: `${draftData.length} usuário(s)` });
      }
    }
  }, [isLoaded, getStepDraft]);

  // Auto-save draft
  const handleAutoSave = (updatedRows: GridRow[]) => {
    saveDraft('usuarios', updatedRows);
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
      if (Object.keys(row.errors).length > 0) {
        items.push({
          identifier: row.data.email || `Linha ${i + 1}`,
          action: 'error',
          details: Object.values(row.errors).join(', '),
        });
        updatedRows[i] = { ...row, status: 'error' };
        continue;
      }

      if (!row.data.email?.trim() || !row.data.password || !row.data.nome_completo?.trim()) {
        items.push({
          identifier: row.data.email || `Linha ${i + 1}`,
          action: 'error',
          details: 'Campos obrigatórios não preenchidos',
        });
        updatedRows[i] = { ...row, status: 'error' };
        continue;
      }

      // Check if email already exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', row.data.email)
        .maybeSingle();

      if (existing) {
        items.push({
          identifier: row.data.email,
          action: 'skip',
          details: 'Email já cadastrado no sistema',
        });
        updatedRows[i] = { ...row, status: undefined, warnings: { email: 'Já existe' } };
      } else {
        items.push({
          identifier: row.data.email,
          action: 'create',
          details: row.data.nome_completo,
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
    const validRows = previewItems.filter(i => i.action === 'create');
    if (validRows.length === 0) {
      toast.info('Nenhum usuário novo para criar');
      setShowPreview(false);
      return;
    }

    setIsSaving(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        setIsSaving(false);
        return;
      }

      const usersToCreate = rows.filter(row => 
        previewItems.find(p => p.identifier === row.data.email && p.action === 'create')
      );

      const { data, error } = await supabase.functions.invoke('admin-create-users', {
        body: {
          empresaId: selectedEmpresa || undefined,
          users: usersToCreate.map(row => ({
            email: row.data.email,
            password: row.data.password,
            nome_completo: row.data.nome_completo,
          }))
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error(error.message || 'Erro ao criar usuários');
        setIsSaving(false);
        return;
      }

      // Update rows with results
      const updatedRows = rows.map(row => {
        const result = data.results?.find((r: any) => r.email === row.data.email);
        if (result?.success) {
          return { ...row, status: 'success' as const };
        } else if (result) {
          return { 
            ...row, 
            status: 'error' as const,
            errors: { ...row.errors, _general: result.error || 'Erro desconhecido' }
          };
        }
        return row;
      });

      setRows(updatedRows);
      
      const created = data.summary?.created || 0;
      const errors = data.summary?.errors || 0;
      
      onStatusUpdate({ created, errors });

      if (errors === 0) {
        toast.success(`${created} usuário(s) criado(s) com sucesso!`);
      } else {
        toast.error(`${created} criado(s), ${errors} erro(s). Verifique os detalhes.`);
      }

    } catch (err: any) {
      console.error('Error creating users:', err);
      toast.error(err.message || 'Erro ao criar usuários');
    }

    setIsSaving(false);
    setShowPreview(false);
  };

  const hasErrors = rows.some(row => Object.keys(row.errors).length > 0);

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Crie contas de acesso. O email será o login e o perfil será criado automaticamente.
          Os usuários terão acesso imediato (sem confirmação de email).
        </AlertDescription>
      </Alert>

      <Alert variant="destructive" className="border-warning/50 bg-warning/10 text-warning-foreground">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="text-foreground">
          <strong>Segurança:</strong> Esta operação requer permissão de admin.
          Senhas são definidas diretamente - oriente os usuários a alterá-las.
        </AlertDescription>
      </Alert>

      {/* Empresa selector */}
      <div className="space-y-2">
        <Label>Empresa (opcional - vincular automaticamente)</Label>
        <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
          <SelectTrigger className="w-full md:w-96">
            <SelectValue placeholder="Selecione uma empresa para vincular..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nenhuma (definir depois)</SelectItem>
            {empresas.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.nome} ({emp.cnpj})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <EditableGrid
        columns={columns}
        rows={rows}
        onRowsChange={setRows}
        emptyMessage="Nenhum usuário. Clique em 'Adicionar' ou cole do Excel."
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
            disabled={isSaving || hasErrors || rows.length === 0}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Criar Usuários
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewApplyModal
        open={showPreview}
        onOpenChange={setShowPreview}
        title="Usuários"
        items={previewItems}
        onConfirm={handleApply}
        isApplying={isSaving}
      />

      <AIAssistantModal
        open={showAIAssistant}
        onOpenChange={setShowAIAssistant}
        step="usuarios"
        currentRows={rows}
        onApplyParsed={handleAIParsed}
        onApplyCorrections={handleAICorrections}
        empresaId={selectedEmpresa}
      />
    </div>
  );
}
