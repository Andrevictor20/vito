import { api } from './api';
import type { FinanceAccount, FinanceConnection, FinanceSyncPayload } from '../types/finance';
import { getItem, listItems, PluggyError, type PluggyItem } from './pluggyService';
import { pluggyFetchWithRetry, type PluggyHttpOptions } from './pluggyHttp';
import * as byokStore from './byokStore';

/**
 * SyncEngine v2 (Edge-Sync Zero IP Leak):
 * - Dispara PATCH /items/{id} respeitando cooldown (2h auto / 15m manual) + polling exponencial
 * - Trata WAITING_USER_INPUT / LOGIN_ERROR / OUTDATED / UPDATING via PATCH /finance/connections/{id}/status
 * - Coleta incremental com overlap de 10 dias para capturar PENDING -> POSTED e estornos
 * - Auto-renova apiKey em 401 quando callback onRefreshApiKey é fornecido
 */
export type SyncMode = 'quick_sync' | 'bank_refresh' | 'manual';

export interface PluggySyncResult {
  accountsCount: number;
  transactionsCount: number;
  itemId: string;
  institutionName: string;
  status: FinanceConnection['status'];
  needsReconnect?: boolean;
  skippedNoChange?: boolean;
  errorMessage?: string;
}

export interface SyncPluggyItemOptions {
  mode?: SyncMode;
  connectionId?: string;
  lastSyncAt?: string;
  lastBankRefreshAt?: string;
  isBackground?: boolean;
  onRefreshApiKey?: () => Promise<string>;
  httpOptions?: PluggyHttpOptions;
}

interface RawRecord {
  [k: string]: unknown;
}

const AUTO_REFRESH_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const MANUAL_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;
const INCREMENTAL_OVERLAP_MS = 10 * 24 * 60 * 60 * 1000;
const POLL_DELAYS_MS = [2000, 4000, 6000, 10000];

const RECURRING_PATTERNS = [
  /netflix/i, /spotify/i, /google/i, /prime/i, /amazon/i, /apple/i, /icloud/i,
  /claro/i, /vivo/i, /tim/i, /deezer/i, /max/i, /disney/i, /uber\s*pass/i,
  /youtube/i, /chatgpt/i, /openai/i, /gympass/i, /totalpass/i, /smartfit/i,
  /assinatura/i, /mensalidade/i, /streaming/i, /sem\s*parar/i, /veloe/i,
  /dropbox/i, /github/i, /notion/i, /cursor/i, /globo/i, /premiere/i,
];

const results = (j: RawRecord | RawRecord[] | null): RawRecord[] => {
  if (Array.isArray(j)) return j;
  const r = j?.results;
  return Array.isArray(r) ? (r as RawRecord[]) : [];
};

function extractDay(dateStr: unknown): number | undefined {
  if (!dateStr || typeof dateStr !== 'string') return undefined;
  const d = new Date(dateStr);
  const day = d.getUTCDate();
  return isNaN(day) || day < 1 || day > 31 ? undefined : day;
}

function mapPluggyStatus(rawStatus?: string): FinanceConnection['status'] {
  switch (rawStatus) {
    case 'WAITING_USER_INPUT':
      return 'WAITING_USER_INPUT';
    case 'LOGIN_ERROR':
      return 'LOGIN_ERROR';
    case 'OUTDATED':
      return 'OUTDATED';
    case 'UPDATING':
      return 'UPDATING';
    default:
      return 'UPDATED';
  }
}

