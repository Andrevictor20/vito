-- 015: WhatsApp contextual assistant (shadow inbox + preferências de escopo)
-- Objetivo: dar contexto de conversa ao Vito no WhatsApp (mensagem citada + janela
-- recente por chat/cross-chat) sem depender de rede no caminho quente.
CREATE TABLE IF NOT EXISTS whatsapp_conversation_messages (
    id                TEXT PRIMARY KEY,          -- key.id da mensagem no WhatsApp
    user_id           TEXT NOT NULL,
    instance_name     TEXT NOT NULL,
    chat_jid          TEXT NOT NULL,             -- remoteJid (@s.whatsapp.net | @g.us | @lid)
    chat_kind         TEXT NOT NULL,             -- self | self_group | group | direct
    chat_label        TEXT NOT NULL DEFAULT '',  -- "Você" | pushName | subject do grupo
    sender_jid        TEXT NOT NULL DEFAULT '',
    sender_name       TEXT NOT NULL DEFAULT '',  -- pushName de quem enviou
    from_me           INTEGER NOT NULL DEFAULT 0,
    kind              TEXT NOT NULL DEFAULT 'text', -- text | audio | image | other
    text              TEXT NOT NULL DEFAULT '',
    quoted_text       TEXT NOT NULL DEFAULT '',  -- texto da mensagem citada (contextInfo)
    message_timestamp DATETIME NOT NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_user_chat_ts
    ON whatsapp_conversation_messages (user_id, chat_jid, message_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_user_ts
    ON whatsapp_conversation_messages (user_id, message_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_instance_ts
    ON whatsapp_conversation_messages (instance_name, message_timestamp DESC);

CREATE TABLE IF NOT EXISTS whatsapp_context_settings (
    user_id     TEXT PRIMARY KEY,
    scope       TEXT    NOT NULL DEFAULT 'all',  -- off | quoted | chat | all
    window_size INTEGER NOT NULL DEFAULT 12,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
