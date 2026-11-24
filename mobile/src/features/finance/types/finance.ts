export type FinanceSubScreenKey = 'ext' | 'spend' | 'flow' | 'card' | 'sub' | 'goal' | 'conn';

export type ExtractFilterKey = 'all' | 'in' | 'out' | 'card' | 'pix';

export interface FinanceConnection {
  id: string;
  user_id?: string;
  pluggy_item_id: string;
  connector_id: number;
  institution_name: string;
  status: 'UPDATED' | 'UPDATING' | 'LOGIN_ERROR' | 'OUTDATED' | 'WAITING_USER_INPUT';
  last_sync_at?: string;
  last_attempt_at?: string;
  last_bank_refresh_at?: string;
  pluggy_execution_status?: string;
  last_error_code?: string;
  last_error_message?: string;
  consecutive_failures?: number;
  consent_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceConnectionStatusUpdate {
  status: 'UPDATED' | 'UPDATING' | 'LOGIN_ERROR' | 'OUTDATED' | 'WAITING_USER_INPUT';
  pluggy_execution_status?: string;
  last_error_code?: string;
  last_error_message?: string;
  last_attempt_at?: string;
  last_bank_refresh_at?: string;
  consent_expires_at?: string;
  reset_failures?: boolean;
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
  closing_day?: number;
  due_day?: number;
  minimum_payment?: number;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  user_id?: string;
  account_id: string;
  pluggy_account_id?: string;
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
  installment_number?: number;
  total_installments?: number;
  payment_type?: string;
  mcc?: number;
  status?: string;
}

export interface FinanceAlert {
  id: string;
  kind:
    | 'BILL_DUE'
    | 'BUDGET_CEILING'
    | 'DUPLICATE_CHARGE'
    | 'CONSENT_EXPIRING'
    | 'INVOICE_EXCEEDS_BALANCE'
    | 'SAFE_TO_SPEND_LOW'
    | string;
  title: string;
  message?: string;
  description?: string;
  severity?: 'info' | 'warning' | 'critical' | string;
  urgency?: 'low' | 'medium' | 'high';
  action_label?: string;
  action_prompt?: string;
  action_payload?: string;
}

export interface CategorySpendItem {
  category: string;
  amount?: number;
  total_amount?: number;
  percentage: number;
  previous_month_amount?: number;
  delta_percent?: number;
  delta_vs_average_percent?: number;
}

export interface SubscriptionItem {
  id?: string;
  name?: string;
  merchant_name?: string;
  category?: string;
  amount: number;
  frequency: 'monthly' | 'yearly' | string;
  last_charged_at?: string;
  has_price_increase?: boolean;
  is_price_increased?: boolean;
  previous_amount?: number;
}

export interface FinanceBudgetItem {
  id?: string;
  title: string;
  category_filter?: string;
  used_amount: number;
  target_amount: number;
  auto_alert_threshold?: number;
}

export interface FinanceGoalItem {
  id?: string;
  title: string;
  current_amount: number;
  target_amount: number;
  deadline_date?: string;
}

export interface FinancialSummary {
  total_balance: number;
  consolidated_balance?: number;
  open_credit_card_bills: number;
  open_invoices_total?: number;
  safe_to_spend_daily: number;
  safe_to_spend_total: number;
  days_remaining_in_month: number;
  safe_to_spend_days_remaining?: number;
  safe_to_spend_month_percent?: number;
  safe_to_spend_budget_percent?: number;
  monthly_spend_planned: number;
  monthly_spend_actual: number;
  month_expenses?: number;
  month_income?: number;
  pace_percent: number;
  month_progress_percent: number;
  projected_leftover: number;
  headline_status: string;
  connected_institutions_count: number;
  alerts?: FinanceAlert[];
  attention_alerts: FinanceAlert[];
  category_spending: CategorySpendItem[];
  subscriptions: SubscriptionItem[];
  budgets?: FinanceBudgetItem[];
  goals?: FinanceGoalItem[];
}

export interface FinanceSyncPayload {
  connection_id?: string;
  pluggy_item_id?: string;
  connector_id?: number;
  institution_name?: string;
  status?: 'UPDATED' | 'UPDATING' | 'LOGIN_ERROR' | 'OUTDATED' | 'WAITING_USER_INPUT';
  pluggy_execution_status?: string;
  last_bank_refresh_at?: string;
  consent_expires_at?: string;
  last_error_code?: string;
  last_error_message?: string;
  connections?: Partial<FinanceConnection>[];
  accounts?: Partial<FinanceAccount>[];
  transactions?: Partial<FinanceTransaction>[];
}

export interface FinanceConnectTokenResponse {
  connect_token: string;
  expires_in_minutes: number;
  client_user_id?: string;
}

export type SpendingLimitScope =
  | 'CARD'
  | 'CATEGORY'
  | 'SUBSCRIPTIONS'
  | 'MERCHANT'
  | 'GLOBAL_MONTHLY'
  | 'SAVINGS_GOAL';

export type LimitPeriodType = 'MONTHLY' | 'BILLING_CYCLE' | 'WEEKLY' | 'DAILY';

export interface FinanceLimitRule {
  id?: string;
  user_id?: string;
  kind?: 'CATEGORY_LIMIT' | 'SAVINGS_GOAL';
  scope_type: SpendingLimitScope;
  title: string;
  category_filter?: string;
  account_id?: string;
  merchant_id?: string;
  merchant_pattern?: string;
  period_type?: LimitPeriodType;
  target_amount: number;
  current_amount?: number;
  deadline_date?: string;
  auto_alert_threshold?: number;
  alert_thresholds?: number[];
  repeat_over_step_percent?: number;
  pace_alert_enabled?: boolean;
  notify_channels?: string[];
  include_pending?: boolean;
  is_active?: boolean;
  muted_until?: string;
}

export interface FinanceLimitStatus {
  rule: FinanceLimitRule;
  period_key: string;
  cycle_start: string;
  cycle_end: string;
  spent_amount: number;
  percent_used: number;
  remaining_amount: number;
  projected_amount: number;
  status_label: 'OK' | 'WARNING' | 'PACE_RISK' | 'EXCEEDED' | string;
  top_contributors?: FinanceTransaction[];
}

export interface FinanceLimitSuggestion {
  scope_type: SpendingLimitScope;
  title: string;
  category_filter?: string;
  account_id?: string;
  suggested_amount: number;
  baseline_spend: number;
  reason: string;
}

export interface FinanceTransactionFilter {
  q?: string;
  account_id?: string;
  category?: string;
  type?: 'DEBIT' | 'CREDIT' | '';
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
