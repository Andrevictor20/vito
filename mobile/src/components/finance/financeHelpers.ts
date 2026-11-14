import type {
  CategorySpendItem,
  ExtractFilterKey,
  FinanceAccount,
  FinanceAlert,
  FinanceTransaction,
  FinancialSummary,
  SubscriptionItem,
} from '../../types/finance';
import { BankBrand, getBankBrand } from '../../utils/bankBrands';

export const EMPTY_FINANCIAL_SUMMARY: FinancialSummary = {
  total_balance: 0,
  open_credit_card_bills: 0,
  safe_to_spend_daily: 0,
  safe_to_spend_total: 0,
  days_remaining_in_month: 1,
  monthly_spend_planned: 0,
  monthly_spend_actual: 0,
  month_expenses: 0,
  month_income: 0,
  pace_percent: 0,
  month_progress_percent: 0,
  projected_leftover: 0,
  headline_status: 'Conecte seus bancos via Open Finance',
  connected_institutions_count: 0,
  attention_alerts: [],
  category_spending: [],
  subscriptions: [],
  budgets: [],
  goals: [],
};

export function normalizeSummary(raw: Partial<FinancialSummary> | null | undefined): FinancialSummary {
  if (!raw) return { ...EMPTY_FINANCIAL_SUMMARY };

  const totalBalance = raw.total_balance ?? raw.consolidated_balance ?? 0;
  const openBills = raw.open_credit_card_bills ?? raw.open_invoices_total ?? 0;
  const daysRemaining = raw.days_remaining_in_month ?? raw.safe_to_spend_days_remaining ?? 1;
  const safeDaily = raw.safe_to_spend_daily ?? 0;
  const monthExpenses = raw.month_expenses ?? raw.monthly_spend_actual ?? 0;
  const monthIncome = raw.month_income ?? 0;
  const alerts = Array.isArray(raw.attention_alerts) && raw.attention_alerts.length > 0
    ? raw.attention_alerts
    : Array.isArray(raw.alerts)
      ? raw.alerts
      : [];

  return {
    total_balance: totalBalance,
    consolidated_balance: raw.consolidated_balance ?? totalBalance,
    open_credit_card_bills: openBills,
    open_invoices_total: raw.open_invoices_total ?? openBills,
    safe_to_spend_daily: safeDaily,
    safe_to_spend_total: raw.safe_to_spend_total ?? Math.max(0, safeDaily * Math.max(1, daysRemaining)),
    days_remaining_in_month: Math.max(1, daysRemaining),
    monthly_spend_planned: raw.monthly_spend_planned ?? 0,
    monthly_spend_actual: raw.monthly_spend_actual ?? monthExpenses,
    month_expenses: monthExpenses,
    month_income: monthIncome,
    pace_percent: raw.pace_percent ?? 0,
    month_progress_percent: raw.month_progress_percent ?? raw.safe_to_spend_month_percent ?? 0,
    projected_leftover: raw.projected_leftover ?? totalBalance - openBills,
    headline_status: raw.headline_status || 'Conecte seus bancos via Open Finance',
    connected_institutions_count: raw.connected_institutions_count ?? 0,
    attention_alerts: alerts,
    alerts,
    category_spending: Array.isArray(raw.category_spending) ? raw.category_spending : [],
    subscriptions: Array.isArray(raw.subscriptions) ? raw.subscriptions : [],
    budgets: Array.isArray(raw.budgets) ? raw.budgets : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
  };
}

