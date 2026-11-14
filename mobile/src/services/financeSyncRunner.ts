import { api } from './api';
import * as byokStore from './byokStore';
import { authenticate } from './pluggyService';
import { syncPluggyItem } from './pluggySync';

/**
 * Executa o Edge-Sync para todas as conexões cadastradas do usuário.
 * Usado pelo pull-to-refresh e na recuperação automática de extrato.
 */
export async function syncAllUserConnections(): Promise<number> {
  try {
    const keys = await byokStore.getKeys();
    if (!keys) return 0;

    const conns = await api.finance.getConnections().catch(() => []);
    if (!Array.isArray(conns) || conns.length === 0) return 0;

    const apiKey = await authenticate(keys.clientId, keys.clientSecret);
    let totalTxs = 0;
    for (const c of conns) {
      if (c.pluggy_item_id) {
        const res = await syncPluggyItem(apiKey, c.pluggy_item_id).catch(() => null);
        if (res) totalTxs += res.transactionsCount;
      }
    }
    return totalTxs;
  } catch {
    return 0;
  }
}
