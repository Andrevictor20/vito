-- 024_finance_cards_installments.sql: faturas de cartão, parcelamentos, comerciantes e regras de categoria.
-- Idempotente: apenas CREATE ... IF NOT EXISTS. As colunas novas de finance_transactions e finance_accounts
-- são adicionadas com guarda individual em migrate_finance_024.go (antes deste script, pois os índices as usam).

CREATE TABLE IF NOT EXISTS finance_merchants (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    logo_key TEXT,
    default_category TEXT,
    mcc INTEGER,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE(user_id, normalized_name),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_credit_bills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    pluggy_bill_id TEXT UNIQUE,
    closing_date TEXT,
    due_date TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0.0,
    minimum_payment REAL,
    finance_charges REAL,
    status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, CLOSED, PAID, OVERDUE
    paid_at DATETIME,
    is_estimated INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES finance_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fin_bill_user_due ON finance_credit_bills(user_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_bill_account ON finance_credit_bills(account_id, due_date DESC);

CREATE TABLE IF NOT EXISTS finance_installment_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    merchant_id TEXT,
    plan_key TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    installment_count INTEGER NOT NULL,
    installment_amount REAL NOT NULL,
    total_amount REAL,
    first_due_date TEXT,
    source TEXT NOT NULL DEFAULT 'PLUGGY', -- PLUGGY, HEURISTIC
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE(user_id, plan_key),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES finance_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(merchant_id) REFERENCES finance_merchants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fin_plan_user ON finance_installment_plans(user_id);

CREATE TABLE IF NOT EXISTS finance_category_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE(user_id, merchant_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(merchant_id) REFERENCES finance_merchants(id) ON DELETE CASCADE
);



