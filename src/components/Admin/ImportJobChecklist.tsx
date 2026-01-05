import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Users, UserPlus } from "lucide-react";

interface ImportJobRow {
  id: string;
  status: string;
  mapped_data: Record<string, unknown>;
  validation_errors: string[] | null;
  validation_warnings: string[] | null;
}

interface ImportJob {
  id: string;
  data_type: string;
  total_rows: number;
  valid_rows: number;
  warning_rows: number;
  error_rows: number;
  duplicate_rows: number;
  status: string;
}

interface ChecklistItem {
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

interface Props {
  job: ImportJob;
  rows: ImportJobRow[];
}

export function ImportJobChecklist({ job, rows }: Props) {
  const checklist = useMemo(() => {
    const items: ChecklistItem[] = [];

    // 1. Total rows check
    items.push({
      label: "Total de linhas analisadas",
      status: job.total_rows > 0 ? "pass" : "fail",
      detail: `${job.total_rows} linhas no arquivo`,
    });

    // 2. Valid rows check
    const validPercent = job.total_rows > 0 ? Math.round((job.valid_rows / job.total_rows) * 100) : 0;
    items.push({
      label: "Linhas válidas",
      status: validPercent >= 80 ? "pass" : validPercent >= 50 ? "warn" : "fail",
      detail: `${job.valid_rows} válidas (${validPercent}%)`,
    });

    // 3. Warning rows
    if (job.warning_rows > 0) {
      items.push({
        label: "Linhas com avisos",
        status: "warn",
        detail: `${job.warning_rows} linhas serão importadas com avisos`,
      });
    }

    // 4. Error rows
    if (job.error_rows > 0) {
      items.push({
        label: "Linhas com erros",
        status: "fail",
        detail: `${job.error_rows} linhas NÃO serão importadas`,
      });
    }

    // 5. Duplicate rows
    if (job.duplicate_rows > 0) {
      items.push({
        label: "Registros duplicados",
        status: "warn",
        detail: `${job.duplicate_rows} serão atualizados (já existem no banco)`,
      });
    }

    return items;
  }, [job]);

  // Beneficiarios-specific analysis
  const beneficiariosAnalysis = useMemo(() => {
    if (job.data_type !== "beneficiarios") return null;

    let titulares = 0;
    let dependentes = 0;
    let dependentesSemTitular = 0;

    rows.forEach((row) => {
      const tipo = row.mapped_data?.tipo as string | undefined;
      if (tipo === "dependente") {
        dependentes++;
        // Check if has titular_cpf
        if (!row.mapped_data?.titular_cpf && !row.mapped_data?.titular_id) {
          dependentesSemTitular++;
        }
      } else {
        titulares++;
      }
    });

    return { titulares, dependentes, dependentesSemTitular };
  }, [job.data_type, rows]);

  const getStatusIcon = (status: "pass" | "fail" | "warn") => {
    switch (status) {
      case "pass":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "fail":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "warn":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: "pass" | "fail" | "warn") => {
    switch (status) {
      case "pass":
        return <Badge variant="default" className="bg-green-600">OK</Badge>;
      case "fail":
        return <Badge variant="destructive">Erro</Badge>;
      case "warn":
        return <Badge variant="secondary">Aviso</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          Checklist do Job
        </CardTitle>
        <CardDescription>
          Validações automáticas antes da aprovação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* General checklist */}
        <div className="space-y-2">
          {checklist.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                {getStatusIcon(item.status)}
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{item.detail}</span>
                {getStatusBadge(item.status)}
              </div>
            </div>
          ))}
        </div>

        {/* Beneficiarios-specific */}
        {beneficiariosAnalysis && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Análise de Beneficiários
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {beneficiariosAnalysis.titulares}
                </div>
                <div className="text-xs text-muted-foreground">Titulares</div>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {beneficiariosAnalysis.dependentes}
                </div>
                <div className="text-xs text-muted-foreground">Dependentes</div>
              </div>
              {beneficiariosAnalysis.dependentesSemTitular > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {beneficiariosAnalysis.dependentesSemTitular}
                  </div>
                  <div className="text-xs text-muted-foreground">Sem Titular</div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
