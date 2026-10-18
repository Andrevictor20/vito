-- 012: WhatsApp integration schema (Evolution API v2, Pairing Code & Webhook)
CREATE TABLE IF NOT EXISTS whatsapp_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    instance_name TEXT NOT NULL UNIQUE,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected', -- 'disconnected', 'connecting', 'connected'
    pairing_code TEXT,
    last_connected_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_user_id ON whatsapp_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instance ON whatsapp_integrations(instance_name);
