import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText, ExternalLink, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ImportJob {
  id: string;
  data_type: string;
  status: string;
  arquivo_nome: string;
  total_rows: number | null;
  valid_rows: number | null;
  warning_rows: number | null;
  error_rows: number | null;
  ai_summary: string | null;
  created_at: string;
  applied_at: string | null;
}

interface ImportHistorySectionProps {
  empresaId?: string;
}

export function ImportHistorySection({ empresaId }: ImportHistorySectionProps) {
  const navigate = useNavigate();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["import-jobs-sinistralidade", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("import_jobs")
        .select("id, data_type, status, arquivo_nome, total_rows, valid_rows, warning_rows, error_rows, ai_summary, created_at, applied_at")
        .eq("data_type", "sinistralidade_pdf")
        .order("created_at", { ascending: false })
        .limit(10);

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ImportJob[];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Aplicado</Badge>;
      case 'ready_for_review':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><Clock className="h-3 w-3 mr-1" />Revisão</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Histórico de Importações PDF
        </CardTitle>
        <CardDescription>
          Últimas importações de sinistralidade via PDF
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Registros</TableHead>
              <TableHead>Resumo IA</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {job.arquivo_nome}
                </TableCell>
                <TableCell>
                  {getStatusBadge(job.status)}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-green-600">{job.valid_rows || 0}</span>
                    {job.warning_rows ? (
                      <span className="text-amber-600">/{job.warning_rows}</span>
                    ) : null}
                    {job.error_rows ? (
                      <span className="text-red-600">/{job.error_rows}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">
                  {job.ai_summary || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(job.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/admin/importacao/jobs/${job.id}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
