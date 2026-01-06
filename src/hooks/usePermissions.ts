import { useEmpresa } from "@/contexts/EmpresaContext";

export type Permission = 
  // Promoção de Saúde
  | "promocao_saude:create"
  | "promocao_saude:edit"
  | "promocao_saude:delete"
  | "promocao_saude:view"
  | "promocao_saude:upload"
  | "promocao_saude:download"
  // Contratos
  | "contratos:create"
  | "contratos:edit"
  | "contratos:delete"
  | "contratos:view"
  | "contratos:download"
  | "contratos:upload"
  // Faturamento
  | "faturamento:create"
  | "faturamento:edit"
  | "faturamento:delete"
  | "faturamento:view"
  | "faturamento:download"
  | "faturamento:upload"
  // Sinistralidade
  | "sinistralidade:create"
  | "sinistralidade:edit"
  | "sinistralidade:delete"
  | "sinistralidade:view"
  | "sinistralidade:import"
  | "sinistralidade:download"
  // Beneficiários
  | "beneficiarios:create"
  | "beneficiarios:edit"
  | "beneficiarios:delete"
  | "beneficiarios:view"
  | "beneficiarios:import"
  // Movimentação
  | "movimentacao:create"
  | "movimentacao:edit"
  | "movimentacao:view"
  // Demandas
  | "demandas:create"
  | "demandas:edit"
  | "demandas:view"
  // Sinistros Vida
  | "sinistros_vida:view"
  | "sinistros_vida:create"
  | "sinistros_vida:manage"
  // Admin
  | "admin:view"
  | "admin:import"
  | "configuracoes:view"
  | "debug:view";

const rolePermissions: Record<string, Permission[]> = {
  admin_vizio: [
    // Promoção Saúde - Full
    "promocao_saude:create",
    "promocao_saude:edit",
    "promocao_saude:delete",
    "promocao_saude:view",
    "promocao_saude:upload",
    "promocao_saude:download",
    // Contratos - Full
    "contratos:create",
    "contratos:edit",
    "contratos:delete",
    "contratos:view",
    "contratos:download",
    "contratos:upload",
    // Faturamento - Full
    "faturamento:create",
    "faturamento:edit",
    "faturamento:delete",
    "faturamento:view",
    "faturamento:download",
    "faturamento:upload",
    // Sinistralidade - Full
    "sinistralidade:create",
    "sinistralidade:edit",
    "sinistralidade:delete",
    "sinistralidade:view",
    "sinistralidade:import",
    "sinistralidade:download",
    // Beneficiários - Full
    "beneficiarios:create",
    "beneficiarios:edit",
    "beneficiarios:delete",
    "beneficiarios:view",
    "beneficiarios:import",
    // Movimentação - Full
    "movimentacao:create",
    "movimentacao:edit",
    "movimentacao:view",
    // Demandas - Full
    "demandas:create",
    "demandas:edit",
    "demandas:view",
    // Sinistros Vida - Full
    "sinistros_vida:view",
    "sinistros_vida:create",
    "sinistros_vida:manage",
    // Admin - Full
    "admin:view",
    "admin:import",
    "configuracoes:view",
    "debug:view",
  ],
  admin_empresa: [
    // Promoção Saúde - Full
    "promocao_saude:create",
    "promocao_saude:edit",
    "promocao_saude:delete",
    "promocao_saude:view",
    "promocao_saude:upload",
    "promocao_saude:download",
    // Contratos - Full
    "contratos:create",
    "contratos:edit",
    "contratos:delete",
    "contratos:view",
    "contratos:download",
    "contratos:upload",
    // Faturamento - Full
    "faturamento:create",
    "faturamento:edit",
    "faturamento:delete",
    "faturamento:view",
    "faturamento:download",
    "faturamento:upload",
    // Sinistralidade - Full
    "sinistralidade:create",
    "sinistralidade:edit",
    "sinistralidade:delete",
    "sinistralidade:view",
    "sinistralidade:import",
    "sinistralidade:download",
    // Beneficiários - Full
    "beneficiarios:create",
    "beneficiarios:edit",
    "beneficiarios:delete",
    "beneficiarios:view",
    "beneficiarios:import",
    // Movimentação - Full
    "movimentacao:create",
    "movimentacao:edit",
    "movimentacao:view",
    // Demandas - Full
    "demandas:create",
    "demandas:edit",
    "demandas:view",
    // Sinistros Vida - Full
    "sinistros_vida:view",
    "sinistros_vida:create",
    "sinistros_vida:manage",
    // Admin - Partial
    "configuracoes:view",
  ],
  rh_gestor: [
    // Promoção Saúde - View Only + Download
    "promocao_saude:view",
    "promocao_saude:download",
    // Contratos - View Only + Download
    "contratos:view",
    "contratos:download",
    // Faturamento - View Only + Download
    "faturamento:view",
    "faturamento:download",
    // Sinistralidade - View Only + Download
    "sinistralidade:view",
    "sinistralidade:download",
    // Beneficiários - View Only (coming soon)
    "beneficiarios:view",
    // Movimentação - View Only (coming soon)
    "movimentacao:view",
    // Demandas - View + Create (can open new demands)
    "demandas:view",
    "demandas:create",
    // Sinistros Vida - View + Create (can open claims)
    "sinistros_vida:view",
    "sinistros_vida:create",
    // Client can access Configurações (limited)
    "configuracoes:view",
  ],
  visualizador: [
    // Promoção Saúde - View Only + Download
    "promocao_saude:view",
    "promocao_saude:download",
    // Contratos - View Only + Download
    "contratos:view",
    "contratos:download",
    // Faturamento - View Only + Download
    "faturamento:view",
    "faturamento:download",
    // Sinistralidade - View Only + Download
    "sinistralidade:view",
    "sinistralidade:download",
    // Beneficiários - View Only (coming soon)
    "beneficiarios:view",
    // Movimentação - View Only (coming soon)
    "movimentacao:view",
    // Demandas - View only
    "demandas:view",
    // Sinistros Vida - View only
    "sinistros_vida:view",
    // Client can access Configurações (limited)
    "configuracoes:view",
  ],
};

