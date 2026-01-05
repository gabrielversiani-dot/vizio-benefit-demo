import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, Save, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditableGrid, GridColumn, GridRow } from "../EditableGrid";

interface EmpresasStepProps {
  onStatusUpdate: (status: { created: number; updated: number; errors: number }) => void;
}

// CNPJ validation
const validateCNPJ = (cnpj: string): boolean => {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  
  // Check for repeated digits
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  // Validate check digits
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

const formatCNPJ = (value: string): string => {
  const cleaned = value.replace(/\D/g, '').slice(0, 14);
  return cleaned.replace(
    /^(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/,
    (_, p1, p2, p3, p4, p5) => {
      let result = p1;
      if (p2) result += '.' + p2;
      if (p3) result += '.' + p3;
      if (p4) result += '/' + p4;
      if (p5) result += '-' + p5;
      return result;
    }
  );
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
  const [lastResult, setLastResult] = useState<{ created: number; updated: number; errors: number } | null>(null);

  const handleSave = async () => {
    // Validate all rows first
    const hasErrors = rows.some(row => Object.keys(row.errors).length > 0);
    const hasEmptyRequired = rows.some(row => !row.data.nome?.trim() || !row.data.cnpj?.trim());

    if (hasErrors || hasEmptyRequired) {
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    if (rows.length === 0) {
      toast.info('Adicione pelo menos uma empresa');
      return;
    }

    setIsSaving(true);
    let created = 0;
    let updated = 0;
    let errors = 0;

    const updatedRows = [...rows];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cnpj = row.data.cnpj.replace(/\D/g, '');
      
      try {
        // Check if exists
        const { data: existing } = await supabase
          .from('empresas')
          .select('id')
          .eq('cnpj', row.data.cnpj)
          .maybeSingle();

        if (existing) {
          // Update
          const { error } = await supabase
            .from('empresas')
            .update({
              nome: row.data.nome,
              razao_social: row.data.razao_social || null,
              contato_email: row.data.contato_email || null,
              contato_telefone: row.data.contato_telefone || null,
            })
            .eq('id', existing.id);

          if (error) throw error;
          updated++;
          updatedRows[i] = { ...row, status: 'success' };
        } else {
          // Insert
          const { error } = await supabase
            .from('empresas')
            .insert({
              nome: row.data.nome,
              cnpj: row.data.cnpj,
              razao_social: row.data.razao_social || null,
              contato_email: row.data.contato_email || null,
              contato_telefone: row.data.contato_telefone || null,
            });

          if (error) throw error;
          created++;
          updatedRows[i] = { ...row, status: 'success' };
        }
      } catch (err: any) {
        console.error('Error saving empresa:', err);
        errors++;
        updatedRows[i] = { 
          ...row, 
          status: 'error',
          errors: { ...row.errors, _general: err.message }
        };
      }
    }

    setRows(updatedRows);
    setLastResult({ created, updated, errors });
    onStatusUpdate({ created, updated, errors });
    setIsSaving(false);

    if (errors === 0) {
      toast.success(`${created} criada(s), ${updated} atualizada(s)`);
    } else {
      toast.error(`${errors} erro(s). Verifique os registros.`);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Cadastre as empresas que usarão o sistema. O CNPJ é a chave única - 
          se já existir, os dados serão atualizados. Você pode colar linhas do Excel.
        </AlertDescription>
      </Alert>

      <EditableGrid
        columns={columns}
        rows={rows}
        onRowsChange={setRows}
        emptyMessage="Nenhuma empresa. Clique em 'Adicionar' ou cole do Excel."
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
              Último salvamento: {lastResult.created} criada(s), {lastResult.updated} atualizada(s)
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
          Salvar Empresas
        </Button>
      </div>
    </div>
  );
}
