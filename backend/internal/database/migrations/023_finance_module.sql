-- 023_finance_module.sql: Tabelas do Vito Finance (Padrão SQLite WAL)

-- 1. Conexões de Instituições (Pluggy Items)
CREATE TABLE IF NOT EXISTS finance_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    pluggy_item_id TEXT NOT NULL UNIQUE,
    connector_id INTEGER DEFAULT 200,
    institution_name TEXT DEFAULT 'Meu Pluggy',
    status TEXT DEFAULT 'UPDATED', -- UPDATED, LOGIN_ERROR, OUTDATED, WAITING_USER_INPUT
    last_sync_at DATETIME,
    consent_expires_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fin_conn_user ON finance_connections(user_id);

-- 2. Contas Bancárias e Cartões de Crédito
CREATE TABLE IF NOT EXISTS finance_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    connection_id TEXT,
    pluggy_account_id TEXT NOT NULL UNIQUE,
    institution_name TEXT NOT NULL,
    account_type TEXT NOT NULL,       -- BANK, CREDIT
    account_subtype TEXT,             -- CHECKING_ACCOUNT, SAVINGS_ACCOUNT, CREDIT_CARD
    name TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0.0,
    credit_limit REAL,
    available_credit_limit REAL,
    currency_code TEXT DEFAULT 'BRL',
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(connection_id) REFERENCES finance_connections(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fin_acc_user ON finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_acc_conn ON finance_accounts(connection_id);

-- 3. Transações e Faturas
CREATE TABLE IF NOT EXISTS finance_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    pluggy_transaction_id TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    clean_merchant_name TEXT,
    amount REAL NOT NULL,             -- Negativo para despesas, positivo para receitas
    transaction_type TEXT NOT NULL,   -- DEBIT, CREDIT
    payment_method TEXT,              -- PIX, CREDIT_CARD, BOLETO, DEBIT_CARD
    category TEXT DEFAULT 'Outros',   -- Alimentação, Transporte, Moradia, etc.
    is_recurring INTEGER DEFAULT 0,   -- 0 = False, 1 = True
    occurred_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_user_date ON finance_transactions(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_user_cat ON finance_transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_fin_tx_account ON finance_transactions(account_id);

-- 4. Orçamentos e Metas de Economia
CREATE TABLE IF NOT EXISTS finance_budgets_and_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,               -- CATEGORY_LIMIT (Teto mensal) ou SAVINGS_GOAL (Meta)
    title TEXT NOT NULL,
    category_filter TEXT,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0.0,
    deadline_date TEXT,               -- YYYY-MM-DD
    auto_alert_threshold INTEGER DEFAULT 80, -- Alerta ao atingir 80% do teto
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fin_budgets_user ON finance_budgets_and_goals(user_id);