export function usePermissions() {
  const { userRole, isAdminVizio } = useEmpresa();

  const hasPermission = (permission: Permission): boolean => {
    if (!userRole) return false;
    const permissions = rolePermissions[userRole] || [];
    return permissions.includes(permission);
  };

  // Admin status (full CRUD access)
  const isAdmin = isAdminVizio || userRole === "admin_empresa";
  
  // Client status (read-only access)
  const isClient = userRole === "rh_gestor" || userRole === "visualizador";
  
  // Module-specific permissions
  const canManagePromocaoSaude = hasPermission("promocao_saude:create");
  const canViewPromocaoSaude = hasPermission("promocao_saude:view");
  const canDownloadMateriais = hasPermission("promocao_saude:download");
  
  const canManageFaturamento = hasPermission("faturamento:create");
  const canViewFaturamento = hasPermission("faturamento:view");
  const canDownloadFaturamento = hasPermission("faturamento:download");
  
  const canManageContratos = hasPermission("contratos:create");
  const canViewContratos = hasPermission("contratos:view");
  const canDownloadContratos = hasPermission("contratos:download");
  
  const canManageSinistralidade = hasPermission("sinistralidade:edit");
  const canImportSinistralidade = hasPermission("sinistralidade:import");
  const canViewSinistralidade = hasPermission("sinistralidade:view");
  const canDownloadSinistralidade = hasPermission("sinistralidade:download");
  
  const canManageBeneficiarios = hasPermission("beneficiarios:create");
  const canImportBeneficiarios = hasPermission("beneficiarios:import");
  const canViewBeneficiarios = hasPermission("beneficiarios:view");
  
  const canViewAdmin = hasPermission("admin:view");
  const canImportAdmin = hasPermission("admin:import");
  const canViewConfiguracoes = hasPermission("configuracoes:view");
  const canViewDebug = hasPermission("debug:view");

  return {
    // Core
    hasPermission,
    userRole,
    isAdmin,
    isClient,
    isAdminVizio,
    
    // Promoção de Saúde
    canManagePromocaoSaude,
    canViewPromocaoSaude,
    canDownloadMateriais,
    
    // Faturamento
    canManageFaturamento,
    canViewFaturamento,
    canDownloadFaturamento,
    
    // Contratos
    canManageContratos,
    canViewContratos,
    canDownloadContratos,
    
    // Sinistralidade
    canManageSinistralidade,
    canImportSinistralidade,
    canViewSinistralidade,
    canDownloadSinistralidade,
    
    // Beneficiários
    canManageBeneficiarios,
    canImportBeneficiarios,
    canViewBeneficiarios,
    
    // Demandas
    canViewDemandas: hasPermission("demandas:view"),
    canCreateDemandas: hasPermission("demandas:create"),
    canManageDemandas: hasPermission("demandas:edit"),
    
    // Sinistros Vida
    canViewSinistrosVida: hasPermission("sinistros_vida:view"),
    canCreateSinistrosVida: hasPermission("sinistros_vida:create"),
    canManageSinistrosVida: hasPermission("sinistros_vida:manage"),
    
    // Admin
    canViewAdmin,
    canImportAdmin,
    canViewConfiguracoes,
    canViewDebug,
  };
}
