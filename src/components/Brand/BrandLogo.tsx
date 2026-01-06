import { Activity } from "lucide-react";
import { 
  BRAND_NAME, 
  BRAND_LOGO_SRC, 
  BRAND_LOGO_ALT, 
  BRAND_LOGO_HEIGHT 
} from "@/config/brand";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: keyof typeof BRAND_LOGO_HEIGHT;
  showFallback?: boolean;
  className?: string;
}

export function BrandLogo({ 
  size = "sidebar", 
  showFallback = true,
  className 
}: BrandLogoProps) {
  const height = BRAND_LOGO_HEIGHT[size];
  
  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Logo with dark background container for light mode visibility */}
      <div className="rounded bg-sidebar-accent dark:bg-transparent p-1.5">
        <img 
          src={BRAND_LOGO_SRC}
          alt={BRAND_LOGO_ALT}
          loading="eager"
          draggable={false}
          style={{ height: `${height}px` }}
          className="w-auto object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.parentElement?.querySelector('[data-fallback]') as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        {showFallback && (
          <div 
            data-fallback
            className="hidden items-center gap-2"
            style={{ height: `${height}px` }}
          >
            <div 
              className="flex items-center justify-center rounded-lg bg-primary"
              style={{ height: `${height}px`, width: `${height}px` }}
            >
              <Activity className="h-1/2 w-1/2 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">{BRAND_NAME}</span>
          </div>
        )}
      </div>
    </div>
  );
}
