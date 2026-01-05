import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, Save, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditableGrid, GridColumn, GridRow } from "../EditableGrid";

interface PerfisStepProps {
  onStatusUpdate: (status: { updated: number; errors: number }) => void;
}

export function PerfisStep({ onStatusUpdate }: PerfisStepProps) {
  const [rows, setRows] = useState<GridRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ updated: number; errors: number } | null>(null);
  const [empresas, setEmpresas] = useState<{ cnpj: string; id: string; nome: string }[]>([]);

  // Load empresas for validation
  useEffect(() => {
    const loadEmpresas = async () => {
      const { data } = await supabase.from('empresas').select('id, cnpj, nome');
      if (data) setEmpresas(data);
    };
    loadEmpresas();
  }, []);

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
        toast.success(`${profiles.length} perfil(is) carregado(s)`);
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
      toast.error('Erro ao carregar perfis');
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    // Validate all rows first
    const hasErrors = rows.some(row => Object.keys(row.errors).length > 0);
    const hasEmptyRequired = rows.some(row => !row.data.email?.trim() || !row.data.empresa_cnpj?.trim());

    if (hasErrors || hasEmptyRequired) {
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    if (rows.length === 0) {
      toast.info('Adicione pelo menos um perfil');
      return;
    }

    setIsSaving(true);
    let updated = 0;
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

        // Find empresa by CNPJ
        const empresa = empresas.find(e => e.cnpj === row.data.empresa_cnpj);
        if (!empresa) {
          errors++;
          updatedRows[i] = { 
            ...row, 
            status: 'error',
            errors: { ...row.errors, empresa_cnpj: 'Empresa não encontrada' }
          };
          continue;
        }

        // Update profile
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
        updatedRows[i] = { 
          ...row, 
          status: 'error',
          errors: { ...row.errors, _general: err.message }
        };
      }
    }

    setRows(updatedRows);
    setLastResult({ updated, errors });
    onStatusUpdate({ updated, errors });
    setIsSaving(false);

    if (errors === 0) {
      toast.success(`${updated} perfil(is) atualizado(s)`);
    } else {
      toast.error(`${updated} atualizado(s), ${errors} erro(s)`);
    }
  };

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
              Último salvamento: {lastResult.updated} atualizado(s)
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
          Salvar Perfis
        </Button>
      </div>
    </div>
  );
}
