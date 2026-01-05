import { useState, useEffect, useCallback, useRef } from 'react';

export interface DraftData {
  empresas: any[];
  usuarios: any[];
  perfis: any[];
  roles: any[];
  lastModified: string;
}

const DRAFT_KEY = 'setup_wizard_draft';
const RESTORED_SESSION_KEY = 'setup_draft_restored_session';

export function useSetupDraft() {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const restoredStepsRef = useRef<Set<string>>(new Set());

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setDraft(parsed);
      }
      
      // Load restored steps from sessionStorage
      const restoredSession = sessionStorage.getItem(RESTORED_SESSION_KEY);
      if (restoredSession) {
        try {
          const parsed = JSON.parse(restoredSession);
          restoredStepsRef.current = new Set(parsed);
        } catch {
          // Ignore parse errors
        }
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save step data to draft
  const saveDraft = useCallback((step: keyof Omit<DraftData, 'lastModified'>, data: any[]) => {
    setDraft(prev => {
      const newDraft: DraftData = {
        empresas: prev?.empresas || [],
        usuarios: prev?.usuarios || [],
        perfis: prev?.perfis || [],
        roles: prev?.roles || [],
        [step]: data,
        lastModified: new Date().toISOString(),
      };
      
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(newDraft));
      } catch (e) {
        console.error('Error saving draft:', e);
      }
      
      return newDraft;
    });
  }, []);

  // Clear draft completely
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(RESTORED_SESSION_KEY);
      restoredStepsRef.current.clear();
    } catch (e) {
      console.error('Error clearing draft:', e);
    }
    setDraft(null);
  }, []);

  // Clear draft for a specific step
  const clearStepDraft = useCallback((step: keyof Omit<DraftData, 'lastModified'>) => {
    setDraft(prev => {
      if (!prev) return null;
      
      const newDraft: DraftData = {
        ...prev,
        [step]: [],
        lastModified: new Date().toISOString(),
      };
      
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(newDraft));
      } catch (e) {
        console.error('Error saving draft:', e);
      }
      
      return newDraft;
    });
    
    // Also clear the restored flag for this step
    restoredStepsRef.current.delete(step);
    try {
      sessionStorage.setItem(RESTORED_SESSION_KEY, JSON.stringify([...restoredStepsRef.current]));
    } catch {
      // Ignore
    }
  }, []);

  // Get step data from draft
  const getStepDraft = useCallback((step: keyof Omit<DraftData, 'lastModified'>): any[] => {
    return draft?.[step] || [];
  }, [draft]);

  // Check if restore toast was already shown for this step in this session
  const wasRestoreShown = useCallback((step: keyof Omit<DraftData, 'lastModified'>): boolean => {
    return restoredStepsRef.current.has(step);
  }, []);

  // Mark restore toast as shown for this step
  const markRestoreShown = useCallback((step: keyof Omit<DraftData, 'lastModified'>) => {
    restoredStepsRef.current.add(step);
    try {
      sessionStorage.setItem(RESTORED_SESSION_KEY, JSON.stringify([...restoredStepsRef.current]));
    } catch {
      // Ignore sessionStorage errors
    }
  }, []);

  // Dismiss restore toast for a step (same as marking shown)
  const dismissRestore = useCallback((step: keyof Omit<DraftData, 'lastModified'>) => {
    markRestoreShown(step);
  }, [markRestoreShown]);

  // Check if draft has data
  const hasDraft = draft && (
    draft.empresas.length > 0 ||
    draft.usuarios.length > 0 ||
    draft.perfis.length > 0 ||
    draft.roles.length > 0
  );

  // Check if specific step has draft data
  const hasStepDraft = useCallback((step: keyof Omit<DraftData, 'lastModified'>): boolean => {
    return (draft?.[step]?.length ?? 0) > 0;
  }, [draft]);

  return {
    draft,
    isLoaded,
    hasDraft,
    saveDraft,
    clearDraft,
    clearStepDraft,
    getStepDraft,
    hasStepDraft,
    wasRestoreShown,
    markRestoreShown,
    dismissRestore,
  };
}