export function formatBRL(val: number, decimals = 2): string {
  const safe = Number.isFinite(val) ? Math.abs(val) : 0;
  return `R$ ${safe.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function maskBRL(hidden: boolean, formatted: string): string {
  return hidden ? 'R$ ••••' : formatted;
}

export function withHexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildFinScale(finHex: string): string[] {
  return [
    finHex,
    withHexAlpha(finHex, 0.72),
    withHexAlpha(finHex, 0.52),
    withHexAlpha(finHex, 0.38),
    withHexAlpha(finHex, 0.26),
  ];
}

export function getCategoryAmount(c: CategorySpendItem): number {
  return c.total_amount ?? c.amount ?? 0;
}

export function getCategoryDelta(c: CategorySpendItem): number | undefined {
  return c.delta_percent ?? c.delta_vs_average_percent;
}

export function getSubscriptionName(s: SubscriptionItem): string {
  return s.merchant_name || s.name || 'Assinatura';
}

export function hasSubscriptionIncrease(s: SubscriptionItem): boolean {
  return Boolean(s.is_price_increased || s.has_price_increase);
}

export function getAlertMessage(a: FinanceAlert): string {
  return a.message || a.description || '';
}

export function getAlertPrompt(a: FinanceAlert): string {
  return a.action_prompt || a.action_payload || a.title;
}

export interface CreditCardStats {
  creditAccounts: FinanceAccount[];
  totalBill: number;
  totalLimit: number;
  totalAvailable: number;
  usedPercent: number;
  primaryBrand: BankBrand | null;
  dueLabel: string;
  hasBillAlert: boolean;
}

export function computeCreditCardStats(
  accounts: FinanceAccount[],
  summary: FinancialSummary
): CreditCardStats {
  const creditAccounts = accounts.filter((a) => a.account_type === 'CREDIT');
  const summedBills = creditAccounts.reduce((acc, c) => acc + Math.abs(c.balance || 0), 0);
  const totalBill = summary.open_credit_card_bills > 0 ? summary.open_credit_card_bills : summedBills;
  const totalLimit = creditAccounts.reduce((acc, c) => acc + (c.credit_limit || 0), 0);
  const hasExplicitAvailable = creditAccounts.some((c) => typeof c.available_credit_limit === 'number');
  const explicitAvailable = creditAccounts.reduce(
    (acc, c) => acc + Math.max(0, c.available_credit_limit ?? 0),
    0
  );
  const totalAvailable = hasExplicitAvailable
    ? explicitAvailable
    : Math.max(0, totalLimit - totalBill);
  const usedPercent = totalLimit > 0 ? Math.min(100, Math.round((totalBill / totalLimit) * 100)) : 0;
  const primary = creditAccounts[0];
  const primaryBrand = primary ? getBankBrand(primary.institution_name) : null;

  let dueLabel = 'Sem faturas abertas';
  let hasBillAlert = false;
  if (primary?.due_day) {
    dueLabel = `Vence dia ${primary.due_day}`;
    hasBillAlert = true;
  } else if (totalBill > 0) {
    dueLabel = 'Fatura em aberto';
    hasBillAlert = true;
  }

  return {
    creditAccounts,
    totalBill,
    totalLimit,
    totalAvailable,
    usedPercent,
    primaryBrand,
    dueLabel,
    hasBillAlert,
  };
}

export function isCreditTransaction(tx: FinanceTransaction): boolean {
  return tx.amount > 0 || (tx.amount === 0 && tx.transaction_type === 'CREDIT');
}

export function getPaymentMethodKind(tx: FinanceTransaction): 'pix' | 'card' {
  const pm = (tx.payment_method || '').toUpperCase();
  const desc = (tx.description || '').toUpperCase();
  if (pm.includes('PIX') || desc.includes('PIX')) return 'pix';
  return 'card';
}

export function formatShortTxDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Recente';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function filterExtractTransactions(
  txs: FinanceTransaction[],
  filter: ExtractFilterKey
): FinanceTransaction[] {
  return txs.filter((tx) => {
    const isIn = isCreditTransaction(tx);
    const kind = getPaymentMethodKind(tx);
    if (filter === 'all') return true;
    if (filter === 'in') return isIn;
    if (filter === 'out') return !isIn;
    if (filter === 'pix') return kind === 'pix';
    if (filter === 'card') {
      const pm = (tx.payment_method || '').toUpperCase();
      return kind === 'card' || pm.includes('CARD') || pm.includes('CREDIT') || pm.includes('DEBIT');
    }
    return true;
  });
}

export function groupTransactionsByDay(
  txs: FinanceTransaction[]
): Array<{ dayLabel: string; items: FinanceTransaction[] }> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const map = new Map<string, FinanceTransaction[]>();
  for (const tx of txs) {
    const d = new Date(tx.occurred_at);
    let label = 'Recente';
    if (!Number.isNaN(d.getTime())) {
      if (sameDay(d, today)) label = 'Hoje';
      else if (sameDay(d, yesterday)) label = 'Ontem';
      else {
        label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
      }
    }
    const list = map.get(label) || [];
    list.push(tx);
    map.set(label, list);
  }

  return Array.from(map.entries()).map(([dayLabel, items]) => ({ dayLabel, items }));
}

export function buildDailySpendingSeries(txs: FinanceTransaction[]): {
  values: number[];
  labels: Array<{ index: number; label: string }>;
  peakIndex: number;
  peakAmount: number;
  peakDay: number;
  avg: number;
} {
  const debits = txs.filter((t) => !isCreditTransaction(t));
  if (debits.length === 0) {
    return { values: [], labels: [], peakIndex: -1, peakAmount: 0, peakDay: 1, avg: 0 };
  }

  const now = new Date();
  const targetYear = now.getFullYear();
  const targetMonth = now.getMonth();
  const currentMonthDebits = debits.filter((t) => {
    const d = new Date(t.occurred_at);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonth;
  });
  const source = currentMonthDebits.length > 0 ? currentMonthDebits : debits;

  const byDay = new Map<number, number>();
  let maxDay = 1;
  for (const t of source) {
    const d = new Date(t.occurred_at);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.getDate();
    if (day > maxDay) maxDay = day;
    byDay.set(day, (byDay.get(day) || 0) + Math.abs(t.amount));
  }

  const values: number[] = [];
  let peakIndex = 0;
  let peakAmount = 0;
  let peakDay = 1;
  let sum = 0;
  for (let day = 1; day <= maxDay; day += 1) {
    const v = byDay.get(day) || 0;
    values.push(v);
    sum += v;
    if (v >= peakAmount) {
      peakAmount = v;
      peakIndex = day - 1;
      peakDay = day;
    }
  }

  const labels: Array<{ index: number; label: string }> = [{ index: 0, label: '1' }];
  if (maxDay >= 10) labels.push({ index: Math.floor(maxDay / 2) - 1, label: String(Math.floor(maxDay / 2)) });
  if (maxDay > 1) labels.push({ index: maxDay - 1, label: String(maxDay) });

  return {
    values,
    labels,
    peakIndex,
    peakAmount,
    peakDay,
    avg: values.length > 0 ? Math.round(sum / values.length) : 0,
  };
}

export function buildMonthlyFlowSeries(
  txs: FinanceTransaction[],
  fallbackIncome: number,
  fallbackExpenses: number
): {
  labels: string[];
  income: number[];
  expenses: number[];
} {
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const buckets = new Map<string, { label: string; sortKey: number; income: number; expenses: number }>();

  for (const tx of txs) {
    const d = new Date(tx.occurred_at);
    if (Number.isNaN(d.getTime())) continue;
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${m}`;
    const entry = buckets.get(key) || {
      label: monthNames[m],
      sortKey: y * 12 + m,
      income: 0,
      expenses: 0,
    };
    if (isCreditTransaction(tx)) entry.income += Math.abs(tx.amount);
    else entry.expenses += Math.abs(tx.amount);
    buckets.set(key, entry);
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => a.sortKey - b.sortKey).slice(-6);
  if (sorted.length === 0) {
    const now = new Date();
    return {
      labels: [monthNames[now.getMonth()]],
      income: [fallbackIncome],
      expenses: [fallbackExpenses],
    };
  }
  return {
    labels: sorted.map((s) => s.label),
    income: sorted.map((s) => s.income),
    expenses: sorted.map((s) => s.expenses),
  };
}

export function formatRelativeSync(iso?: string): string {
  if (!iso) return 'Sincronizado';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sincronizado';
  const diffMin = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD} ${diffD === 1 ? 'dia' : 'dias'}`;
}
