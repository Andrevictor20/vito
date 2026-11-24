import { ApiClient } from './client';

export interface DesktopFinanceSummary {
  connected_institutions_count: number;
  consolidated_balance: number;
  open_invoices_total: number;
  month_expenses: number;
  month_income: number;
  safe_to_spend_daily: number;
  days_remaining_in_month: number;
}

export interface DesktopFinanceTransaction {
  id: string;
  description: string;
  clean_merchant_name?: string;
  amount: number;
  transaction_type: 'DEBIT' | 'CREDIT';
  category: string;
  occurred_at: string;
}

export interface DesktopFinanceLimitRule {
  id?: string;
  scope_type: 'CARD' | 'CATEGORY' | 'SUBSCRIPTIONS' | 'MERCHANT' | 'GLOBAL_MONTHLY' | 'SAVINGS_GOAL';
  title: string;
  category_filter?: string;
  account_id?: string;
  merchant_pattern?: string;
  period_type?: string;
  target_amount: number;
  alert_thresholds?: number[];
  pace_alert_enabled?: boolean;
  notify_channels?: string[];
  is_active?: boolean;
}

export interface DesktopFinanceLimitStatus {
  rule: DesktopFinanceLimitRule;
  period_key: string;
  spent_amount: number;
  percent_used: number;
  remaining_amount: number;
  projected_amount: number;
  status_label: string;
}

export class FinanceApi {
  constructor(private client: ApiClient) {}

  async getSummary(): Promise<DesktopFinanceSummary> {
    return this.client.request<DesktopFinanceSummary>('/api/v1/finance/summary');
  }

  async searchTransactions(q = '', limit = 50, offset = 0): Promise<DesktopFinanceTransaction[]> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q.trim()) params.set('q', q.trim());
    const res = await this.client.request<DesktopFinanceTransaction[]>(`/api/v1/finance/transactions?${params.toString()}`);
    return Array.isArray(res) ? res : [];
  }

  async getLimits(): Promise<DesktopFinanceLimitStatus[]> {
    const res = await this.client.request<DesktopFinanceLimitStatus[]>('/api/v1/finance/limits');
    return Array.isArray(res) ? res : [];
  }

  async createLimit(rule: DesktopFinanceLimitRule): Promise<DesktopFinanceLimitStatus> {
    return this.client.request<DesktopFinanceLimitStatus>('/api/v1/finance/limits', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async muteLimit(id: string): Promise<void> {
    await this.client.request<void>(`/api/v1/finance/limits/${id}/mute`, { method: 'POST' });
  }
}
