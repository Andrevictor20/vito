import { api } from './api';
import type { FinanceAccount, FinanceSyncPayload } from '../types/finance';
import { listItems, PluggyError } from './pluggyService';

/**
 * Edge-Sync (Zero IP Leak): o celular lê contas/transações direto da Pluggy
 * e envia o payload consolidado ao backend (`POST /api/v1/finance/sync`).
 * Movido de PluggyConnectModal.tsx (Plano 26). Mantém o fix `pageSize` (HTTP 400).
 */
export interface PluggySyncResult {
  accountsCount: number;
  transactionsCount: number;
  itemId: string;
  institutionName: string;
}

interface RawRecord {
  [k: string]: unknown;
}

async function getJson(url: string, apiKey: string): Promise<RawRecord | RawRecord[] | null> {
  const resp = await fetch(url, { headers: { 'X-API-KEY': apiKey } });
  if (!resp.ok) throw new Error(`Pluggy respondeu HTTP ${resp.status} em ${url.split('?')[0]}`);
  return (await resp.json()) as RawRecord | RawRecord[];
}

const results = (j: RawRecord | RawRecord[] | null): RawRecord[] => {
  if (Array.isArray(j)) return j;
  const r = j?.results;
  return Array.isArray(r) ? (r as RawRecord[]) : [];
};

export async function syncPluggyItem(
  apiKey: string,
  itemId?: string,
  onProgress?: (completedCheckpoints: number) => void,
): Promise<PluggySyncResult> {
  let resolved = itemId;
  if (!resolved || resolved.startsWith('item_')) {
    try {
      const items = await listItems(apiKey);
      resolved = items[0]?.id;
    } catch (e) {
      if (e instanceof PluggyError && e.kind === 'list_items_disabled') {
        resolved = undefined;
      } else {
        throw e;
      }
    }
  }
  if (!resolved) return { accountsCount: 0, transactionsCount: 0, itemId: '', institutionName: '' };

  onProgress?.(3);

  const accRaw = results(await getJson(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(resolved)}`, apiKey));
  const accounts = accRaw.map((a) => ({
    pluggy_account_id: String(a.id),
    institution_name: String(a.marketingName || a.name || 'Banco'),
    account_type: a.type === 'CREDIT' ? ('CREDIT' as const) : ('BANK' as const),
    account_subtype: a.subtype as FinanceAccount['account_subtype'],
    name: String(a.name || (a.type === 'CREDIT' ? 'Cartão de Crédito' : 'Conta Corrente')),
    balance: Number(a.balance || 0),
    currency_code: String(a.currencyCode || 'BRL'),
  }));

  const institutionName = accounts[0]?.institution_name || 'Meu Pluggy';
  if (accounts.length > 0) {
    await api.finance
      .createConnection({ pluggy_item_id: resolved, connector_id: 200, institution_name: institutionName })
      .catch(() => {});
  }
  onProgress?.(4);

  const transactions: NonNullable<FinanceSyncPayload['transactions']> = [];
  for (const acc of accounts) {
    const txs = results(
      await getJson(`https://api.pluggy.ai/v2/transactions?accountId=${encodeURIComponent(acc.pluggy_account_id)}`, apiKey),
    );
    for (const t of txs) {
      const amount = Number(t.amount || 0);
      const merchant = t.merchant as { name?: string } | undefined;
      transactions.push({
        pluggy_transaction_id: String(t.id),
        description: String(t.description || 'Lançamento'),
        clean_merchant_name: merchant?.name || (t.merchantName as string | undefined) || undefined,
        amount,
        transaction_type: amount < 0 || t.type === 'DEBIT' ? 'DEBIT' : 'CREDIT',
        payment_method: t.paymentMethod as string | undefined,
        category: String(t.category || 'Geral'),
        occurred_at: String(t.date || new Date().toISOString()),
      });
    }
  }
  onProgress?.(5);

  await api.finance.sync({
    pluggy_item_id: resolved,
    institution_name: institutionName,
    accounts,
    transactions,
  });
  onProgress?.(6);
  return { accountsCount: accounts.length, transactionsCount: transactions.length, itemId: resolved, institutionName };
}
