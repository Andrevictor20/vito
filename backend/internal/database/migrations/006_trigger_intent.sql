-- 006: intenção do usuário + keywords de busca do radar (Lote C §9).
ALTER TABLE triggers ADD COLUMN user_intent TEXT DEFAULT '';
ALTER TABLE triggers ADD COLUMN search_keywords TEXT DEFAULT '';
