-- 019: apelidos aprendidos dos contatos do WhatsApp
--
-- O nome SALVO pelo dono vive na agenda do celular e nem sempre chega ao
-- servidor (a Evolution não expõe a agenda; o app envia o que consegue). Para
-- os chats @lid — cujo identificador é opaco e não casa com telefone — a única
-- via é o próprio usuário dizer uma vez a quem o Vito está se referindo.
--
-- O Vito guarda o apelido e passa a reconhecer o contato por ele.
CREATE TABLE IF NOT EXISTS whatsapp_contact_aliases (
    user_id    TEXT NOT NULL,
    chat_jid   TEXT NOT NULL,
    alias      TEXT NOT NULL,          -- o nome que o dono usa ("isa")
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chat_jid, alias),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_alias_user_alias
    ON whatsapp_contact_aliases (user_id, alias);
