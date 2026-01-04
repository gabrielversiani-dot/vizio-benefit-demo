import { useState, useCallback } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ImportCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
}

interface CSVRow {
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  sexo?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  matricula?: string;
  cargo?: string;
  departamento?: string;
  tipo: string;
  titular_cpf?: string;
  grau_parentesco?: string;
  plano_saude?: string;
  plano_vida?: string;
  plano_odonto?: string;
  status?: string;
  data_inclusao?: string;
}

interface ImportError {
  linha: number;
  cpf: string;
  nome: string;
  motivo: string;
}

interface ImportResult {
  total: number;
  importados: number;
  erros: ImportError[];
}

const REQUIRED_FIELDS = ["nome_completo", "cpf", "data_nascimento", "tipo"];
const VALID_TIPOS = ["titular", "dependente"];
const VALID_SEXOS = ["M", "F", "masculino", "feminino", ""];
const VALID_STATUS = ["ativo", "inativo", "suspenso"];
const VALID_GRAU_PARENTESCO = ["conjuge", "filho", "filha", "pai", "mae", "outro", ""];

function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

function validateCPF(cpf: string): boolean {
  const cleaned = normalizeCPF(cpf);
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  return true;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Try DD/MM/YYYY
  const brFormat = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const brMatch = dateStr.match(brFormat);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  
  // Try YYYY-MM-DD
  const isoFormat = /^(\d{4})-(\d{2})-(\d{2})$/;
  if (isoFormat.test(dateStr)) {
    return dateStr;
  }
  
  return null;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase().trim();
  return v === "sim" || v === "s" || v === "true" || v === "1" || v === "x";
}

function normalizeSexo(sexo: string | undefined): string | null {
  if (!sexo) return null;
  const s = sexo.toLowerCase().trim();
  if (s === "m" || s === "masculino") return "M";
  if (s === "f" || s === "feminino") return "F";
  return null;
}

type GrauParentesco = "conjuge" | "filho" | "mae" | "outro" | "pai" | null;

function normalizeGrauParentesco(grau: string | undefined): GrauParentesco {
  if (!grau) return null;
  const g = grau.toLowerCase().trim();
  const validGraus: GrauParentesco[] = ["conjuge", "filho", "mae", "outro", "pai"];
  if (validGraus.includes(g as GrauParentesco)) return g as GrauParentesco;
  if (g === "filha") return "filho";
  return null;
}

