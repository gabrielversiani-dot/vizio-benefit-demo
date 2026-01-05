import { useState, useCallback } from 'react';

export interface AuditSnapshot {
  id: string;
  step: string;
  timestamp: string;
  expiresAt: string;
  previousData: Record<string, any>[];
  appliedData: Record<string, any>[];
}

const UNDO_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const SNAPSHOTS_KEY = 'setup_undo_snapshots';

export function useSetupUndo() {
  const [snapshots, setSnapshots] = useState<AuditSnapshot[]>(() => {
    try {
      const stored = localStorage.getItem(SNAPSHOTS_KEY);
      if (stored) {
        const parsed: AuditSnapshot[] = JSON.parse(stored);
        // Filter out expired snapshots
        const now = Date.now();
        return parsed.filter(s => new Date(s.expiresAt).getTime() > now);
      }
    } catch (e) {
      console.error('Error loading snapshots:', e);
    }
    return [];
  });

  // Create a snapshot before applying changes
  const createSnapshot = useCallback((
    step: string,
    previousData: Record<string, any>[],
    appliedData: Record<string, any>[]
  ): string => {
    const id = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + UNDO_EXPIRY_MS);

    const snapshot: AuditSnapshot = {
      id,
      step,
      timestamp: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      previousData,
      appliedData,
    };

    setSnapshots(prev => {
      const updated = [...prev, snapshot];
      try {
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving snapshot:', e);
      }
      return updated;
    });

    return id;
  }, []);

  // Get active (non-expired) snapshots
  const getActiveSnapshots = useCallback((): AuditSnapshot[] => {
    const now = Date.now();
    return snapshots.filter(s => new Date(s.expiresAt).getTime() > now);
  }, [snapshots]);

  // Get a specific snapshot
  const getSnapshot = useCallback((id: string): AuditSnapshot | undefined => {
    const now = Date.now();
    return snapshots.find(s => s.id === id && new Date(s.expiresAt).getTime() > now);
  }, [snapshots]);

  // Remove a snapshot (after undo or expiry)
  const removeSnapshot = useCallback((id: string) => {
    setSnapshots(prev => {
      const updated = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Error removing snapshot:', e);
      }
      return updated;
    });
  }, []);

  // Calculate time remaining for undo
  const getTimeRemaining = useCallback((snapshotId: string): number => {
    const snapshot = snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return 0;
    const remaining = new Date(snapshot.expiresAt).getTime() - Date.now();
    return Math.max(0, remaining);
  }, [snapshots]);

  return {
    snapshots: getActiveSnapshots(),
    createSnapshot,
    getSnapshot,
    removeSnapshot,
    getTimeRemaining,
  };
}
