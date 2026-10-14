-- 002: rede de seguranca para bases criadas antes da coluna category existir.
-- O runner verifica PRAGMA table_info antes de aplicar (idempotente).
ALTER TABLE todos ADD COLUMN category TEXT DEFAULT 'geral';