async function fetchPluggyJson(
  url: string,
  state: { apiKey: string },
  options?: SyncPluggyItemOptions,
  init: RequestInit = {},
): Promise<RawRecord | RawRecord[] | null> {
  const exec = (key: string) =>
    pluggyFetchWithRetry(
      url,
      { ...init, headers: { 'X-API-KEY': key, 'Content-Type': 'application/json', ...(init.headers || {}) } },
      options?.httpOptions,
    );

  let resp = await exec(state.apiKey);
  if (resp.status === 401 && options?.onRefreshApiKey) {
    state.apiKey = await options.onRefreshApiKey();
    resp = await exec(state.apiKey);
  }
  if (!resp.ok) {
    throw new PluggyError('http', `Pluggy respondeu HTTP ${resp.status} em ${url.split('?')[0]}`, resp.status);
  }
  return (await resp.json()) as RawRecord | RawRecord[];
}

function shouldTriggerBankRefresh(mode: SyncMode, lastBankRefreshAt?: string): boolean {
  if (mode === 'quick_sync') return false;
  if (!lastBankRefreshAt) return true;
  const lastMs = Date.parse(lastBankRefreshAt);
  if (Number.isNaN(lastMs)) return true;
  const cooldown = mode === 'manual' ? MANUAL_REFRESH_COOLDOWN_MS : AUTO_REFRESH_COOLDOWN_MS;
  return Date.now() - lastMs >= cooldown;
}

async function refreshAndPollItem(
  resolved: string,
  state: { apiKey: string },
  options?: SyncPluggyItemOptions,
): Promise<{ item: PluggyItem | null; refreshedAt?: string }> {
  const mode = options?.mode ?? 'quick_sync';
  const sleepImpl = options?.httpOptions?.sleepImpl ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let refreshedAt: string | undefined;

  if (shouldTriggerBankRefresh(mode, options?.lastBankRefreshAt)) {
    try {
      await fetchPluggyJson(`https://api.pluggy.ai/items/${encodeURIComponent(resolved)}`, state, options, {
        method: 'PATCH',
      });
      refreshedAt = new Date().toISOString();
    } catch {
      // Se PATCH falhar por cota/conector, segue para leitura do item atual
    }
  }

  const maxBudgetMs = options?.isBackground ? 90_000 : 45_000;
  const startedAt = Date.now();
  let item = await getItem(state.apiKey, resolved, options?.httpOptions?.fetchImpl).catch(() => null);
  let pollIdx = 0;

  while (item?.status === 'UPDATING' && Date.now() - startedAt < maxBudgetMs) {
    const delay = POLL_DELAYS_MS[Math.min(pollIdx, POLL_DELAYS_MS.length - 1)];
    await sleepImpl(delay);
    pollIdx += 1;
    item = await getItem(state.apiKey, resolved, options?.httpOptions?.fetchImpl).catch(() => item);
  }

  return { item, refreshedAt };
}

