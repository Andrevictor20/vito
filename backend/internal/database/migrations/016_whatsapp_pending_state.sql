-- 016: estado de cobrança das pendências de resposta do WhatsApp
--
-- A LISTA de pendências é derivada do shadow inbox (a última mensagem do chat
-- não é do usuário => está pendente). Aqui só guardamos o controle de cobrança,
-- para o Vito não martelar o mesmo assunto:
--   last_nudged_at  => última vez que o usuário foi cobrado sobre essa conversa
--   snoozed_until   => o usuário adiou ("me lembra amanhã")
--   dismissed_at    => o usuário marcou como resolvido
CREATE TABLE IF NOT EXISTS whatsapp_pending_state (
    user_id       TEXT NOT NULL,
    chat_jid      TEXT NOT NULL,
    last_nudged_at DATETIME,
    snoozed_until  DATETIME,
    dismissed_at   DATETIME,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chat_jid),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_pending_user ON whatsapp_pending_state (user_id);
