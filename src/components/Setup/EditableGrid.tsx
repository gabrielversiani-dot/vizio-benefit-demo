import { useState, useCallback, useRef, KeyboardEvent, ClipboardEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, AlertCircle, CheckCircle2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface GridColumn {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validate?: (value: string) => string | null;
}

export interface GridRow {
  id: string;
  data: Record<string, string>;
  errors: Record<string, string>;
  warnings?: Record<string, string>;
  status?: 'pending' | 'success' | 'error' | 'validating';
  previousData?: Record<string, string>; // For undo
}

interface EditableGridProps {
  columns: GridColumn[];
  rows: GridRow[];
  onRowsChange: (rows: GridRow[]) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  progress?: number; // 0-100 for save progress
  onAutoSave?: (rows: GridRow[]) => void;
  autoSaveDelay?: number;
}

export function EditableGrid({ 
  columns, 
  rows, 
  onRowsChange, 
  emptyMessage = "Nenhum registro. Clique em 'Adicionar' ou cole dados do Excel.",
  isLoading = false,
  isSaving = false,
  progress,
  onAutoSave,
  autoSaveDelay = 1000,
}: EditableGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Auto-save draft on changes
  useEffect(() => {
    if (onAutoSave && rows.length > 0) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        onAutoSave(rows);
      }, autoSaveDelay);
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [rows, onAutoSave, autoSaveDelay]);

  const addRow = () => {
    const newRow: GridRow = {
      id: generateId(),
      data: columns.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {}),
      errors: {},
    };
    onRowsChange([...rows, newRow]);
  };

  const addMultipleRows = (count: number = 5) => {
    const newRows: GridRow[] = Array.from({ length: count }, () => ({
      id: generateId(),
      data: columns.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {}),
      errors: {},
    }));
    onRowsChange([...rows, ...newRows]);
  };

  const removeRow = (id: string) => {
    onRowsChange(rows.filter(row => row.id !== id));
  };

  const updateCell = (rowId: string, columnKey: string, value: string) => {
    const column = columns.find(c => c.key === columnKey);
    const error = column?.validate ? column.validate(value) : null;

    onRowsChange(rows.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          data: { ...row.data, [columnKey]: value },
          errors: error 
            ? { ...row.errors, [columnKey]: error }
            : Object.fromEntries(Object.entries(row.errors).filter(([k]) => k !== columnKey)),
          status: undefined, // Reset status on edit
        };
      }
      return row;
    }));
  };

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTableElement>) => {
    const pastedData = e.clipboardData.getData('text');
    const lines = pastedData.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) return;

    e.preventDefault();
    
    const newRows: GridRow[] = lines.map(line => {
      // Support both tab and semicolon separators
      const values = line.includes('\t') ? line.split('\t') : line.split(';');
      const data: Record<string, string> = {};
      const errors: Record<string, string> = {};
      
      columns.forEach((col, index) => {
        const value = values[index]?.trim() || '';
        data[col.key] = value;
        
        if (col.validate) {
          const error = col.validate(value);
          if (error) errors[col.key] = error;
        }
      });

      return {
        id: generateId(),
        data,
        errors,
      };
    });

    onRowsChange([...rows, ...newRows]);
    toast.success(`${newRows.length} linha(s) colada(s)`);
  }, [columns, rows, onRowsChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (e.key === 'Tab' && !e.shiftKey && colIndex === columns.length - 1 && rowIndex === rows.length - 1) {
      e.preventDefault();
      addRow();
      setTimeout(() => {
        const inputs = tableRef.current?.querySelectorAll('input');
        const lastInput = inputs?.[inputs.length - columns.length];
        (lastInput as HTMLInputElement)?.focus();
      }, 0);
    }
    
    // Navigate with arrow keys
    if (e.key === 'ArrowDown' && rowIndex < rows.length - 1) {
      e.preventDefault();
      const inputs = tableRef.current?.querySelectorAll(`tr:nth-child(${rowIndex + 3}) input`);
      (inputs?.[colIndex] as HTMLInputElement)?.focus();
    }
    if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const inputs = tableRef.current?.querySelectorAll(`tr:nth-child(${rowIndex + 1}) input`);
      (inputs?.[colIndex] as HTMLInputElement)?.focus();
    }
  };

  const totalErrors = rows.reduce((sum, row) => sum + Object.keys(row.errors).length, 0);
  const completedRows = rows.filter(row => 
    columns.every(col => !col.required || row.data[col.key]?.trim())
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 border rounded-lg bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats and actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {rows.length} registro(s)
            {completedRows > 0 && ` • ${completedRows} completo(s)`}
            {totalErrors > 0 && (
              <span className="text-destructive ml-1">• {totalErrors} erro(s)</span>
            )}
          </p>
          {isSaving && progress !== undefined && (
            <div className="flex items-center gap-2 w-32">
              <Progress value={progress} className="h-2" />
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => addMultipleRows(5)}>
            +5 Linhas
          </Button>
          <Button onClick={addRow} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[400px] overflow-auto">
          <Table ref={tableRef} onPaste={handlePaste}>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                {columns.map(col => (
                  <TableHead key={col.key}>
                    {col.label}
                    {col.required && <span className="text-destructive ml-1">*</span>}
                  </TableHead>
                ))}
                <TableHead className="w-20 text-center">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 3} className="h-24 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, rowIndex) => (
                  <TableRow 
                    key={row.id} 
                    className={
                      row.status === 'error' ? 'bg-destructive/5' : 
                      row.status === 'success' ? 'bg-green-50 dark:bg-green-950/20' : 
                      row.status === 'validating' ? 'bg-blue-50 dark:bg-blue-950/20' :
                      Object.keys(row.errors).length > 0 ? 'bg-warning/5' : ''
                    }
                  >
                    <TableCell className="text-muted-foreground text-sm text-center">{rowIndex + 1}</TableCell>
                    {columns.map((col, colIndex) => (
                      <TableCell key={col.key} className="p-1">
                        {col.type === 'select' ? (
                          <Select
                            value={row.data[col.key] || ''}
                            onValueChange={(value) => updateCell(row.id, col.key, value)}
                            disabled={isSaving}
                          >
                            <SelectTrigger className={`h-9 ${row.errors[col.key] ? 'border-destructive' : ''}`}>
                              <SelectValue placeholder={col.placeholder || 'Selecione...'} />
                            </SelectTrigger>
                            <SelectContent>
                              {col.options?.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div>
                            <Input
                              type={col.type}
                              value={row.data[col.key] || ''}
                              onChange={(e) => updateCell(row.id, col.key, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                              placeholder={col.placeholder}
                              disabled={isSaving}
                              className={`h-9 ${
                                row.errors[col.key] ? 'border-destructive focus-visible:ring-destructive' : 
                                row.warnings?.[col.key] ? 'border-warning' : ''
                              }`}
                            />
                            {row.errors[col.key] && (
                              <p className="text-xs text-destructive mt-0.5 truncate" title={row.errors[col.key]}>
                                {row.errors[col.key]}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      {row.status === 'success' && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          OK
                        </Badge>
                      )}
                      {row.status === 'error' && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Erro
                        </Badge>
                      )}
                      {row.status === 'validating' && (
                        <Badge variant="secondary" className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </Badge>
                      )}
                      {Object.keys(row.errors).length > 0 && !row.status && (
                        <Badge variant="outline" className="text-warning border-warning gap-1">
                          <AlertCircle className="h-3 w-3" />
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(row.id)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer hint */}
      <p className="text-xs text-muted-foreground">
        💡 Dica: Cole dados do Excel/Sheets (Ctrl+V), use Tab para navegar, setas ↑↓ para mover entre linhas
      </p>
    </div>
  );
}
