import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, GitBranch, CheckCircle, AlertTriangle, XCircle, TrendingDown } from "lucide-react";

interface Props {
  jobId: string;
  parentJobId: string;
}

export function ReimportComparison({ jobId, parentJobId }: Props) {
  // Fetch parent job details
  const { data: parentJob, isLoading } = useQuery({
    queryKey: ["import-job-parent", parentJobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_jobs")
        .select("id, arquivo_nome, total_rows, valid_rows, warning_rows, error_rows, duplicate_rows, status, created_at")
        .eq("id", parentJobId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!parentJobId,
  });

  // Fetch current job details for comparison
  const { data: currentJob } = useQuery({
    queryKey: ["import-job-current", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_jobs")
        .select("id, total_rows, valid_rows, warning_rows, error_rows, duplicate_rows")
        .eq("id", jobId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });

  if (isLoading || !parentJob || !currentJob) {
    return null;
  }

  const errorsFixed = Math.max(0, parentJob.error_rows - currentJob.error_rows);
  const warningsFixed = Math.max(0, parentJob.warning_rows - currentJob.warning_rows);
  const totalFixed = errorsFixed + warningsFixed;

  const errorsDelta = currentJob.error_rows - parentJob.error_rows;
  const warningsDelta = currentJob.warning_rows - parentJob.warning_rows;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-5 w-5 text-primary" />
            Comparativo com Importação Original
          </CardTitle>
          <Badge variant="outline" className="bg-background">
            Reimportação
          </Badge>
        </div>
        <CardDescription>
          Esta é uma correção da importação{" "}
          <Link 
            to={`/admin/importacao/jobs/${parentJobId}`}
            className="text-primary underline hover:no-underline"
          >
            {parentJob.arquivo_nome}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Parent Job Stats */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Importação Original</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                {parentJob.valid_rows} válidas
              </Badge>
              <Badge variant="secondary">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {parentJob.warning_rows} avisos
              </Badge>
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {parentJob.error_rows} erros
              </Badge>
            </div>
          </div>

          {/* Current Job Stats */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Esta Reimportação</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                {currentJob.valid_rows} válidas
              </Badge>
              <Badge variant="secondary">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {currentJob.warning_rows} avisos
                {warningsDelta !== 0 && (
                  <span className={warningsDelta < 0 ? "text-green-300 ml-1" : "text-red-300 ml-1"}>
                    ({warningsDelta > 0 ? "+" : ""}{warningsDelta})
                  </span>
                )}
              </Badge>
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {currentJob.error_rows} erros
                {errorsDelta !== 0 && (
                  <span className={errorsDelta < 0 ? "text-green-300 ml-1" : "text-red-300 ml-1"}>
                    ({errorsDelta > 0 ? "+" : ""}{errorsDelta})
                  </span>
                )}
              </Badge>
            </div>
          </div>
        </div>

        {/* Resolution Summary */}
        {totalFixed > 0 && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg flex items-center gap-3">
            <TrendingDown className="h-5 w-5 text-green-600" />
            <div>
              <span className="font-medium text-green-700 dark:text-green-300">
                {totalFixed} problema{totalFixed > 1 ? "s" : ""} resolvido{totalFixed > 1 ? "s" : ""}!
              </span>
              <span className="text-sm text-green-600 dark:text-green-400 ml-2">
                ({errorsFixed} erros, {warningsFixed} avisos)
              </span>
            </div>
          </div>
        )}

        {/* Link to parent */}
        <div className="mt-4 pt-4 border-t">
          <Link 
            to={`/admin/importacao/jobs/${parentJobId}`}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Ver importação original
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