export async function syncPluggyItem(
  apiKey: string,
  itemId?: string,
  onProgress?: (completedCheckpoints: number) => void,
  options?: SyncPluggyItemOptions,
): Promise<PluggySyncResult> {
  const keyState = { apiKey };
  let resolved = itemId ? itemId.trim() : undefined;
  if (!resolved || resolved.startsWith('item_')) {
    try {
      const clientUserId = await byokStore.getClientUserId().catch(() => '');
      let items: PluggyItem[] = [];
      if (clientUserId) items = await listItems(keyState.apiKey, clientUserId).catch(() => []);
      if (!items || items.length === 0) items = await listItems(keyState.apiKey).catch(() => []);
      resolved = items[0]?.id;
    } catch (e) {
      if (e instanceof PluggyError && (e.kind === 'list_items_disabled' || e.kind === 'http')) {
        resolved = undefined;
      } else {
        throw e;
      }
    }
  }
  if (!resolved) {
    return { accountsCount: 0, transactionsCount: 0, itemId: '', institutionName: '', status: 'UPDATED' };
  }

  onProgress?.(3);

  const { item: itemDetails, refreshedAt } = await refreshAndPollItem(resolved, keyState, options);
  const mappedStatus = mapPluggyStatus(itemDetails?.status);
  const instFallback = itemDetails?.connector?.name || 'Meu Pluggy';

  if (mappedStatus === 'WAITING_USER_INPUT' || mappedStatus === 'LOGIN_ERROR' || mappedStatus === 'OUTDATED') {
    if (options?.connectionId) {
      await api.finance
        .updateConnectionStatus(options.connectionId, {
          status: mappedStatus,
          pluggy_execution_status: itemDetails?.executionStatus || itemDetails?.status,
          last_error_code: String(itemDetails?.error?.code || mappedStatus),
          last_error_message: String(itemDetails?.error?.message || 'Reconexão necessária no banco.'),
          last_bank_refresh_at: refreshedAt,
        })
        .catch(() => {});
    }
    return {
      accountsCount: 0,
      transactionsCount: 0,
      itemId: resolved,
      institutionName: instFallback,
      status: mappedStatus,
      needsReconnect: true,
    };
  }

  if (mappedStatus === 'UPDATING') {
    if (options?.connectionId) {
      await api.finance
        .updateConnectionStatus(options.connectionId, {
          status: 'UPDATING',
          pluggy_execution_status: itemDetails?.executionStatus || 'UPDATING',
          last_bank_refresh_at: refreshedAt,
        })
        .catch(() => {});
    }
    return {
      accountsCount: 0,
      transactionsCount: 0,
      itemId: resolved,
      institutionName: instFallback,
      status: 'UPDATING',
    };
  }

  const accRaw = results(
    await fetchPluggyJson(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(resolved)}`, keyState, options),
  );

  const accounts: NonNullable<FinanceSyncPayload['accounts']> = [];
  for (const a of accRaw) {
    const accType = a.type === 'CREDIT' ? ('CREDIT' as const) : ('BANK' as const);
    const creditData = (a.creditData || {}) as Record<string, unknown>;
    const creditLimit = typeof creditData.creditLimit === 'number' ? creditData.creditLimit : undefined;
    const availableCreditLimit = typeof creditData.availableCreditLimit === 'number' ? creditData.availableCreditLimit : undefined;
    let closingDay = extractDay(creditData.balanceCloseDate);
    let dueDay = extractDay(creditData.balanceDueDate);
    let minimumPayment = typeof creditData.minimumPayment === 'number' ? creditData.minimumPayment : undefined;

    if (accType === 'CREDIT') {
      try {
        const billsRaw = results(
          await fetchPluggyJson(`https://api.pluggy.ai/bills?accountId=${encodeURIComponent(String(a.id))}`, keyState, options),
        );
        if (billsRaw.length > 0) {
          const latestBill = billsRaw[0];
          if (!dueDay) dueDay = extractDay(latestBill.dueDate);
          if (!closingDay) closingDay = extractDay(latestBill.billClosingDate);
          if (typeof latestBill.minimumPaymentAmount === 'number' && !minimumPayment) {
            minimumPayment = latestBill.minimumPaymentAmount;
          }
        }
      } catch {
        // Fallback tolerante caso /bills não esteja disponível
      }
    }

    accounts.push({
      pluggy_account_id: String(a.id),
      institution_name: String(a.marketingName || a.name || instFallback),
      account_type: accType,
      account_subtype: a.subtype as FinanceAccount['account_subtype'],
      name: String(a.name || (accType === 'CREDIT' ? 'Cartão de Crédito' : 'Conta Corrente')),
      balance: Number(a.balance || 0),
      credit_limit: creditLimit,
      available_credit_limit: availableCreditLimit,
      currency_code: String(a.currencyCode || 'BRL'),
      closing_day: closingDay,
      due_day: dueDay,
      minimum_payment: minimumPayment,
    });
  }

  const institutionName = accounts[0]?.institution_name || instFallback;
  onProgress?.(4);

  const cutoffMs = options?.lastSyncAt ? Date.parse(options.lastSyncAt) - INCREMENTAL_OVERLAP_MS : NaN;
  const transactions: NonNullable<FinanceSyncPayload['transactions']> = [];

  for (const acc of accounts) {
    const pluggyAccountId = String(acc.pluggy_account_id);
    let nextUrl: string | null = `https://api.pluggy.ai/v2/transactions?accountId=${encodeURIComponent(pluggyAccountId)}`;
    let pagesFetched = 0;

    while (nextUrl && pagesFetched < 10) {
      const pageData = await fetchPluggyJson(nextUrl, keyState, options);
      const txs = results(pageData);
      let allOlderThanCutoff = !Number.isNaN(cutoffMs) && txs.length > 0;

      for (const t of txs) {
        const occurredAtStr = String(t.date || new Date().toISOString());
        const occurredMs = Date.parse(occurredAtStr);
        if (!Number.isNaN(cutoffMs) && !Number.isNaN(occurredMs) && occurredMs >= cutoffMs) {
          allOlderThanCutoff = false;
        }

        const rawAmount = Math.abs(Number(t.amount || 0));
        const isDebit = t.type === 'DEBIT' || Number(t.amount || 0) < 0;
        const amount = isDebit ? -rawAmount : rawAmount;
        const transactionType = isDebit ? ('DEBIT' as const) : ('CREDIT' as const);

        const merchant = t.merchant as { name?: string } | undefined;
        const desc = String(t.description || 'Lançamento');
        const cleanMerchant = merchant?.name || (t.merchantName as string | undefined) || undefined;
        const isRecurring = Boolean(
          t.isRecurring ||
          RECURRING_PATTERNS.some((p) => p.test(desc) || (cleanMerchant && p.test(cleanMerchant))),
        );

        const cardMeta = (t.creditCardMetadata || {}) as Record<string, unknown>;
        const installment = (t.installment || {}) as Record<string, unknown>;
        const installmentNumber = Number(cardMeta.installmentNumber ?? installment.number ?? 0) || undefined;
        const totalInstallments = Number(cardMeta.totalInstallments ?? installment.total ?? 0) || undefined;
        const mcc = Number(cardMeta.mcc) || undefined;
        const paymentType = (cardMeta.paymentType as string | undefined) || undefined;
        const txStatus = (t.status as string | undefined) || 'POSTED';

        transactions.push({
          pluggy_account_id: pluggyAccountId,
          pluggy_transaction_id: String(t.id),
          description: desc,
          clean_merchant_name: cleanMerchant,
          amount,
          transaction_type: transactionType,
          payment_method: (t.paymentMethod as string | undefined) || (acc.account_type === 'CREDIT' ? 'CREDIT_CARD' : undefined),
          category: String(t.category || 'Geral'),
          is_recurring: isRecurring,
          occurred_at: occurredAtStr,
          installment_number: installmentNumber,
          total_installments: totalInstallments,
          payment_type: paymentType,
          mcc,
          status: txStatus,
        });
      }

      if (allOlderThanCutoff) break;

      const rawObj = pageData && typeof pageData === 'object' && !Array.isArray(pageData) ? (pageData as RawRecord) : null;
      const nextQuery = typeof rawObj?.next === 'string' ? rawObj.next : null;
      nextUrl = nextQuery
        ? `https://api.pluggy.ai/v2/transactions${nextQuery.startsWith('?') ? nextQuery : `?${nextQuery}`}`
        : null;
      pagesFetched += 1;
    }
  }
  onProgress?.(5);

  await api.finance.sync({
    connection_id: options?.connectionId,
    pluggy_item_id: resolved,
    connector_id: itemDetails?.connector?.id ?? 200,
    institution_name: institutionName,
    status: 'UPDATED',
    pluggy_execution_status: itemDetails?.executionStatus || 'SUCCESS',
    last_bank_refresh_at: refreshedAt,
    accounts,
    transactions,
  });
  onProgress?.(6);

  return {
    accountsCount: accounts.length,
    transactionsCount: transactions.length,
    itemId: resolved,
    institutionName,
    status: 'UPDATED',
  };
}