export function ImportCSVModal({ open, onOpenChange, empresaId }: ImportCSVModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");

  const resetState = useCallback(() => {
    setFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setIsImporting(false);
    setImportResult(null);
    setStep("upload");
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV");
      return;
    }

    setFile(selectedFile);
    setValidationErrors([]);

    Papa.parse<CSVRow>(selectedFile, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        const errors: string[] = [];
        
        // Validate headers
        const headers = Object.keys(results.data[0] || {});
        const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
        if (missingFields.length > 0) {
          errors.push(`Campos obrigatórios faltando: ${missingFields.join(", ")}`);
        }

        // Validate rows
        results.data.forEach((row, index) => {
          const lineNum = index + 2; // +2 because of header and 0-index
          
          if (!row.nome_completo?.trim()) {
            errors.push(`Linha ${lineNum}: nome_completo vazio`);
          }
          
          if (!validateCPF(row.cpf || "")) {
            errors.push(`Linha ${lineNum}: CPF inválido (${row.cpf})`);
          }
          
          if (!parseDate(row.data_nascimento || "")) {
            errors.push(`Linha ${lineNum}: data_nascimento inválida (${row.data_nascimento})`);
          }
          
          if (!VALID_TIPOS.includes(row.tipo?.toLowerCase()?.trim() || "")) {
            errors.push(`Linha ${lineNum}: tipo inválido (${row.tipo}). Use: titular ou dependente`);
          }
          
          if (row.tipo?.toLowerCase() === "dependente" && !row.titular_cpf) {
            errors.push(`Linha ${lineNum}: dependente sem titular_cpf`);
          }

          if (row.sexo && !VALID_SEXOS.includes(row.sexo.toLowerCase().trim())) {
            errors.push(`Linha ${lineNum}: sexo inválido (${row.sexo}). Use: M ou F`);
          }
        });

        if (errors.length > 10) {
          setValidationErrors([...errors.slice(0, 10), `... e mais ${errors.length - 10} erros`]);
        } else {
          setValidationErrors(errors);
        }

        setParsedData(results.data);
        setStep("preview");
      },
      error: (error) => {
        toast.error(`Erro ao ler arquivo: ${error.message}`);
      }
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (!user || !empresaId || parsedData.length === 0) return;

    setIsImporting(true);
    const errors: ImportError[] = [];
    const cpfToIdMap = new Map<string, string>();
    let importados = 0;

    try {
      // Separate titulares and dependentes
      const titulares = parsedData.filter(row => row.tipo?.toLowerCase().trim() === "titular");
      const dependentes = parsedData.filter(row => row.tipo?.toLowerCase().trim() === "dependente");

      // First pass: Import titulares
      for (let i = 0; i < titulares.length; i++) {
        const row = titulares[i];
        const cpf = normalizeCPF(row.cpf);
        const dataNascimento = parseDate(row.data_nascimento);
        
        if (!dataNascimento) {
          errors.push({
            linha: parsedData.indexOf(row) + 2,
            cpf: row.cpf,
            nome: row.nome_completo,
            motivo: "Data de nascimento inválida"
          });
          continue;
        }

        const insertData = {
          empresa_id: empresaId,
          criado_por: user.id,
          nome_completo: row.nome_completo.trim(),
          cpf: cpf,
          data_nascimento: dataNascimento,
          sexo: normalizeSexo(row.sexo),
          email: row.email?.trim() || null,
          telefone: row.telefone?.trim() || null,
          cep: row.cep?.trim() || null,
          endereco: row.endereco?.trim() || null,
          numero: row.numero?.trim() || null,
          complemento: row.complemento?.trim() || null,
          bairro: row.bairro?.trim() || null,
          cidade: row.cidade?.trim() || null,
          uf: row.uf?.trim()?.toUpperCase() || null,
          matricula: row.matricula?.trim() || null,
          cargo: row.cargo?.trim() || null,
          departamento: row.departamento?.trim() || null,
          tipo: "titular" as const,
          titular_id: null,
          grau_parentesco: null,
          plano_saude: parseBoolean(row.plano_saude),
          plano_vida: parseBoolean(row.plano_vida),
          plano_odonto: parseBoolean(row.plano_odonto),
          status: (VALID_STATUS.includes(row.status?.toLowerCase() || "") ? row.status?.toLowerCase() : "ativo") as "ativo" | "inativo" | "suspenso",
          data_inclusao: parseDate(row.data_inclusao) || new Date().toISOString().split("T")[0],
        };

        const { data, error } = await supabase
          .from("beneficiarios")
          .insert(insertData)
          .select("id")
          .single();

        if (error) {
          errors.push({
            linha: parsedData.indexOf(row) + 2,
            cpf: row.cpf,
            nome: row.nome_completo,
            motivo: error.message.includes("duplicate") ? "CPF já cadastrado" : error.message
          });
        } else if (data) {
          cpfToIdMap.set(cpf, data.id);
          importados++;
        }
      }

      // Fetch existing titulares for dependentes that reference them
      const titularCpfsNeeded = [...new Set(dependentes.map(d => normalizeCPF(d.titular_cpf || "")))];
      if (titularCpfsNeeded.length > 0) {
        const { data: existingTitulares } = await supabase
          .from("beneficiarios")
          .select("id, cpf")
          .eq("empresa_id", empresaId)
          .eq("tipo", "titular")
          .in("cpf", titularCpfsNeeded);
        
        existingTitulares?.forEach(t => {
          if (!cpfToIdMap.has(t.cpf)) {
            cpfToIdMap.set(t.cpf, t.id);
          }
        });
      }

      // Second pass: Import dependentes
      for (let i = 0; i < dependentes.length; i++) {
        const row = dependentes[i];
        const cpf = normalizeCPF(row.cpf);
        const titularCpf = normalizeCPF(row.titular_cpf || "");
        const dataNascimento = parseDate(row.data_nascimento);
        
        if (!dataNascimento) {
          errors.push({
            linha: parsedData.indexOf(row) + 2,
            cpf: row.cpf,
            nome: row.nome_completo,
            motivo: "Data de nascimento inválida"
          });
          continue;
        }

        const titularId = cpfToIdMap.get(titularCpf);
        if (!titularId) {
          errors.push({
            linha: parsedData.indexOf(row) + 2,
            cpf: row.cpf,
            nome: row.nome_completo,
            motivo: `Titular não encontrado (CPF: ${row.titular_cpf})`
          });
          continue;
        }

        const insertData = {
          empresa_id: empresaId,
          criado_por: user.id,
          nome_completo: row.nome_completo.trim(),
          cpf: cpf,
          data_nascimento: dataNascimento,
          sexo: normalizeSexo(row.sexo),
          email: row.email?.trim() || null,
          telefone: row.telefone?.trim() || null,
          cep: row.cep?.trim() || null,
          endereco: row.endereco?.trim() || null,
          numero: row.numero?.trim() || null,
          complemento: row.complemento?.trim() || null,
          bairro: row.bairro?.trim() || null,
          cidade: row.cidade?.trim() || null,
          uf: row.uf?.trim()?.toUpperCase() || null,
          matricula: row.matricula?.trim() || null,
          cargo: row.cargo?.trim() || null,
          departamento: row.departamento?.trim() || null,
          tipo: "dependente" as const,
          titular_id: titularId,
          grau_parentesco: normalizeGrauParentesco(row.grau_parentesco),
          plano_saude: parseBoolean(row.plano_saude),
          plano_vida: parseBoolean(row.plano_vida),
          plano_odonto: parseBoolean(row.plano_odonto),
          status: (VALID_STATUS.includes(row.status?.toLowerCase() || "") ? row.status?.toLowerCase() : "ativo") as "ativo" | "inativo" | "suspenso",
          data_inclusao: parseDate(row.data_inclusao) || new Date().toISOString().split("T")[0],
        };

        const { error } = await supabase
          .from("beneficiarios")
          .insert([insertData]);

        if (error) {
          errors.push({
            linha: parsedData.indexOf(row) + 2,
            cpf: row.cpf,
            nome: row.nome_completo,
            motivo: error.message.includes("duplicate") ? "CPF já cadastrado" : error.message
          });
        } else {
          importados++;
        }
      }

      setImportResult({
        total: parsedData.length,
        importados,
        erros: errors
      });
      setStep("result");

      if (importados > 0) {
        queryClient.invalidateQueries({ queryKey: ["beneficiarios"] });
        toast.success(`${importados} beneficiário(s) importado(s) com sucesso!`);
      }

    } catch (error) {
      console.error("Erro na importação:", error);
      toast.error("Erro ao importar beneficiários");
    } finally {
      setIsImporting(false);
    }
  }, [user, empresaId, parsedData, queryClient]);

  const downloadTemplate = useCallback(() => {
    const template = `nome_completo;cpf;data_nascimento;sexo;email;telefone;cep;endereco;numero;complemento;bairro;cidade;uf;matricula;cargo;departamento;tipo;titular_cpf;grau_parentesco;plano_saude;plano_vida;plano_odonto;status;data_inclusao
João da Silva;123.456.789-00;15/03/1985;M;joao@email.com;11999999999;01310-100;Av Paulista;1000;;Bela Vista;São Paulo;SP;MAT001;Analista;TI;titular;;;sim;sim;nao;ativo;01/01/2024
Maria da Silva;987.654.321-00;20/06/2010;F;;;;;;;Bela Vista;São Paulo;SP;;;TI;dependente;123.456.789-00;filha;sim;nao;nao;ativo;01/01/2024`;
    
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_beneficiarios.csv";
    link.click();
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Beneficiários via CSV
          </DialogTitle>
          <DialogDescription>
            Importe beneficiários em lote usando um arquivo CSV com separador ponto e vírgula (;)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <Label htmlFor="csv-file" className="cursor-pointer">
                  <div className="space-y-2">
                    <p className="font-medium">Clique para selecionar um arquivo CSV</p>
                    <p className="text-sm text-muted-foreground">
                      Formato: nome_completo;cpf;data_nascimento;tipo;...
                    </p>
                  </div>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </Label>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Campos obrigatórios:</strong> nome_completo, cpf, data_nascimento, tipo (titular/dependente).
                  <br />
                  <strong>Dependentes:</strong> devem ter o campo titular_cpf preenchido.
                </AlertDescription>
              </Alert>

              <Button variant="outline" onClick={downloadTemplate} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Baixar Template CSV
              </Button>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="text-sm">
                  <FileText className="h-3 w-3 mr-1" />
                  {file?.name}
                </Badge>
                <Badge variant="outline">
                  {parsedData.length} registros encontrados
                </Badge>
              </div>

              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {validationErrors.map((error, i) => (
                        <p key={i} className="text-sm">{error}</p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Titular CPF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 2}</TableCell>
                        <TableCell className="font-medium">{row.nome_completo}</TableCell>
                        <TableCell>{row.cpf}</TableCell>
                        <TableCell>{row.data_nascimento}</TableCell>
                        <TableCell>
                          <Badge variant={row.tipo?.toLowerCase() === "titular" ? "default" : "secondary"}>
                            {row.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.titular_cpf || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 20 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    ... e mais {parsedData.length - 20} registros
                  </p>
                )}
              </ScrollArea>
            </div>
          )}

          {step === "result" && importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold">{importResult.total}</p>
                  <p className="text-sm text-muted-foreground">Total no arquivo</p>
                </Card>
                <Card className="p-4 text-center bg-green-50 dark:bg-green-950">
                  <p className="text-2xl font-bold text-green-600">{importResult.importados}</p>
                  <p className="text-sm text-muted-foreground">Importados</p>
                </Card>
                <Card className="p-4 text-center bg-red-50 dark:bg-red-950">
                  <p className="text-2xl font-bold text-red-600">{importResult.erros.length}</p>
                  <p className="text-sm text-muted-foreground">Com erro</p>
                </Card>
              </div>

              {importResult.erros.length > 0 && (
                <ScrollArea className="h-[250px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Motivo do Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.erros.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell>{err.linha}</TableCell>
                          <TableCell>{err.nome}</TableCell>
                          <TableCell>{err.cpf}</TableCell>
                          <TableCell className="text-red-600">{err.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {importResult.importados > 0 && importResult.erros.length === 0 && (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    Todos os beneficiários foram importados com sucesso!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={resetState}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isImporting || validationErrors.length > 0}
              >
                {isImporting ? "Importando..." : `Importar ${parsedData.length} Beneficiários`}
              </Button>
            </>
          )}

          {step === "result" && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
