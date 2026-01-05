import { useEmpresa } from "@/contexts/EmpresaContext";

export type Permission = 
  | "promocao_saude:create"
  | "promocao_saude:edit"
  | "promocao_saude:delete"
  | "promocao_saude:view"
  | "promocao_saude:upload"
  | "promocao_saude:download"
  | "contratos:create"
  | "contratos:edit"
  | "contratos:delete"
  | "contratos:view"
  | "configuracoes:view";

const rolePermissions: Record<string, Permission[]> = {
  admin_vizio: [
    "promocao_saude:create",
    "promocao_saude:edit",
    "promocao_saude:delete",
    "promocao_saude:view",
    "promocao_saude:upload",
    "promocao_saude:download",
    "contratos:create",
    "contratos:edit",
    "contratos:delete",
    "contratos:view",
    "configuracoes:view",
  ],
  admin_empresa: [
    "promocao_saude:create",
    "promocao_saude:edit",
    "promocao_saude:delete",
    "promocao_saude:view",
    "promocao_saude:upload",
    "promocao_saude:download",
    "contratos:create",
    "contratos:edit",
    "contratos:delete",
    "contratos:view",
    "configuracoes:view",
  ],
  rh_gestor: [
    "promocao_saude:view",
    "promocao_saude:download",
    "contratos:view",
  ],
  visualizador: [
    "promocao_saude:view",
    "promocao_saude:download",
    "contratos:view",
  ],
};

export function usePermissions() {
  const { userRole, isAdminVizio } = useEmpresa();

  const hasPermission = (permission: Permission): boolean => {
    if (!userRole) return false;
    const permissions = rolePermissions[userRole] || [];
    return permissions.includes(permission);
  };

  const isAdmin = isAdminVizio || userRole === "admin_empresa";
  const canManagePromocaoSaude = hasPermission("promocao_saude:create");
  const canViewPromocaoSaude = hasPermission("promocao_saude:view");
  const canDownloadMateriais = hasPermission("promocao_saude:download");

  return {
    hasPermission,
    isAdmin,
    canManagePromocaoSaude,
    canViewPromocaoSaude,
    canDownloadMateriais,
    userRole,
  };
}
