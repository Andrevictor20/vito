-- 013: Gmail integration schema (OAuth2 tokens, scanning & triagem)
CREATE TABLE IF NOT EXISTS gmail_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    account_email TEXT NOT NULL,
    encrypted_credentials TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'reauth_required', 'error', 'disconnected'
    history_id TEXT,
    last_scanned_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gmail_user_id ON gmail_integrations(user_id);
