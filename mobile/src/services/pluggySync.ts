import { api } from './api';
import type { FinanceAccount, FinanceSyncPayload, FinanceTransaction } from '../types/finance';
import { getItem, listItems, PluggyError, type PluggyItem } from './pluggyService';
import * as byokStore from './byokStore';

/**
 * Edge-Sync (Zero IP Leak): o celular lê contas/transações direto da Pluggy
 * e envia o payload consolidado ao backend (`POST /api/v1/finance/sync`).
 * Pagina transações com cursor `next`, extrai faturas/limites e classifica recorrências.
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

const RECURRING_PATTERNS = [
  /netflix/i, /spotify/i, /google/i, /prime/i, /amazon/i, /apple/i, /icloud/i,
  /claro/i, /vivo/i, /tim/i, /deezer/i, /max/i, /disney/i, /uber\s*pass/i,
  /youtube/i, /chatgpt/i, /openai/i, /gympass/i, /totalpass/i, /smartfit/i,
  /assinatura/i, /mensalidade/i, /streaming/i, /sem\s*parar/i, /veloe/i,
  /dropbox/i, /github/i, /notion/i, /cursor/i, /globo/i, /premiere/i,
];

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

function extractDay(dateStr: unknown): number | undefined {
  if (!dateStr || typeof dateStr !== 'string') return undefined;
  const d = new Date(dateStr);
  const day = d.getUTCDate();
  return isNaN(day) || day < 1 || day > 31 ? undefined : day;
}

export async function syncPluggyItem(
  apiKey: string,
  itemId?: string,
  onProgress?: (completedCheckpoints: number) => void,
): Promise<PluggySyncResult> {
  let resolved = itemId ? itemId.trim() : undefined;
  if (!resolved || resolved.startsWith('item_')) {
    try {
      const clientUserId = await byokStore.getClientUserId().catch(() => '');
      let items: PluggyItem[] = [];
      if (clientUserId) {
        items = await listItems(apiKey, clientUserId).catch(() => []);
      }
      if (!items || items.length === 0) {
        items = await listItems(apiKey).catch(() => []);
      }
      resolved = items[0]?.id;
    } catch (e) {
      if (e instanceof PluggyError && (e.kind === 'list_items_disabled' || e.kind === 'http')) {
        resolved = undefined;
      } else {
        throw e;
      }
    }
  }
  if (!resolved) return { accountsCount: 0, transactionsCount: 0, itemId: '', institutionName: '' };

  onProgress?.(3);

  const itemDetails = await getItem(apiKey, resolved).catch(() => null);

  let accRaw = results(await getJson(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(resolved)}`, apiKey));
  if (accRaw.length === 0 && itemDetails?.status === 'UPDATING') {
    await new Promise((r) => setTimeout(r, 2200));
    accRaw = results(await getJson(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(resolved)}`, apiKey));
  }

  const accounts: NonNullable<FinanceSyncPayload['accounts']> = [];
  for (const a of accRaw) {
    const accType = a.type === 'CREDIT' ? ('CREDIT' as const) : ('BANK' as const);
    const creditData = (a.creditData || {}) as Record<string, unknown>;
    let creditLimit = typeof creditData.creditLimit === 'number' ? creditData.creditLimit : undefined;
    let availableCreditLimit = typeof creditData.availableCreditLimit === 'number' ? creditData.availableCreditLimit : undefined;
    let closingDay = extractDay(creditData.balanceCloseDate);
    let dueDay = extractDay(creditData.balanceDueDate);
    let minimumPayment = typeof creditData.minimumPayment === 'number' ? creditData.minimumPayment : undefined;

    // Se for cartão de crédito e faltar vencimento ou fechamento, busca em /bills
    if (accType === 'CREDIT') {
      try {
        const billsRaw = results(await getJson(`https://api.pluggy.ai/bills?accountId=${encodeURIComponent(String(a.id))}&pageSize=3`, apiKey));
        if (billsRaw.length > 0) {
          const latestBill = billsRaw[0];
          if (!dueDay) dueDay = extractDay(latestBill.dueDate);
          if (!closingDay) closingDay = extractDay(latestBill.billClosingDate);
          if (typeof latestBill.minimumPaymentAmount === 'number' && !minimumPayment) {
            minimumPayment = latestBill.minimumPaymentAmount;
          }
        }
      } catch {
        // Fallback tolerante caso /bills não esteja disponível para este conector
      }
    }

    accounts.push({
      pluggy_account_id: String(a.id),
      institution_name: String(a.marketingName || a.name || itemDetails?.connector?.name || 'Banco'),
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

  const institutionName = accounts[0]?.institution_name || itemDetails?.connector?.name || 'Meu Pluggy';
  if (accounts.length > 0) {
    await api.finance
      .createConnection({
        pluggy_item_id: resolved,
        connector_id: itemDetails?.connector?.id ?? 200,
        institution_name: institutionName,
      })
      .catch(() => {});
  }
  onProgress?.(4);

  // Paginação completa de transações com cursor next (até 10 páginas por conta)
  const transactions: NonNullable<FinanceSyncPayload['transactions']> = [];
  for (const acc of accounts) {
    const pluggyAccountId = String(acc.pluggy_account_id);
    let nextUrl: string | null = `https://api.pluggy.ai/v2/transactions?accountId=${encodeURIComponent(pluggyAccountId)}`;
    let pagesFetched = 0;

    while (nextUrl && pagesFetched < 10) {
      try {
        const pageData = await getJson(nextUrl, apiKey);
        const txs = results(pageData);

        for (const t of txs) {
          const rawAmount = Math.abs(Number(t.amount || 0));
          const isDebit = t.type === 'DEBIT' || Number(t.amount || 0) < 0;
          const amount = isDebit ? -rawAmount : rawAmount;
          const transactionType = isDebit ? ('DEBIT' as const) : ('CREDIT' as const);

          const merchant = t.merchant as { name?: string } | undefined;
          const desc = String(t.description || 'Lançamento');
          const cleanMerchant = merchant?.name || (t.merchantName as string | undefined) || undefined;
          const isRecurring = Boolean(
            t.isRecurring ||
            RECURRING_PATTERNS.some((p) => p.test(desc) || (cleanMerchant && p.test(cleanMerchant)))
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
            occurred_at: String(t.date || new Date().toISOString()),
            installment_number: installmentNumber,
            total_installments: totalInstallments,
            payment_type: paymentType,
            mcc,
            status: txStatus,
          });
        }

        const rawObj = pageData && typeof pageData === 'object' && !Array.isArray(pageData) ? (pageData as RawRecord) : null;
        const nextQuery = typeof rawObj?.next === 'string' ? rawObj.next : null;
        nextUrl = nextQuery
          ? `https://api.pluggy.ai/v2/transactions${nextQuery.startsWith('?') ? nextQuery : `?${nextQuery}`}`
          : null;
        pagesFetched += 1;
      } catch {
        nextUrl = null;
      }
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
