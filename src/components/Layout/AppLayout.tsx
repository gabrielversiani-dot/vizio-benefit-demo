import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Building2, Search, Bell, ChevronDown, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/Settings/ThemeToggle";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const {
    empresaSelecionada,
    setEmpresaSelecionada,
    empresas,
    loading,
    isAdminVizio,
  } = useEmpresa();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const empresaAtual = empresas.find((e) => e.id === empresaSelecionada);
  const userName = user?.email?.split("@")[0] || "Usuário";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <AppSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main content area with margin for sidebar */}
      <div className={cn(
        "transition-all duration-300",
        sidebarOpen ? "lg:ml-64" : "lg:ml-16"
      )}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 lg:h-20 items-center justify-between border-b border-border/50 bg-background/80 px-4 lg:px-8 backdrop-blur-xl">
          {/* Left section - Title & Company */}
          <div className="flex items-center gap-4">
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Title - only show if provided */}
            {title && (
              <div className="hidden sm:block">
                <h1 className="text-xl lg:text-2xl font-display font-semibold text-foreground">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
            )}

            {/* Company selector for admins */}
            {!loading && isAdminVizio && empresas.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <Select
                  value={empresaSelecionada || undefined}
                  onValueChange={setEmpresaSelecionada}
                >
                  <SelectTrigger className="w-[180px] lg:w-[280px] bg-secondary border-border/50 hover:bg-secondary/80">
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        <span className="flex items-center gap-2">
                          {empresa.nome}
                          {empresa.is_demo && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-vizio-gold/20 text-vizio-gold border-vizio-gold/30">
                              Demo
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Static company display for non-admins */}
            {!loading && !isAdminVizio && empresaAtual && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/30">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium truncate max-w-[160px]">{empresaAtual.nome}</span>
              </div>
            )}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Search - hidden on mobile */}
            <div className="relative hidden lg:block">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="vizio-input w-64 xl:w-80 pl-11 py-2"
              />
            </div>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-xl bg-secondary hover:bg-secondary/80"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 lg:gap-3 rounded-xl bg-secondary px-3 lg:px-4 py-2 hover:bg-secondary/80"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                    {userInitial}
                  </div>
                  <span className="hidden lg:inline text-sm font-medium text-foreground truncate max-w-[120px]">
                    {userName}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                <DropdownMenuItem disabled>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
