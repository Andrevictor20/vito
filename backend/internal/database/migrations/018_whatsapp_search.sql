-- 018: busca full-text do histórico do WhatsApp
--
-- Objetivo: permitir perguntas como "aquela mensagem da Ana sobre o contrato".
-- A janela de contexto só carrega o mais RECENTE e a ação QUERY_CONVERSATION
-- devolvia as últimas mensagens de um chat — nenhuma das duas responde a uma
-- busca por conteúdo específico.
--
-- O índice cobre o texto da mensagem E a descrição da mídia (media_text), que
-- é o que o Vito "viu" numa foto antiga.
CREATE VIRTUAL TABLE IF NOT EXISTS whatsapp_messages_fts USING fts5(
    text,
    media_text,
    chat_label,
    sender_name,
    content='whatsapp_conversation_messages',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS wa_fts_ai AFTER INSERT ON whatsapp_conversation_messages BEGIN
    INSERT INTO whatsapp_messages_fts(rowid, text, media_text, chat_label, sender_name)
    VALUES (new.rowid, new.text, new.media_text, new.chat_label, new.sender_name);
END;

CREATE TRIGGER IF NOT EXISTS wa_fts_au AFTER UPDATE ON whatsapp_conversation_messages BEGIN
    INSERT INTO whatsapp_messages_fts(whatsapp_messages_fts, rowid, text, media_text, chat_label, sender_name)
    VALUES ('delete', old.rowid, old.text, old.media_text, old.chat_label, old.sender_name);
    INSERT INTO whatsapp_messages_fts(rowid, text, media_text, chat_label, sender_name)
    VALUES (new.rowid, new.text, new.media_text, new.chat_label, new.sender_name);
END;

CREATE TRIGGER IF NOT EXISTS wa_fts_ad AFTER DELETE ON whatsapp_conversation_messages BEGIN
    INSERT INTO whatsapp_messages_fts(whatsapp_messages_fts, rowid, text, media_text, chat_label, sender_name)
    VALUES ('delete', old.rowid, old.text, old.media_text, old.chat_label, old.sender_name);
END;
