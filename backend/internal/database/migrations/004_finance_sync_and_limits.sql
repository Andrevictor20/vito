-- 004_finance_sync_and_limits.sql
-- Plano 05 (Ondas 0-C e 1): Telemetria de SyncEngine v2 em finance_connections,
-- extensão multi-escopo de finance_budgets_and_goals e deduplicação finance_limit_alert_events.

-- 1. Telemetria de SyncEngine v2 em finance_connections
ALTER TABLE finance_connections ADD COLUMN last_attempt_at DATETIME;
ALTER TABLE finance_connections ADD COLUMN last_bank_refresh_at DATETIME;
ALTER TABLE finance_connections ADD COLUMN pluggy_execution_status TEXT DEFAULT '';
ALTER TABLE finance_connections ADD COLUMN last_error_code TEXT DEFAULT '';
ALTER TABLE finance_connections ADD COLUMN last_error_message TEXT DEFAULT '';
ALTER TABLE finance_connections ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;

-- 2. Extensão multi-escopo em finance_budgets_and_goals (preserva CATEGORY_LIMIT e SAVINGS_GOAL)
ALTER TABLE finance_budgets_and_goals ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'CATEGORY';
ALTER TABLE finance_budgets_and_goals ADD COLUMN account_id TEXT;
ALTER TABLE finance_budgets_and_goals ADD COLUMN merchant_id TEXT;
ALTER TABLE finance_budgets_and_goals ADD COLUMN merchant_pattern TEXT;
ALTER TABLE finance_budgets_and_goals ADD COLUMN period_type TEXT NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE finance_budgets_and_goals ADD COLUMN alert_thresholds_json TEXT NOT NULL DEFAULT '[80,100]';
ALTER TABLE finance_budgets_and_goals ADD COLUMN repeat_over_step_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE finance_budgets_and_goals ADD COLUMN pace_alert_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE finance_budgets_and_goals ADD COLUMN notify_channels_json TEXT NOT NULL DEFAULT '["in_app","push"]';
ALTER TABLE finance_budgets_and_goals ADD COLUMN include_pending INTEGER NOT NULL DEFAULT 1;
ALTER TABLE finance_budgets_and_goals ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE finance_budgets_and_goals ADD COLUMN muted_until DATETIME;

-- Backfill explícito para registros SAVINGS_GOAL existentes
UPDATE finance_budgets_and_goals
SET scope_type = 'SAVINGS_GOAL'
WHERE kind = 'SAVINGS_GOAL' AND scope_type = 'CATEGORY';

CREATE INDEX IF NOT EXISTS idx_fin_budgets_scope_active
    ON finance_budgets_and_goals(user_id, scope_type, is_active);

-- 3. Tabela de deduplicação determinística de alertas de limites de gasto
CREATE TABLE IF NOT EXISTS finance_limit_alert_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    limit_id TEXT NOT NULL,
    period_key TEXT NOT NULL,
    trigger_kind TEXT NOT NULL,
    threshold_percent INTEGER NOT NULL,
    spent_amount REAL NOT NULL,
    target_amount REAL NOT NULL,
    notified_channels TEXT NOT NULL DEFAULT '["in_app"]',
    notification_id TEXT,
    created_at DATETIME NOT NULL,
    UNIQUE(limit_id, period_key, trigger_kind, threshold_percent),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(limit_id) REFERENCES finance_budgets_and_goals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fin_limit_events_user_date
    ON finance_limit_alert_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fin_limit_events_limit_period
    ON finance_limit_alert_events(limit_id, period_key);
