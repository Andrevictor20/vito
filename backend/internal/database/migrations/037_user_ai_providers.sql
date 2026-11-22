-- 037_user_ai_providers.sql
-- Provedores de IA próprios (BYOK) e seleção de modelo padrão/conversa/bot.

CREATE TABLE IF NOT EXISTS user_ai_providers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_key TEXT NOT NULL CHECK (provider_key IN ('anthropic','google','openai','groq','openrouter','custom')),
    base_url TEXT NOT NULL DEFAULT '',
    key_ciphertext TEXT NOT NULL,
    key_last4 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','invalid')),
    verified_at DATETIME,
    models_json TEXT NOT NULL DEFAULT '[]',
    models_fetched_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE(user_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_providers_user
    ON user_ai_providers(user_id, provider_key);
