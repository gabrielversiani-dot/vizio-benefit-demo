import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Save, AlertTriangle, Info, RefreshCw, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditableGrid, GridColumn, GridRow } from "../EditableGrid";
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
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v)) return 'Email inválido';
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
  const [lastResult, setLastResult] = useState<{ created: number; errors: number } | null>(null);
  const [existingRoles, setExistingRoles] = useState<ExistingRole[]>([]);

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

  const handleSave = async () => {
    // Validate all rows first
    const hasErrors = rows.some(row => Object.keys(row.errors).length > 0);
    const hasEmptyRequired = rows.some(row => !row.data.email?.trim() || !row.data.role);

    if (hasErrors || hasEmptyRequired) {
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    if (rows.length === 0) {
      toast.info('Adicione pelo menos uma função');
      return;
    }

    setIsSaving(true);
    let created = 0;
    let errors = 0;

    const updatedRows = [...rows];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Find profile by email
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', row.data.email)
          .maybeSingle();

        if (!profile) {
          errors++;
          updatedRows[i] = { 
            ...row, 
            status: 'error',
            errors: { ...row.errors, email: 'Usuário não encontrado' }
          };
          continue;
        }

        // Check if role already exists
        const existingRole = existingRoles.find(
          r => r.userId === profile.id && r.role === row.data.role
        );

        if (existingRole) {
          // Already has this role
          updatedRows[i] = { ...row, status: 'success' };
          continue;
        }

        // Insert role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: profile.id,
            role: row.data.role as AppRole,
          });

        if (error) {
          if (error.code === '23505') {
            // Duplicate - user already has this role
            updatedRows[i] = { ...row, status: 'success' };
          } else {
            throw error;
          }
        } else {
          created++;
          updatedRows[i] = { ...row, status: 'success' };
        }
      } catch (err: any) {
        console.error('Error adding role:', err);
        errors++;
        updatedRows[i] = { 
          ...row, 
          status: 'error',
          errors: { ...row.errors, _general: err.message }
        };
      }
    }

    setRows(updatedRows);
    setLastResult({ created, errors });
    onStatusUpdate({ created, errors });
    setIsSaving(false);

    // Reload existing roles
    await loadExistingRoles();

    if (errors === 0) {
      toast.success(`${created} função(ões) atribuída(s)`);
    } else {
      toast.error(`${created} atribuída(s), ${errors} erro(s)`);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Atribua funções (roles) aos usuários para definir suas permissões no sistema.
          Um usuário pode ter múltiplas funções.
        </AlertDescription>
      </Alert>

      {/* Existing Roles */}
      {existingRoles.length > 0 && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Funções já atribuídas</span>
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
          <div className="flex flex-wrap gap-2">
            {existingRoles.slice(0, 10).map((role, idx) => (
              <Badge key={idx} variant="outline" className="gap-1">
                {role.email}
                <span className="text-muted-foreground">→</span>
                <span className={role.role === 'admin_vizio' ? 'text-primary font-medium' : ''}>
                  {role.role}
                </span>
              </Badge>
            ))}
            {existingRoles.length > 10 && (
              <Badge variant="secondary">
                +{existingRoles.length - 10} mais
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
      />

      <Separator />

      <div className="flex items-center justify-between">
        {lastResult && (
          <div className="flex items-center gap-2 text-sm">
            {lastResult.errors === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            <span>
              Último salvamento: {lastResult.created} atribuída(s)
              {lastResult.errors > 0 && `, ${lastResult.errors} erro(s)`}
            </span>
          </div>
        )}
        <Button 
          onClick={handleSave} 
          disabled={isSaving || rows.length === 0}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Atribuir Funções
        </Button>
      </div>
    </div>
  );
}
