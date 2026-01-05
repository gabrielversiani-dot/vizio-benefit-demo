import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, FileDown, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  jobId: string;
  dataType: string;
  totalRows: number;
  statusFilter: string;
  searchQuery: string;
  filteredCount: number;
}

// Fields for beneficiarios CSV
const BENEFICIARIOS_FIELDS = [
  'row_number', 'status', 'cpf', 'nome_completo', 'tipo', 'titular_cpf',
  'data_nascimento', 'email', 'telefone', 'plano_saude', 'plano_vida',
  'plano_odonto', 'status_beneficiario', 'validation_errors', 'validation_warnings'
];

const DEFAULT_FIELDS = [
  'row_number', 'status', 'validation_errors', 'validation_warnings'
];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getFieldValue(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  const mapped = row.mapped_data as Record<string, unknown> | undefined;
  if (mapped && field in mapped) return mapped[field];
  if (field === 'status_beneficiario' && mapped) return mapped.status;
  return null;
}

export function ExportJobCSV({ jobId, dataType, totalRows, statusFilter, searchQuery, filteredCount }: Props) {
  const { toast } = useToast();
  const [exportingFiltered, setExportingFiltered] = useState(false);
  const [exportingComplete, setExportingComplete] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [showLargeExportWarning, setShowLargeExportWarning] = useState(false);

  const downloadBlob = (content: string, filename: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportFiltered = async () => {
    // Check if filtered count is too large for client-side
    if (filteredCount > 20000) {
      setShowLargeExportWarning(true);
      return;
    }

    setExportingFiltered(true);
    setProgress("Iniciando...");

    try {
      const PAGE_SIZE = 1000;
      const allRows: Record<string, unknown>[] = [];
      const totalPages = Math.ceil(filteredCount / PAGE_SIZE);
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        setProgress(`Baixando ${page + 1}/${totalPages} páginas...`);

        let query = supabase
          .from('import_job_rows')
          .select('row_number, status, mapped_data, validation_errors, validation_warnings')
          .eq('job_id', jobId)
          .order('row_number')
          .range(from, to);

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter as "valid" | "warning" | "error" | "duplicate" | "updated");
        }

        if (searchQuery && dataType === 'beneficiarios') {
          const searchTerm = `%${searchQuery}%`;
          query = query.or(`mapped_data->>cpf.ilike.${searchTerm},mapped_data->>nome_completo.ilike.${searchTerm}`);
        }

        const { data: rows, error } = await query;

        if (error) throw error;

        if (!rows || rows.length === 0) {
          hasMore = false;
        } else {
          allRows.push(...rows);
          if (rows.length < PAGE_SIZE) {
            hasMore = false;
          }
        }
        page++;
      }

      setProgress("Gerando CSV...");

      // Determine fields
      let fields = dataType === 'beneficiarios' ? [...BENEFICIARIOS_FIELDS] : [...DEFAULT_FIELDS];
      
      // Collect dynamic fields for non-beneficiarios
      if (dataType !== 'beneficiarios') {
        const dynamicFields = new Set<string>();
        allRows.forEach(row => {
          const mapped = row.mapped_data as Record<string, unknown> | undefined;
          if (mapped) {
            Object.keys(mapped).slice(0, 10).forEach(key => dynamicFields.add(key));
          }
        });
        if (dynamicFields.size > 0) {
          const errorIndex = fields.indexOf('validation_errors');
          fields.splice(errorIndex, 0, ...Array.from(dynamicFields).slice(0, 10));
        }
      }

      // Build CSV
      let csv = fields.join(';') + '\n';
      for (const row of allRows) {
        const values = fields.map(field => {
          let value = getFieldValue(row, field);
          if (Array.isArray(value)) value = value.join(' | ');
          return escapeCSV(value);
        });
        csv += values.join(';') + '\n';
      }

      // Download
      const timestamp = new Date().toISOString().slice(0, 10);
      const filterSuffix = statusFilter !== 'all' ? `_${statusFilter}` : '';
      const filename = `export${filterSuffix}_${timestamp}.csv`;
      downloadBlob(csv, filename);

      toast({
        title: "Exportação concluída!",
        description: `${allRows.length} linhas exportadas.`,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setExportingFiltered(false);
      setProgress("");
    }
  };

  const exportComplete = async () => {
    setExportingComplete(true);
    setProgress("Gerando CSV no servidor...");

    try {
      const { data, error } = await supabase.functions.invoke('export-import-job', {
        body: { jobId, statusFilter, searchQuery },
      });

      if (error) throw error;

      // The function returns CSV content directly
      if (typeof data === 'string') {
        const timestamp = new Date().toISOString().slice(0, 10);
        const filterSuffix = statusFilter !== 'all' ? `_${statusFilter}` : '';
        const filename = `export_completo${filterSuffix}_${timestamp}.csv`;
        downloadBlob(data, filename);

        toast({
          title: "Exportação concluída!",
          description: "Arquivo baixado com sucesso.",
        });
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        // Handle blob response
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `export_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Exportação concluída!",
          description: "Arquivo baixado com sucesso.",
        });
      }

    } catch (error) {
      console.error('Export complete error:', error);
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setExportingComplete(false);
      setProgress("");
    }
  };

  const isFiltered = statusFilter !== 'all' || searchQuery;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Export Filtered Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={exportFiltered}
          disabled={exportingFiltered || exportingComplete || filteredCount === 0}
        >
          {exportingFiltered ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {progress}
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              {isFiltered ? `Exportar Filtrado (${filteredCount})` : `Exportar Página (CSV)`}
            </>
          )}
        </Button>

        {/* Export Complete Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={exportComplete}
          disabled={exportingFiltered || exportingComplete || totalRows === 0}
        >
          {exportingComplete ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {progress}
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar Completo ({totalRows})
            </>
          )}
        </Button>
      </div>

      {/* Large Export Warning Dialog */}
      <AlertDialog open={showLargeExportWarning} onOpenChange={setShowLargeExportWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Exportação Grande
            </AlertDialogTitle>
            <AlertDialogDescription>
              A exportação filtrada possui mais de 20.000 linhas ({filteredCount.toLocaleString()}).
              Para evitar travamentos no navegador, recomendamos usar a exportação completa via servidor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={exportComplete}>
              Usar Exportação Servidor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
