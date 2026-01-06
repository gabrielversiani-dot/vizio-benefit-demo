import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction, Sparkles } from "lucide-react";

interface ComingSoonCardProps {
  title: string;
  description?: string;
}

export function ComingSoonCard({ title, description }: ComingSoonCardProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <Badge variant="outline" className="mb-2 gap-1">
          <Sparkles className="h-3 w-3" />
          Em desenvolvimento
        </Badge>
        <h3 className="font-medium text-sm mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          {description || "Estamos preparando essa área para você 🙂 Em breve teremos novidades."}
        </p>
      </CardContent>
    </Card>
  );
}
