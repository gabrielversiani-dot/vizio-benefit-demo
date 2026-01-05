import { useState, useEffect, useCallback } from 'react';

export interface DraftData {
  empresas: any[];
  usuarios: any[];
  perfis: any[];
  roles: any[];
  lastModified: string;
}

const DRAFT_KEY = 'setup_wizard_draft';

export function useSetupDraft() {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setDraft(parsed);
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

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      console.error('Error clearing draft:', e);
    }
    setDraft(null);
  }, []);

  // Get step data from draft
  const getStepDraft = useCallback((step: keyof Omit<DraftData, 'lastModified'>): any[] => {
    return draft?.[step] || [];
  }, [draft]);

  // Check if draft has data
  const hasDraft = draft && (
    draft.empresas.length > 0 ||
    draft.usuarios.length > 0 ||
    draft.perfis.length > 0 ||
    draft.roles.length > 0
  );

  return {
    draft,
    isLoaded,
    hasDraft,
    saveDraft,
    clearDraft,
    getStepDraft,
  };
}
