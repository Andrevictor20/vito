-- 002_notifications_inbox_and_store_compliance.sql
-- Plano 09 (Ondas V4 & V6): Central de Notificações (#s-notifs), Preferências, Assinaturas e Conformidade LGPD/Store (#s-store).

CREATE TABLE IF NOT EXISTS user_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    group_key TEXT NOT NULL DEFAULT 'Hoje',
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('aprovar','alerta','info')),
    source_domain TEXT NOT NULL DEFAULT '',
    source_id TEXT NOT NULL DEFAULT '',
    bot_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    actions_json TEXT NOT NULL DEFAULT '[]',
    is_unread INTEGER NOT NULL DEFAULT 1,
    is_dismissed INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
    ON user_notifications(user_id, is_dismissed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_source
    ON user_notifications(user_id, source_domain, source_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id TEXT PRIMARY KEY,
    agenda INTEGER NOT NULL DEFAULT 1,
    tarefas INTEGER NOT NULL DEFAULT 1,
    financas INTEGER NOT NULL DEFAULT 1,
    bots INTEGER NOT NULL DEFAULT 1,
    resumo INTEGER NOT NULL DEFAULT 1,
    promo INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','ultra')),
    billing_cycle TEXT NOT NULL DEFAULT 'month' CHECK (billing_cycle IN ('month','year')),
    status TEXT NOT NULL DEFAULT 'inactive',
    trial_ends_at DATETIME,
    renews_at DATETIME,
    store_token_hash TEXT NOT NULL DEFAULT '',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account_compliance_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('export_json','delete_account')),
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_for DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_compliance_requests_user
    ON account_compliance_requests(user_id, kind, requested_at DESC);

CREATE TABLE IF NOT EXISTS ai_content_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    thread_id TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_content_reports_user
    ON ai_content_reports(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_privacy_settings (
    user_id TEXT PRIMARY KEY,
    ai_processing_enabled INTEGER NOT NULL DEFAULT 1,
    analytics_enabled INTEGER NOT NULL DEFAULT 1,
    permissions_json TEXT NOT NULL DEFAULT '{}',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'Suporte Vito',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_requests_user
    ON support_requests(user_id, created_at DESC);
