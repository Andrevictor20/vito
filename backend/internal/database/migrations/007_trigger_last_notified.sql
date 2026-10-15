-- 007: cooldown do push de preço-alvo (Fase 1: reaviso em 24h).
ALTER TABLE triggers ADD COLUMN last_notified_at DATETIME;
