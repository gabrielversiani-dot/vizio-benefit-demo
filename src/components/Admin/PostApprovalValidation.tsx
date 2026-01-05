import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImportJobRow {
  id: string;
  status: string;
  mapped_data: Record<string, unknown>;
}

interface ValidationResult {
  cpf: string;
  nome: string;
  status: "found" | "not_found" | "error";
  detail: string;
  empresaIdOk?: boolean;
  criadoPorOk?: boolean;
  titularIdOk?: boolean | null;
}

interface Props {
  jobId: string;
  empresaId: string;
  dataType: string;
  rows: ImportJobRow[];
}

export function PostApprovalValidation({ jobId, empresaId, dataType, rows }: Props) {
  const [validating, setValidating] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [validated, setValidated] = useState(false);

  const runValidation = async () => {
    if (dataType !== "beneficiarios") {
      setResults([]);
      setValidated(true);
      return;
    }

    setValidating(true);
    const validationResults: ValidationResult[] = [];

    // Get CPFs from staging rows that should have been imported
    const cpfsToCheck = rows
      .filter((r) => r.status === "valid" || r.status === "warning")
      .map((r) => ({
        cpf: (r.mapped_data?.cpf as string) || "",
        nome: (r.mapped_data?.nome_completo as string) || "",
        tipo: (r.mapped_data?.tipo as string) || "titular",
        titularCpf: (r.mapped_data?.titular_cpf as string) || null,
      }))
      .filter((r) => r.cpf);

    for (const item of cpfsToCheck) {
      try {
        const { data: beneficiario, error } = await supabase
          .from("beneficiarios")
          .select("id, empresa_id, criado_por, titular_id")
          .eq("cpf", item.cpf)
          .eq("empresa_id", empresaId)
          .maybeSingle();

        if (error) {
          validationResults.push({
            cpf: item.cpf,
            nome: item.nome,
            status: "error",
            detail: `Erro ao consultar: ${error.message}`,
          });
        } else if (!beneficiario) {
          validationResults.push({
            cpf: item.cpf,
            nome: item.nome,
            status: "not_found",
            detail: "Registro não encontrado no banco",
          });
        } else {
          const empresaIdOk = beneficiario.empresa_id === empresaId;
          const criadoPorOk = !!beneficiario.criado_por;
          
          // For dependentes, check if titular_id was set
          let titularIdOk: boolean | null = null;
          if (item.tipo === "dependente") {
            titularIdOk = !!beneficiario.titular_id;
          }

          const allOk = empresaIdOk && criadoPorOk && (titularIdOk === null || titularIdOk);

          validationResults.push({
            cpf: item.cpf,
            nome: item.nome,
            status: allOk ? "found" : "error",
            detail: allOk 
              ? "Registro inserido corretamente" 
              : `Problemas: ${!empresaIdOk ? "empresa_id incorreto" : ""} ${!criadoPorOk ? "criado_por vazio" : ""} ${titularIdOk === false ? "titular_id não vinculado" : ""}`,
            empresaIdOk,
            criadoPorOk,
            titularIdOk,
          });
        }
      } catch (err) {
        validationResults.push({
          cpf: item.cpf,
          nome: item.nome,
          status: "error",
          detail: "Erro inesperado na validação",
        });
      }
    }

    setResults(validationResults);
    setValidated(true);
    setValidating(false);
  };

  const foundCount = results.filter((r) => r.status === "found").length;
  const notFoundCount = results.filter((r) => r.status === "not_found").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const totalExpected = rows.filter((r) => r.status === "valid" || r.status === "warning").length;
  const successRate = totalExpected > 0 ? Math.round((foundCount / totalExpected) * 100) : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Validação Pós-Aprovação
        </CardTitle>
        <CardDescription>
          Confirma que os registros foram inseridos corretamente no banco
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!validated ? (
          <Button onClick={runValidation} disabled={validating} className="w-full">
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validando registros no banco...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Executar Validação Pós-Commit
              </>
            )}
          </Button>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{foundCount}</div>
                <div className="text-xs text-muted-foreground">Encontrados</div>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-center">
                <div className="text-xl font-bold text-red-600">{notFoundCount + errorCount}</div>
                <div className="text-xs text-muted-foreground">Não encontrados</div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{successRate}%</div>
                <div className="text-xs text-muted-foreground">Taxa de Sucesso</div>
              </div>
            </div>

            {/* Overall status */}
            <div className={`p-4 rounded-lg flex items-center gap-3 ${
              successRate === 100 
                ? "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-200" 
                : successRate >= 80 
                  ? "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200"
                  : "bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-200"
            }`}>
              {successRate === 100 ? (
                <CheckCircle className="h-6 w-6" />
              ) : successRate >= 80 ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <XCircle className="h-6 w-6" />
              )}
              <div>
                <div className="font-semibold">
                  {successRate === 100 
                    ? "✓ Todos os registros foram inseridos corretamente!"
                    : successRate >= 80
                      ? "⚠ Maioria inserida, mas há problemas em alguns registros"
                      : "✗ Falha significativa na importação"}
                </div>
                <div className="text-sm opacity-80">
                  {foundCount} de {totalExpected} registros validados no banco
                </div>
              </div>
            </div>

            {/* Detailed results */}
            {results.length > 0 && (notFoundCount > 0 || errorCount > 0) && (
              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-3 space-y-2">
                  {results
                    .filter((r) => r.status !== "found")
                    .map((result, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-destructive/5 rounded"
                      >
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-destructive" />
                          <div>
                            <div className="font-medium text-sm">{result.nome}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              CPF: {result.cpf}
                            </div>
                          </div>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {result.detail}
                        </Badge>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}

            <Button variant="outline" onClick={runValidation} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Revalidar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
