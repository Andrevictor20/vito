export interface FinanceConnection {
  id: string;
  user_id?: string;
  pluggy_item_id: string;
  connector_id: number;
  institution_name: string;
  status: 'UPDATED' | 'LOGIN_ERROR' | 'OUTDATED' | 'WAITING_USER_INPUT';
  last_sync_at?: string;
  consent_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceAccount {
  id: string;
  user_id?: string;
  connection_id: string;
  pluggy_account_id: string;
  institution_name: string;
  account_type: 'BANK' | 'CREDIT';
  account_subtype?: 'CHECKING_ACCOUNT' | 'SAVINGS_ACCOUNT' | 'CREDIT_CARD';
  name: string;
  balance: number;
  credit_limit?: number;
  available_credit_limit?: number;
  currency_code: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  user_id?: string;
  account_id: string;
  pluggy_transaction_id: string;
  description: string;
  clean_merchant_name?: string;
  amount: number;
  transaction_type: 'DEBIT' | 'CREDIT';
  payment_method?: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'DEBIT_CARD' | string;
  category: string;
  is_recurring?: boolean | number;
  occurred_at: string;
  created_at?: string;
}

export interface FinanceAlert {
  id: string;
  kind: 'BILL_DUE' | 'BUDGET_CEILING' | 'DUPLICATE_CHARGE' | 'CONSENT_EXPIRING';
  title: string;
  description: string;
  action_label?: string;
  action_payload?: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface CategorySpendItem {
  category: string;
  amount: number;
  percentage: number;
  delta_vs_average_percent?: number;
}

export interface SubscriptionItem {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  has_price_increase?: boolean;
  previous_amount?: number;
}

export interface FinancialSummary {
  total_balance: number;
  open_credit_card_bills: number;
  safe_to_spend_daily: number;
  safe_to_spend_total: number;
  days_remaining_in_month: number;
  monthly_spend_planned: number;
  monthly_spend_actual: number;
  pace_percent: number;
  month_progress_percent: number;
  projected_leftover: number;
  headline_status: string;
  connected_institutions_count: number;
  attention_alerts: FinanceAlert[];
  category_spending: CategorySpendItem[];
  subscriptions: SubscriptionItem[];
}

export interface FinanceSyncPayload {
  connections?: Partial<FinanceConnection>[];
  accounts?: Partial<FinanceAccount>[];
  transactions?: Partial<FinanceTransaction>[];
}

export interface FinanceConnectTokenResponse {
  connect_token: string;
  expires_in_minutes: number;
  client_user_id?: string;
}
