import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { FinanceConnection } from '../types/finance';
import { runFinanceSync, type SyncRunReport } from '../services/financeSyncRunner';
import { dataSync } from '../../../services/dataSync';

const QUICK_SYNC_STALE_MS = 30 * 60 * 1000;
const BANK_REFRESH_STALE_MS = 4 * 60 * 60 * 1000;

export interface UseFinanceAutoSyncOptions {
  connections: FinanceConnection[];
  enabled?: boolean;
  onSyncReport?: (report: SyncRunReport) => void;
}

/**
 * Foreground Stale-While-Revalidate (SyncEngine v2 §7.3-C):
 * - Exibe dados do SQLite imediatamente
 * - Se last_sync_at > 30 min: dispara quick_sync silencioso
 * - Se last_bank_refresh_at > 4h: dispara bank_refresh (PATCH /items/{id})
 * - Reavalia ao retornar do background (AppState -> active)
 */
export function useFinanceAutoSync({
  connections,
  enabled = true,
  onSyncReport,
}: UseFinanceAutoSyncOptions): { triggerAutoSync: () => Promise<void> } {
  const runningRef = useRef(false);
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  const triggerAutoSync = useCallback(async () => {
    if (!enabled || runningRef.current) return;
    const conns = connectionsRef.current;
    if (!conns || conns.length === 0) return;

    const now = Date.now();
    const needsBankRefresh = conns.some((c) => {
      if (!c.last_bank_refresh_at) return true;
      const ms = Date.parse(c.last_bank_refresh_at);
      return Number.isNaN(ms) || now - ms > BANK_REFRESH_STALE_MS;
    });
    const needsQuickSync = conns.some((c) => {
      if (!c.last_sync_at) return true;
      const ms = Date.parse(c.last_sync_at);
      return Number.isNaN(ms) || now - ms > QUICK_SYNC_STALE_MS;
    });

    if (!needsBankRefresh && !needsQuickSync) return;

    runningRef.current = true;
    try {
      const report = await runFinanceSync({
        mode: needsBankRefresh ? 'bank_refresh' : 'quick_sync',
      });
      onSyncReport?.(report);
      if (!report.skippedByLock) {
        dataSync.notify('refresh_finance');
      }
    } finally {
      runningRef.current = false;
    }
  }, [enabled, onSyncReport]);

  useEffect(() => {
    if (!enabled) return;
    void triggerAutoSync();
  }, [enabled, connections.length, triggerAutoSync]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void triggerAutoSync();
      }
    });
    return () => sub.remove();
  }, [enabled, triggerAutoSync]);

  return { triggerAutoSync };
}
