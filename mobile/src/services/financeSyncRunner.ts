import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import * as byokStore from './byokStore';
import { clearPluggyApiKeyCache, getOrRefreshPluggyApiKey } from './pluggyHttp';
import { syncPluggyItem, type PluggySyncResult, type SyncMode } from './pluggySync';

const SYNC_LOCK_KEY = 'vito:finance:sync_lock_until';
const LOCK_TTL_MS = 120_000;
const MAX_CONCURRENCY = 2;

export interface SyncItemReport {
  connectionId: string;
  itemId: string;
  institutionName: string;
  ok: boolean;
  status: string;
  accountsCount: number;
  transactionsCount: number;
  needsReconnect?: boolean;
  error?: string;
}

export interface SyncRunReport {
  totalTransactions: number;
  totalAccounts: number;
  items: SyncItemReport[];
  skippedByLock?: boolean;
}

export interface RunFinanceSyncOptions {
  mode?: SyncMode;
  isBackground?: boolean;
  onItemProgress?: (report: SyncItemReport) => void;
}

let inFlightPromise: Promise<SyncRunReport> | null = null;

async function acquireStorageLock(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_LOCK_KEY);
    if (raw && Number(raw) > Date.now()) {
      return false;
    }
    await AsyncStorage.setItem(SYNC_LOCK_KEY, String(Date.now() + LOCK_TTL_MS));
    return true;
  } catch {
    return true;
  }
}

async function releaseStorageLock(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SYNC_LOCK_KEY);
  } catch {
    // Ignore storage lock cleanup failure
  }
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const idx = cursor++;
      try {
        const value = await tasks[idx]();
        results[idx] = { status: 'fulfilled', value };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * SyncCoordinator: mutex single-flight + isolamento por banco (Promise.allSettled, concorrência 2).
 */
export async function runFinanceSync(options: RunFinanceSyncOptions = {}): Promise<SyncRunReport> {
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async (): Promise<SyncRunReport> => {
    const acquired = await acquireStorageLock();
    if (!acquired) {
      return { totalTransactions: 0, totalAccounts: 0, items: [], skippedByLock: true };
    }

    try {
      const keys = await byokStore.getKeys();
      if (!keys) return { totalTransactions: 0, totalAccounts: 0, items: [] };

      const conns = await api.finance.getConnections().catch(() => []);
      if (!Array.isArray(conns) || conns.length === 0) {
        return { totalTransactions: 0, totalAccounts: 0, items: [] };
      }

      const apiKey = await getOrRefreshPluggyApiKey(keys.clientId, keys.clientSecret);
      const validConns = conns.filter((c) => Boolean(c.pluggy_item_id));

      const tasks = validConns.map((c) => async (): Promise<SyncItemReport> => {
        try {
          const res: PluggySyncResult = await syncPluggyItem(apiKey, c.pluggy_item_id, undefined, {
            mode: options.mode ?? 'manual',
            connectionId: c.id,
            lastSyncAt: c.last_sync_at,
            lastBankRefreshAt: c.last_bank_refresh_at,
            isBackground: options.isBackground,
            onRefreshApiKey: () => {
              clearPluggyApiKeyCache();
              return getOrRefreshPluggyApiKey(keys.clientId, keys.clientSecret, true);
            },
          });
          const itemReport: SyncItemReport = {
            connectionId: c.id,
            itemId: c.pluggy_item_id,
            institutionName: res.institutionName || c.institution_name,
            ok: !res.needsReconnect,
            status: res.status,
            accountsCount: res.accountsCount,
            transactionsCount: res.transactionsCount,
            needsReconnect: res.needsReconnect,
          };
          options.onItemProgress?.(itemReport);
          return itemReport;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Erro desconhecido ao sincronizar';
          await api.finance
            .updateConnectionStatus(c.id, {
              status: 'OUTDATED',
              last_error_code: 'SYNC_ERROR',
              last_error_message: errMsg,
            })
            .catch(() => {});
          const itemReport: SyncItemReport = {
            connectionId: c.id,
            itemId: c.pluggy_item_id,
            institutionName: c.institution_name,
            ok: false,
            status: 'OUTDATED',
            accountsCount: 0,
            transactionsCount: 0,
            error: errMsg,
          };
          options.onItemProgress?.(itemReport);
          return itemReport;
        }
      });

      const settled = await runWithConcurrency(tasks, MAX_CONCURRENCY);
      const items: SyncItemReport[] = settled.map((s, idx) =>
        s.status === 'fulfilled'
          ? s.value
          : {
              connectionId: validConns[idx].id,
              itemId: validConns[idx].pluggy_item_id,
              institutionName: validConns[idx].institution_name,
              ok: false,
              status: 'OUTDATED',
              accountsCount: 0,
              transactionsCount: 0,
              error: s.reason instanceof Error ? s.reason.message : 'Falha isolada',
            },
      );

      const totalTransactions = items.reduce((acc, i) => acc + i.transactionsCount, 0);
      const totalAccounts = items.reduce((acc, i) => acc + i.accountsCount, 0);
      return { totalTransactions, totalAccounts, items };
    } finally {
      await releaseStorageLock();
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/**
 * Retrocompatível: executa Edge-Sync para todas as conexões e retorna o total de transações processadas.
 */
export async function syncAllUserConnections(): Promise<number> {
  const report = await runFinanceSync({ mode: 'manual' });
  return report.totalTransactions;
}
