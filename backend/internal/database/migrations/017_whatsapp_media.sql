-- 017: mídia do WhatsApp rastreável + identidade da mensagem citada
--
-- Objetivo: permitir que o Vito leia áudio e imagem de mensagens que JÁ PASSARAM
-- e entenda a mensagem marcada ("responder") mesmo quando ela aponta para mídia.
--
-- Sem estas colunas o shadow inbox guardava apenas o TEXTO: uma foto antiga era
-- impossível de ler depois (o backfill também descartava o payload cru da mídia,
-- que é o que a Evolution API usa para baixar o arquivo).
ALTER TABLE whatsapp_conversation_messages ADD COLUMN media_kind TEXT NOT NULL DEFAULT '';    -- image | audio | video | document
ALTER TABLE whatsapp_conversation_messages ADD COLUMN media_mime TEXT NOT NULL DEFAULT '';
ALTER TABLE whatsapp_conversation_messages ADD COLUMN media_status TEXT NOT NULL DEFAULT '';  -- none | pending | done | failed
ALTER TABLE whatsapp_conversation_messages ADD COLUMN media_text TEXT NOT NULL DEFAULT '';    -- transcrição (áudio) ou descrição (imagem)
ALTER TABLE whatsapp_conversation_messages ADD COLUMN media_payload TEXT NOT NULL DEFAULT ''; -- envelope {key,message} p/ download na Evolution
ALTER TABLE whatsapp_conversation_messages ADD COLUMN quoted_id TEXT NOT NULL DEFAULT '';     -- contextInfo.stanzaId da mensagem citada

CREATE INDEX IF NOT EXISTS idx_wa_conv_media_pending
    ON whatsapp_conversation_messages (user_id, media_status, message_timestamp ASC);

CREATE INDEX IF NOT EXISTS idx_wa_conv_quoted
    ON whatsapp_conversation_messages (user_id, quoted_id);
