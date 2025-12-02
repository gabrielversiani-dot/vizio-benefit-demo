import { LayoutDashboard, DollarSign, Activity, Users, FileText, Settings, Shield, FileSignature, RefreshCw, ClipboardList, Heart } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: DollarSign, label: "Faturamento", href: "/faturamento" },
  { icon: Activity, label: "Sinistralidade", href: "/sinistralidade" },
  { icon: Shield, label: "Sinistros Vida", href: "/sinistros-vida" },
  { icon: FileSignature, label: "Contratos", href: "/contratos" },
  { icon: Users, label: "Beneficiários", href: "/beneficiarios" },
  { icon: RefreshCw, label: "Movimentação de Vidas", href: "/movimentacao-vidas" },
  { icon: ClipboardList, label: "Demandas", href: "/demandas" },
  { icon: Heart, label: "Promoção de Saúde", href: "/promocao-saude" },
  { icon: FileText, label: "Relatórios", href: "/relatorios" },
];

export function AppSidebar() {
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
          {menuItems.map((item) => (
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
    </Sidebar>
  );
}
