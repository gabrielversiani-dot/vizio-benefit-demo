import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, AlertCircle, FileText, Upload, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FeedItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user: string;
  entityId?: string;
  meta?: any;
}

interface ActivityFeedProps {
  data: FeedItem[] | undefined;
  isLoading: boolean;
}

function getEventIcon(type: string) {
  switch (type) {
    case "created":
      return <FileText className="h-3 w-3" />;
    case "status_change":
      return <RefreshCw className="h-3 w-3" />;
    case "completed":
      return <CheckCircle className="h-3 w-3 text-success" />;
    case "rd_sync":
      return <Upload className="h-3 w-3" />;
    default:
      return <Clock className="h-3 w-3" />;
  }
}

function getEventColor(type: string) {
  switch (type) {
    case "created":
      return "bg-chart-1/10 text-chart-1";
    case "status_change":
      return "bg-chart-2/10 text-chart-2";
    case "completed":
      return "bg-success/10 text-success";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ActivityFeed({ data, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Últimas Atualizações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Últimas Atualizações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <div className="text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma atividade recente</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={`p-1.5 rounded-full ${getEventColor(item.type)}`}>
                  {getEventIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {item.user}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.timestamp), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
