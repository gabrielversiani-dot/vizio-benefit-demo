import { LayoutDashboard, DollarSign, Activity, Users, FileText, Settings, Shield, FileSignature, RefreshCw, ClipboardList, Heart, Bot, FlaskConical, Construction } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { usePermissions } from "@/hooks/usePermissions";

// Menu items for all users (clients see only these)
const clientMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: DollarSign, label: "Faturamento", href: "/faturamento" },
  { icon: Activity, label: "Sinistralidade", href: "/sinistralidade" },
  { icon: Shield, label: "Sinistros Vida", href: "/sinistros-vida" },
  { icon: FileSignature, label: "Contratos", href: "/contratos" },
  { icon: Heart, label: "Promoção de Saúde", href: "/promocao-saude" },
  { icon: FileText, label: "Relatórios", href: "/relatorios" },
];

// Modules "Em desenvolvimento" for clients
const comingSoonItems = [
  { icon: Users, label: "Beneficiários", href: "/coming-soon/beneficiarios" },
  { icon: RefreshCw, label: "Movimentação de Vidas", href: "/coming-soon/movimentacao-vidas" },
  { icon: ClipboardList, label: "Demandas", href: "/coming-soon/demandas" },
];

// Admin-only menu items (full access)
const adminMenuItems = [
  { icon: Users, label: "Beneficiários", href: "/beneficiarios" },
  { icon: RefreshCw, label: "Movimentação de Vidas", href: "/movimentacao-vidas" },
  { icon: Bot, label: "Central de Importação", href: "/admin/importacao" },
  { icon: ClipboardList, label: "Demandas", href: "/demandas" },
];

// Super admin items (admin_vizio only)
const superAdminItems = [
  { icon: FlaskConical, label: "Central de Testes", href: "/admin/testes" },
];

export function AppSidebar() {
  const { isAdmin, isAdminVizio, canViewConfiguracoes } = usePermissions();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Activity className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">Vizio Capital</h2>
            <p className="text-xs text-sidebar-foreground/60">Gestão de Benefícios</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarMenu>
          {/* Client menu items - visible to all */}
          {clientMenuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <NavLink to={item.href}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    isActive={isActive}
                    className="w-full justify-start gap-3 px-3 py-2.5"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                )}
              </NavLink>
            </SidebarMenuItem>
          ))}
          
          {/* Admin menu items - only for admins */}
          {isAdmin && adminMenuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <NavLink to={item.href}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    isActive={isActive}
                    className="w-full justify-start gap-3 px-3 py-2.5"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                )}
              </NavLink>
            </SidebarMenuItem>
          ))}

          {/* Coming Soon items - only for non-admin (clients) */}
          {!isAdmin && comingSoonItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <NavLink to={item.href}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    isActive={isActive}
                    className="w-full justify-start gap-3 px-3 py-2.5"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="flex-1">{item.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 bg-muted/50">
                      <Construction className="h-2.5 w-2.5" />
                      Em breve
                    </Badge>
                  </SidebarMenuButton>
                )}
              </NavLink>
            </SidebarMenuItem>
          ))}
          
          {/* Super admin items (admin_vizio only) */}
          {isAdminVizio && superAdminItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <NavLink to={item.href}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    isActive={isActive}
                    className="w-full justify-start gap-3 px-3 py-2.5"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                )}
              </NavLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer - Configurações for all with permission (including clients) */}
      {canViewConfiguracoes && (
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <NavLink to="/configuracoes">
            {({ isActive }) => (
              <SidebarMenuButton isActive={isActive} className="w-full justify-start gap-3">
                <Settings className="h-5 w-5" />
                <span>Configurações</span>
              </SidebarMenuButton>
            )}
          </NavLink>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
