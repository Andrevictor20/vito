-- 021: Configuração estruturada de busca, rastreamento de fingerprints e métricas de radar
ALTER TABLE triggers ADD COLUMN search_config_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE triggers ADD COLUMN seen_fingerprints_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE triggers ADD COLUMN last_metric_value REAL;
