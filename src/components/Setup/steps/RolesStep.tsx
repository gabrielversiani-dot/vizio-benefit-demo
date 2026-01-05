import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Info, RefreshCw, Shield, Eye, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditableGrid, GridColumn, GridRow } from "../EditableGrid";
import { PreviewApplyModal, PreviewItem } from "../PreviewApplyModal";
import { UndoBanner } from "../UndoBanner";
import { useSetupDraft } from "@/hooks/useSetupDraft";
import { useSetupUndo } from "@/hooks/useSetupUndo";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database['public']['Enums']['app_role'];

interface RolesStepProps {
  onStatusUpdate: (status: { created: number; errors: number }) => void;
}

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'admin_vizio', label: 'Admin Vizio (Super Admin)' },
  { value: 'admin_empresa', label: 'Admin Empresa' },
  { value: 'rh_gestor', label: 'RH Gestor' },
  { value: 'visualizador', label: 'Visualizador' },
];

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
    key: 'role',
    label: 'Função',
    type: 'select',
    required: true,
    placeholder: 'Selecione uma função',
    options: roleOptions,
    validate: (v) => !v ? 'Função é obrigatória' : null,
  },
];

interface ExistingRole {
  email: string;
  role: AppRole;
  userId: string;
}

export function RolesStep({ onStatusUpdate }: RolesStepProps) {
  const [rows, setRows] = useState<GridRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [existingRoles, setExistingRoles] = useState<ExistingRole[]>([]);
  const [activeUndo, setActiveUndo] = useState<{ id: string; count: number; expiresAt: string } | null>(null);

  const { saveDraft, getStepDraft, isLoaded } = useSetupDraft();
  const { createSnapshot, getSnapshot, removeSnapshot } = useSetupUndo();

  const loadExistingRoles = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, role, profiles!inner(email)')
        .order('created_at', { ascending: false });

      if (data) {
        const roles: ExistingRole[] = data.map(r => ({
          userId: r.user_id,
          role: r.role,
          email: (r.profiles as any).email,
        }));
        setExistingRoles(roles);
      }
    } catch (err) {
      console.error('Error loading roles:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadExistingRoles();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const draftData = getStepDraft('roles');
      if (draftData.length > 0) {
        setRows(draftData);
        toast.info('Rascunho restaurado', { description: `${draftData.length} função(ões)` });
      }
    }
  }, [isLoaded, getStepDraft]);

  const handleAutoSave = (updatedRows: GridRow[]) => {
    saveDraft('roles', updatedRows);
  };

  const handleValidate = async () => {
    setIsValidating(true);
    const items: PreviewItem[] = [];
    const updatedRows = [...rows];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      updatedRows[i] = { ...row, status: 'validating' };
      setRows([...updatedRows]);

      if (Object.keys(row.errors).length > 0 || !row.data.email?.trim() || !row.data.role) {
        items.push({
          identifier: `${row.data.email || 'Linha ' + (i + 1)} → ${row.data.role || '?'}`,
          action: 'error',
          details: Object.values(row.errors).join(', ') || 'Campos obrigatórios não preenchidos',
        });
        updatedRows[i] = { ...row, status: 'error' };
        continue;
      }

      // Check profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', row.data.email)
        .maybeSingle();

      if (!profile) {
        items.push({
          identifier: `${row.data.email} → ${row.data.role}`,
          action: 'error',
          details: 'Usuário não encontrado',
        });
        updatedRows[i] = { ...row, status: 'error' };
        continue;
      }

      // Check if role already exists
      const existingRole = existingRoles.find(
        r => r.email === row.data.email && r.role === row.data.role
      );

      if (existingRole) {
        items.push({
          identifier: `${row.data.email} → ${row.data.role}`,
          action: 'skip',
          details: 'Função já atribuída',
        });
      } else {
        items.push({
          identifier: `${row.data.email} → ${row.data.role}`,
          action: 'create',
          details: roleOptions.find(r => r.value === row.data.role)?.label || row.data.role,
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
    
    let created = 0;
    let errors = 0;
    const updatedRows = [...rows];
    const createdRoleIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(Math.round(((i + 1) / rows.length) * 100));

      const previewItem = previewItems.find(p => p.identifier === `${row.data.email} → ${row.data.role}`);
      if (previewItem?.action !== 'create') continue;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', row.data.email)
          .single();

        if (!profile) continue;

        const { data: inserted, error } = await supabase
          .from('user_roles')
          .insert({
            user_id: profile.id,
            role: row.data.role as AppRole,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            updatedRows[i] = { ...row, status: 'success' };
            continue;
          }
          throw error;
        }

        createdRoleIds.push(inserted.id);
        created++;
        updatedRows[i] = { ...row, status: 'success' };

      } catch (err: any) {
        console.error('Error adding role:', err);
        errors++;
        updatedRows[i] = { ...row, status: 'error', errors: { ...row.errors, _general: err.message } };
      }
    }

    setRows(updatedRows);
    onStatusUpdate({ created, errors });
    setIsSaving(false);
    setShowPreview(false);
    await loadExistingRoles();

    if (created > 0) {
      const snapshotId = createSnapshot(
        'roles', 
        createdRoleIds.map(id => ({ id, _action: 'create' })), 
        updatedRows.map(r => r.data)
      );
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      setActiveUndo({ id: snapshotId, count: created, expiresAt });
    }

    if (errors === 0) {
      toast.success(`${created} função(ões) atribuída(s)`);
    } else {
      toast.error(`${created} atribuída(s), ${errors} erro(s)`);
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
        if (item._action === 'create') {
          await supabase.from('user_roles').delete().eq('id', item.id);
        }
      }
      
      toast.success('Alterações desfeitas com sucesso');
      removeSnapshot(activeUndo.id);
      setActiveUndo(null);
      setRows(rows.map(r => ({ ...r, status: undefined })));
      onStatusUpdate({ created: 0, errors: 0 });
      await loadExistingRoles();
      
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
          Atribua funções (roles) aos usuários para definir suas permissões.
          Um usuário pode ter múltiplas funções.
        </AlertDescription>
      </Alert>

      {/* Existing Roles */}
      {existingRoles.length > 0 && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Funções já atribuídas ({existingRoles.length})</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadExistingRoles}
              disabled={isLoading}
              className="ml-auto h-7"
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-auto">
            {existingRoles.slice(0, 15).map((role, idx) => (
              <Badge key={idx} variant="outline" className="gap-1 text-xs">
                {role.email}
                <span className="text-muted-foreground">→</span>
                <span className={role.role === 'admin_vizio' ? 'text-primary font-medium' : ''}>
                  {role.role}
                </span>
              </Badge>
            ))}
            {existingRoles.length > 15 && (
              <Badge variant="secondary" className="text-xs">
                +{existingRoles.length - 15} mais
              </Badge>
            )}
          </div>
        </div>
      )}

      <EditableGrid
        columns={columns}
        rows={rows}
        onRowsChange={setRows}
        emptyMessage="Nenhuma função. Clique em 'Adicionar' para atribuir funções aos usuários."
        isSaving={isSaving}
        progress={isSaving ? progress : undefined}
        onAutoSave={handleAutoSave}
      />

      <Separator />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {hasErrors && <span className="text-destructive">Corrija os erros antes de aplicar</span>}
        </p>
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
            Atribuir Funções
          </Button>
        </div>
      </div>

      <PreviewApplyModal
        open={showPreview}
        onOpenChange={setShowPreview}
        title="Funções"
        items={previewItems}
        onConfirm={handleApply}
        isApplying={isSaving}
      />

      {activeUndo && (
        <UndoBanner
          snapshotId={activeUndo.id}
          step="roles"
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
    </div>
  );
}
