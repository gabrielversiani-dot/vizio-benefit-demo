import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeriodFilter, ProductFilter } from "@/hooks/useDashboardData";

interface DashboardFiltersProps {
  period: PeriodFilter;
  product: ProductFilter;
  onPeriodChange: (value: PeriodFilter) => void;
  onProductChange: (value: ProductFilter) => void;
}

export function DashboardFilters({
  period,
  product,
  onPeriodChange,
  onProductChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Período:</span>
        <div className="flex gap-1">
          {[
            { value: "3", label: "3M" },
            { value: "6", label: "6M" },
            { value: "12", label: "12M" },
          ].map((opt) => (
            <Button
              key={opt.value}
              variant={period === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => onPeriodChange(opt.value as PeriodFilter)}
              className="px-3"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Produto:</span>
        <Select value={product} onValueChange={(v) => onProductChange(v as ProductFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="saude">Saúde</SelectItem>
            <SelectItem value="odonto">Odonto</SelectItem>
            <SelectItem value="vida">Vida</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
