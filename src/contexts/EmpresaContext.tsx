import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  is_demo: boolean;
}

type AppRole = 'admin_vizio' | 'admin_empresa' | 'rh_gestor' | 'visualizador';

interface EmpresaContextType {
  empresaSelecionada: string | null;
  setEmpresaSelecionada: (id: string | null) => void;
  empresas: Empresa[];
  loading: boolean;
  isAdminVizio: boolean;
  userEmpresaId: string | null;
  userRole: AppRole | null;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminVizio, setIsAdminVizio] = useState(false);
  const [userEmpresaId, setUserEmpresaId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function loadUserData() {
      try {
        // Buscar role do usuário
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const roles = rolesData?.map(r => r.role) || [];
        const isVizioAdmin = roles.includes('admin_vizio');
        setIsAdminVizio(isVizioAdmin);
        
        // Set the primary role (priority: admin_vizio > admin_empresa > rh_gestor > visualizador)
        const rolePriority: AppRole[] = ['admin_vizio', 'admin_empresa', 'rh_gestor', 'visualizador'];
        const primaryRole = rolePriority.find(r => roles.includes(r)) || null;
        setUserRole(primaryRole);

        // Buscar empresa do usuário
        const { data: profileData } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('id', user.id)
          .single();

        const empresaId = profileData?.empresa_id || null;
        setUserEmpresaId(empresaId);

        // Se não for Admin Vizio, selecionar automaticamente a empresa do usuário
        if (!isVizioAdmin && empresaId) {
          setEmpresaSelecionada(empresaId);
        }

        // Buscar lista de empresas (para Admin Vizio ou para pegar nome da empresa)
        const { data: empresasData } = await supabase
          .from('empresas')
          .select('id, nome, cnpj, is_demo')
          .eq('ativo', true)
          .order('is_demo')
          .order('nome');

        setEmpresas(empresasData || []);

        // Se for Admin Vizio e ainda não tiver empresa selecionada, selecionar a primeira
        if (isVizioAdmin && !empresaSelecionada && empresasData && empresasData.length > 0) {
          setEmpresaSelecionada(empresasData[0].id);
        }

      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [user]);

  return (
    <EmpresaContext.Provider
      value={{
        empresaSelecionada,
        setEmpresaSelecionada,
        empresas,
        loading,
        isAdminVizio,
        userEmpresaId,
        userRole,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const context = useContext(EmpresaContext);
  if (context === undefined) {
    throw new Error('useEmpresa must be used within an EmpresaProvider');
  }
  return context;
}
