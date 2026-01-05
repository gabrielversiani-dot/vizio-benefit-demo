import { useState, useCallback, useRef, KeyboardEvent, ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface GridColumn {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validate?: (value: string) => string | null; // Returns error message or null
}

export interface GridRow {
  id: string;
  data: Record<string, string>;
  errors: Record<string, string>;
  status?: 'pending' | 'success' | 'error';
}

interface EditableGridProps {
  columns: GridColumn[];
  rows: GridRow[];
  onRowsChange: (rows: GridRow[]) => void;
  emptyMessage?: string;
}

export function EditableGrid({ columns, rows, onRowsChange, emptyMessage = "Nenhum registro. Clique em 'Adicionar' ou cole dados do Excel." }: EditableGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addRow = () => {
    const newRow: GridRow = {
      id: generateId(),
      data: columns.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {}),
      errors: {},
    };
    onRowsChange([...rows, newRow]);
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
            : Object.fromEntries(Object.entries(row.errors).filter(([k]) => k !== columnKey))
        };
      }
      return row;
    }));
  };

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTableElement>) => {
    const pastedData = e.clipboardData.getData('text');
    const lines = pastedData.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return;

    // Check if pasting multiple lines
    if (lines.length > 1) {
      e.preventDefault();
      
      const newRows: GridRow[] = lines.map(line => {
        const values = line.split('\t'); // Tab-separated for Excel
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
      toast.success(`${newRows.length} linha(s) colada(s) do Excel`);
    }
  }, [columns, rows, onRowsChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (e.key === 'Tab' && !e.shiftKey && colIndex === columns.length - 1 && rowIndex === rows.length - 1) {
      e.preventDefault();
      addRow();
      // Focus will be set after re-render
      setTimeout(() => {
        const inputs = tableRef.current?.querySelectorAll('input');
        const lastInput = inputs?.[inputs.length - columns.length];
        (lastInput as HTMLInputElement)?.focus();
      }, 0);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {rows.length} registro(s) • Dica: Cole dados do Excel (Ctrl+V)
        </p>
        <Button onClick={addRow} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table ref={tableRef} onPaste={handlePaste}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              {columns.map(col => (
                <TableHead key={col.key}>
                  {col.label}
                  {col.required && <span className="text-destructive ml-1">*</span>}
                </TableHead>
              ))}
              <TableHead className="w-20">Status</TableHead>
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
                <TableRow key={row.id} className={row.status === 'error' ? 'bg-destructive/5' : row.status === 'success' ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                  <TableCell className="text-muted-foreground text-sm">{rowIndex + 1}</TableCell>
                  {columns.map((col, colIndex) => (
                    <TableCell key={col.key} className="p-1">
                      {col.type === 'select' ? (
                        <Select
                          value={row.data[col.key] || ''}
                          onValueChange={(value) => updateCell(row.id, col.key, value)}
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
                        <Input
                          type={col.type}
                          value={row.data[col.key] || ''}
                          onChange={(e) => updateCell(row.id, col.key, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          placeholder={col.placeholder}
                          className={`h-9 ${row.errors[col.key] ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        />
                      )}
                      {row.errors[col.key] && (
                        <p className="text-xs text-destructive mt-1">{row.errors[col.key]}</p>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
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
                    {Object.keys(row.errors).length > 0 && !row.status && (
                      <Badge variant="outline" className="text-warning gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Revisar
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(row.id)}
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
  );
}
