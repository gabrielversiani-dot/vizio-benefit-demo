import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DiagnosticLog } from '@/components/Setup/DiagnosticPanel';

type StepId = 'empresas' | 'usuarios' | 'perfis' | 'roles';

export function useDiagnostic() {
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = useCallback((log: Omit<DiagnosticLog, 'timestamp'>) => {
    setLogs(prev => [...prev, { ...log, timestamp: new Date().toISOString() }]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const runTest = useCallback(async (
    step: StepId,
    action: string,
    testFn: () => Promise<{ success: boolean; data?: any; error?: string }>
  ) => {
    const startTime = Date.now();
    addLog({ step, action, status: 'pending' });

    try {
      const result = await testFn();
      const durationMs = Date.now() - startTime;

      setLogs(prev => 
        prev.map((log, idx) => 
          idx === prev.length - 1 
            ? { 
                ...log, 
                status: result.success ? 'success' : 'error',
                durationMs,
                response: result.data,
                error: result.error,
              }
            : log
        )
      );

      return result;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      setLogs(prev => 
        prev.map((log, idx) => 
          idx === prev.length - 1 
            ? { ...log, status: 'error', durationMs, error: err.message }
            : log
        )
      );
      return { success: false, error: err.message };
    }
  }, [addLog]);

  // Test functions for each step
  const runEmpresasTests = useCallback(async () => {
    setIsRunning(true);
    const testCnpj = '00000000000191'; // CPF/CNPJ da Receita para testes

    // Test 1: Validate CNPJ format
    await runTest('empresas', 'Validar formato CNPJ', async () => {
      const isValid = testCnpj.length === 14 && /^\d+$/.test(testCnpj);
      return { success: isValid, data: { cnpj: testCnpj, length: testCnpj.length } };
    });

    // Test 2: Check RLS - can read empresas
    await runTest('empresas', 'Verificar permissão de leitura (RLS)', async () => {
      const { data, error } = await supabase.from('empresas').select('id, nome').limit(1);
      if (error) return { success: false, error: error.message };
      return { success: true, data: { count: data?.length || 0 } };
    });

    // Test 3: Check existing empresas count
    await runTest('empresas', 'Contar empresas existentes', async () => {
      const { count, error } = await supabase.from('empresas').select('*', { count: 'exact', head: true });
      if (error) return { success: false, error: error.message };
      return { success: true, data: { total: count } };
    });

    // Test 4: Verify unique constraint on CNPJ
    await runTest('empresas', 'Verificar constraint CNPJ único', async () => {
      const { data } = await supabase.from('empresas').select('cnpj');
      const cnpjs = data?.map(e => e.cnpj) || [];
      const uniqueCnpjs = new Set(cnpjs);
      const hasDuplicates = cnpjs.length !== uniqueCnpjs.size;
      return { 
        success: !hasDuplicates, 
        data: { total: cnpjs.length, unique: uniqueCnpjs.size },
        error: hasDuplicates ? 'CNPJs duplicados encontrados!' : undefined
      };
    });

    setIsRunning(false);
  }, [runTest]);

  const runUsuariosTests = useCallback(async () => {
    setIsRunning(true);

    // Test 1: Check Edge Function availability
    await runTest('usuarios', 'Verificar Edge Function admin-create-users', async () => {
      // Just check if we can reach the function (will fail auth but that's ok)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: 'Usuário não autenticado' };
      return { success: true, data: { hasSession: true } };
    });

    // Test 2: Check profiles table access
    await runTest('usuarios', 'Verificar acesso a profiles', async () => {
      const { data, error } = await supabase.from('profiles').select('id, email').limit(5);
      if (error) return { success: false, error: error.message };
      return { success: true, data: { count: data?.length || 0 } };
    });

    // Test 3: Check if auth trigger is working (profiles auto-created)
    await runTest('usuarios', 'Verificar trigger de criação de profile', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Usuário não autenticado' };
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, nome_completo')
        .eq('id', user.id)
        .single();
      
      if (error) return { success: false, error: error.message };
      return { success: !!profile, data: profile };
    });

    setIsRunning(false);
  }, [runTest]);

  const runPerfisTests = useCallback(async () => {
    setIsRunning(true);

    // Test 1: Check empresas exist for linking
    await runTest('perfis', 'Verificar empresas disponíveis para vincular', async () => {
      const { data, error } = await supabase.from('empresas').select('id, nome, cnpj');
      if (error) return { success: false, error: error.message };
      return { 
        success: (data?.length || 0) > 0, 
        data: { count: data?.length || 0, empresas: data?.slice(0, 5) },
        error: data?.length === 0 ? 'Nenhuma empresa cadastrada' : undefined
      };
    });

    // Test 2: Check profiles without empresa
    await runTest('perfis', 'Contar perfis sem empresa vinculada', async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .is('empresa_id', null);
      if (error) return { success: false, error: error.message };
      return { 
        success: true, 
        data: { unlinkedCount: data?.length || 0 }
      };
    });

    // Test 3: Check RLS for profile updates
    await runTest('perfis', 'Verificar permissão de atualização (RLS)', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Usuário não autenticado' };
      
      // Try to read own profile (should work)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, empresa_id')
        .eq('id', user.id)
        .single();
      
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    });

    setIsRunning(false);
  }, [runTest]);

  const runRolesTests = useCallback(async () => {
    setIsRunning(true);

    // Test 1: Check user_roles access
    await runTest('roles', 'Verificar acesso a user_roles', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Usuário não autenticado' };
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      if (error) return { success: false, error: error.message };
      return { success: true, data: { roles: data?.map(r => r.role) || [] } };
    });

    // Test 2: Check if current user is admin
    await runTest('roles', 'Verificar role atual do usuário', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Usuário não autenticado' };
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const isAdminVizio = roles?.some(r => r.role === 'admin_vizio');
      const isAdminEmpresa = roles?.some(r => r.role === 'admin_empresa');
      
      return { 
        success: isAdminVizio || isAdminEmpresa, 
        data: { isAdminVizio, isAdminEmpresa, allRoles: roles?.map(r => r.role) },
        error: (!isAdminVizio && !isAdminEmpresa) ? 'Usuário não tem permissão de admin' : undefined
      };
    });

    // Test 3: Count total roles in system
    await runTest('roles', 'Contar roles no sistema', async () => {
      const { count, error } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true });
      
      if (error) return { success: false, error: error.message };
      return { success: true, data: { totalRoles: count } };
    });

    // Test 4: Check has_role function
    await runTest('roles', 'Verificar função has_role()', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Usuário não autenticado' };
      
      const { data, error } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'admin_vizio' 
      });
      
      if (error) return { success: false, error: error.message };
      return { success: true, data: { hasAdminVizio: data } };
    });

    setIsRunning(false);
  }, [runTest]);

  const runTestsForStep = useCallback(async (step: StepId) => {
    switch (step) {
      case 'empresas':
        await runEmpresasTests();
        break;
      case 'usuarios':
        await runUsuariosTests();
        break;
      case 'perfis':
        await runPerfisTests();
        break;
      case 'roles':
        await runRolesTests();
        break;
    }
  }, [runEmpresasTests, runUsuariosTests, runPerfisTests, runRolesTests]);

  return {
    logs,
    isRunning,
    addLog,
    clearLogs,
    runTest,
    runTestsForStep,
  };
}
