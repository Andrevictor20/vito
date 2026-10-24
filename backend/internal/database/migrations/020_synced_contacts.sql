-- 020: tabela de contatos sincronizados (agenda do celular / WhatsApp)
--
-- Garante que contatos salvos pelo usuário persistam no SQLite e sobrevivam
-- a reinicializações de contêiner ou deploys, sem depender apenas de memória RAM
-- ou da existência prévia de mensagens no shadow inbox.
CREATE TABLE IF NOT EXISTS synced_contacts (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    phone        TEXT NOT NULL,         -- formato canônico ou informado (+5598988819646)
    phone_digits TEXT NOT NULL,         -- apenas dígitos (5598988819646)
    jid          TEXT NOT NULL DEFAULT '', -- JID do WhatsApp (@s.whatsapp.net)
    lid          TEXT NOT NULL DEFAULT '', -- identificador opaco (@lid)
    saved_name   TEXT NOT NULL,         -- nome salvo na agenda do celular ("Isa")
    profile_name TEXT NOT NULL DEFAULT '', -- nome público do perfil WhatsApp ("Bella")
    source       TEXT NOT NULL DEFAULT 'phonebook',
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_phone_unique
    ON synced_contacts(user_id, phone_digits);

CREATE INDEX IF NOT EXISTS idx_contacts_user_phone
    ON synced_contacts(user_id, phone_digits);

CREATE INDEX IF NOT EXISTS idx_contacts_user_jid
    ON synced_contacts(user_id, jid);

CREATE INDEX IF NOT EXISTS idx_contacts_user_lid
    ON synced_contacts(user_id, lid);

CREATE INDEX IF NOT EXISTS idx_contacts_user_saved_name
    ON synced_contacts(user_id, saved_name COLLATE NOCASE);
