import { 
  LayoutDashboard, 
  DollarSign, 
  Activity, 
  Users, 
  FileText, 
  Settings, 
  Shield, 
  FileSignature, 
  RefreshCw, 
  ClipboardList, 
  Heart, 
  Bot, 
  FlaskConical, 
  Construction,
  LogOut,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/Brand/BrandLogo";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

// Menu items for all users (clients and admins)
const clientMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: DollarSign, label: "Faturamento", href: "/faturamento" },
  { icon: Activity, label: "Sinistralidade", href: "/sinistralidade" },
  { icon: Shield, label: "Sinistros Vida", href: "/sinistros-vida" },
  { icon: FileSignature, label: "Contratos", href: "/contratos" },
  { icon: Heart, label: "Promoção de Saúde", href: "/promocao-saude" },
  { icon: ClipboardList, label: "Demandas", href: "/demandas" },
  { icon: FileText, label: "Relatórios", href: "/relatorios" },
];

// Modules "Em desenvolvimento" for clients (features not yet available)
const comingSoonItems = [
  { icon: Users, label: "Beneficiários", href: "/coming-soon/beneficiarios" },
  { icon: RefreshCw, label: "Movimentação de Vidas", href: "/coming-soon/movimentacao-vidas" },
];

// Admin-only menu items (additional features)
const adminMenuItems = [
  { icon: Users, label: "Beneficiários", href: "/beneficiarios" },
  { icon: RefreshCw, label: "Movimentação de Vidas", href: "/movimentacao-vidas" },
  { icon: Bot, label: "Central de Importação", href: "/admin/importacao" },
];

// Super admin items (admin_vizio only)
const superAdminItems = [
  { icon: FlaskConical, label: "Central de Testes", href: "/admin/testes" },
];

const bottomItems = [
  { icon: Settings, label: "Configurações", href: "/configuracoes" },
];

export function AppSidebar({ isOpen, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { isAdmin, isAdminVizio, canViewConfiguracoes } = usePermissions();
  const { signOut, user } = useAuth();

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const userName = user?.email?.split("@")[0] || "Usuário";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        isOpen ? "w-64" : "w-16",
        "max-lg:translate-x-0",
        !isOpen && "max-lg:-translate-x-full"
      )}
    >
      {/* Logo & Toggle */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {isOpen && (
          <Link to="/" className="block">
            <BrandLogo size="sidebar" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={onToggle}
        >
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {/* Client menu items - visible to all */}
          {clientMenuItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  "vizio-sidebar-item",
                  isActive(item.href) && "active",
                  !isOpen && "justify-center px-2"
                )}
                title={!isOpen ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {isOpen && <span>{item.label}</span>}
              </Link>
            </li>
          ))}

          {/* Admin menu items - only for admins */}
          {isAdmin && adminMenuItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  "vizio-sidebar-item",
                  isActive(item.href) && "active",
                  !isOpen && "justify-center px-2"
                )}
                title={!isOpen ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {isOpen && <span>{item.label}</span>}
              </Link>
            </li>
          ))}

          {/* Coming Soon items - only for non-admin (clients) */}
          {!isAdmin && comingSoonItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  "vizio-sidebar-item",
                  isActive(item.href) && "active",
                  !isOpen && "justify-center px-2"
                )}
                title={!isOpen ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {isOpen && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 bg-muted/50 border-border/50">
                      <Construction className="h-2.5 w-2.5" />
                      Em breve
                    </Badge>
                  </>
                )}
              </Link>
            </li>
          ))}

          {/* Super admin items (admin_vizio only) */}
          {isAdminVizio && (
            <>
              {isOpen && (
                <div className="mt-6 mb-2 px-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin</span>
                </div>
              )}
              {superAdminItems.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      "vizio-sidebar-item",
                      isActive(item.href) && "active",
                      !isOpen && "justify-center px-2"
                    )}
                    title={!isOpen ? item.label : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {isOpen && <span>{item.label}</span>}
                  </Link>
                </li>
              ))}
            </>
          )}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-3">
        <ul className="space-y-1">
          {/* Configurações for all with permission */}
          {canViewConfiguracoes && bottomItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  "vizio-sidebar-item",
                  isActive(item.href) && "active",
                  !isOpen && "justify-center px-2"
                )}
                title={!isOpen ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {isOpen && <span>{item.label}</span>}
              </Link>
            </li>
          ))}
          
          {/* Logout button */}
          <li>
            <button
              onClick={() => signOut()}
              className={cn(
                "vizio-sidebar-item w-full text-left hover:text-destructive",
                !isOpen && "justify-center px-2"
              )}
              title={!isOpen ? "Sair" : undefined}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {isOpen && <span>Sair</span>}
            </button>
          </li>
        </ul>

        {/* User info - only when open */}
        {isOpen && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
              {userInitial}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-foreground">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
