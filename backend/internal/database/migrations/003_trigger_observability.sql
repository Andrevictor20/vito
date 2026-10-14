-- 003: observabilidade da coleta + base do delta gate (§8.7/11, §9.3).
ALTER TABLE triggers ADD COLUMN last_error TEXT DEFAULT '';
ALTER TABLE triggers ADD COLUMN last_seen_hashes TEXT DEFAULT '[]';
