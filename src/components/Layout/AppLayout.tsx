import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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
import { LogOut, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/contexts/EmpresaContext";
interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { signOut } = useAuth();
  const {
    empresaSelecionada,
    setEmpresaSelecionada,
    empresas,
    loading,
    isAdminVizio,
  } = useEmpresa();

  const empresaAtual = empresas.find((e) => e.id === empresaSelecionada);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="lg:hidden">
                  <SidebarTrigger />
                </div>
                
                {!loading && isAdminVizio && empresas.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={empresaSelecionada || undefined}
                      onValueChange={setEmpresaSelecionada}
                    >
                      <SelectTrigger className="w-[280px] bg-card">
                        <SelectValue placeholder="Selecione uma empresa" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {empresas.map((empresa) => (
                          <SelectItem key={empresa.id} value={empresa.id}>
                            <span className="flex items-center gap-2">
                              {empresa.nome}
                              {empresa.is_demo && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
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

                {!loading && !isAdminVizio && empresaAtual && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{empresaAtual.nome}</span>
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
