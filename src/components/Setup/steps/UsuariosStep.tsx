import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, Save, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditableGrid, GridColumn, GridRow } from "../EditableGrid";

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
  const [lastResult, setLastResult] = useState<{ created: number; errors: number } | null>(null);

  const handleSave = async () => {
    // Validate all rows first
    const hasErrors = rows.some(row => Object.keys(row.errors).length > 0);
    const hasEmptyRequired = rows.some(row => 
      !row.data.email?.trim() || !row.data.password?.trim() || !row.data.nome_completo?.trim()
    );

    if (hasErrors || hasEmptyRequired) {
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    if (rows.length === 0) {
      toast.info('Adicione pelo menos um usuário');
      return;
    }

    setIsSaving(true);

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        setIsSaving(false);
        return;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('admin-create-users', {
        body: {
          users: rows.map(row => ({
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
        } else {
          return { 
            ...row, 
            status: 'error' as const,
            errors: { ...row.errors, _general: result?.error || 'Erro desconhecido' }
          };
        }
      });

      setRows(updatedRows);
      
      const created = data.summary?.created || 0;
      const errors = data.summary?.errors || 0;
      
      setLastResult({ created, errors });
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
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Crie contas de acesso para os usuários. O email será o login e o perfil será criado automaticamente.
          Os usuários receberão acesso imediato (sem confirmação de email).
        </AlertDescription>
      </Alert>

      <Alert variant="destructive" className="border-warning/50 bg-warning/10 text-warning-foreground">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="text-foreground">
          <strong>Importante:</strong> Esta operação requer permissão de <code className="text-xs bg-muted px-1 py-0.5 rounded">admin_vizio</code>.
          As senhas são definidas diretamente - oriente os usuários a alterá-las no primeiro acesso.
        </AlertDescription>
      </Alert>

      <EditableGrid
        columns={columns}
        rows={rows}
        onRowsChange={setRows}
        emptyMessage="Nenhum usuário. Clique em 'Adicionar' ou cole do Excel."
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
              Último salvamento: {lastResult.created} criado(s)
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
          Criar Usuários
        </Button>
      </div>
    </div>
  );
}
