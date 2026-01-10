import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const themeOptions: ThemeOption[] = [
  {
    value: "dark",
    label: "Escuro",
    icon: <Moon className="h-5 w-5" />,
    description: "Tema escuro com acentos dourados",
  },
  {
    value: "light",
    label: "Claro",
    icon: <Sun className="h-5 w-5" />,
    description: "Tema claro e clean",
  },
  {
    value: "system",
    label: "Sistema",
    icon: <Monitor className="h-5 w-5" />,
    description: "Seguir preferência do sistema",
  },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {themeOptions.map((option) => (
          <div
            key={option.value}
            className="h-24 rounded-lg border bg-muted/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {themeOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all duration-200",
            "hover:border-primary/50 hover:bg-accent/50",
            theme === option.value
              ? "border-primary bg-accent"
              : "border-border bg-card"
          )}
        >
          {theme === option.value && (
            <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              theme === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {option.icon}
          </div>
          <div className="text-center">
            <p className="font-medium">{option.label}</p>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
