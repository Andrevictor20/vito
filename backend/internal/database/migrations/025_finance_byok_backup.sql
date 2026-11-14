-- 025_finance_byok_backup.sql: Backup opaco BYOK cifrado no cliente (Plano 26, Onda B3).
CREATE TABLE IF NOT EXISTS finance_byok_backup (
    user_id TEXT PRIMARY KEY,
    ciphertext BLOB NOT NULL,
    nonce BLOB NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
