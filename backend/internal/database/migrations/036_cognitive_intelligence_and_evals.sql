-- 036_cognitive_intelligence_and_evals.sql
-- Plano 01 (Ondas 2, 3 e 4):
-- 1. memory_embeddings: vetores float32 compactos para busca híbrida FTS5 + semântica no SQLiteMemoryService
-- 2. entity_links: resolução unificada de entidades (pessoas, projetos, organizações) entre WhatsApp, Gmail, Agenda e Apps
-- 3. attention_budget_logs: governança anti-fadiga, deduplicação semântica e silêncio contextual por agenda
-- 4. ai_eval_runs: histórico de execuções da suíte ADK Golden Evals (trajetórias de agentes e tools)

CREATE TABLE IF NOT EXISTS memory_embeddings (
    memory_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'gemini-embedding-001',
    dimensions INTEGER NOT NULL DEFAULT 0,
    embedding_blob BLOB NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_user
    ON memory_embeddings(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS entity_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person', -- 'person', 'project', 'organization'
    whatsapp_jid TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    aliases_json TEXT NOT NULL DEFAULT '[]',
    external_ids_json TEXT NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 1.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entity_links_user_name
    ON entity_links(user_id, canonical_name);
CREATE INDEX IF NOT EXISTS idx_entity_links_user_wa
    ON entity_links(user_id, whatsapp_jid) WHERE whatsapp_jid != '';
CREATE INDEX IF NOT EXISTS idx_entity_links_user_email
    ON entity_links(user_id, email) WHERE email != '';

CREATE TABLE IF NOT EXISTS attention_budget_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_worker TEXT NOT NULL, -- 'bot_runner', 'finance_trigger', 'reminder_worker', 'behavioral_worker'
    category TEXT NOT NULL DEFAULT 'geral', -- 'agenda', 'tarefas', 'financas', 'bots', 'resumo', 'promo', 'critical_alarm'
    urgency TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
    dedup_key TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'DELIVERED', -- 'DELIVERED', 'DEFERRED', 'DEDUPLICATED', 'SUPPRESSED'
    defer_reason TEXT NOT NULL DEFAULT '',
    scheduled_for DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attention_budget_user_created
    ON attention_budget_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attention_budget_dedup
    ON attention_budget_logs(user_id, dedup_key, created_at DESC) WHERE dedup_key != '';

CREATE TABLE IF NOT EXISTS ai_eval_runs (
    id TEXT PRIMARY KEY,
    suite_name TEXT NOT NULL DEFAULT 'adk_golden_evals',
    scenario_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    passed INTEGER NOT NULL DEFAULT 0,
    expected_tools_json TEXT NOT NULL DEFAULT '[]',
    actual_tools_json TEXT NOT NULL DEFAULT '[]',
    expected_subagents_json TEXT NOT NULL DEFAULT '[]',
    actual_subagents_json TEXT NOT NULL DEFAULT '[]',
    latency_ms INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_suite_created
    ON ai_eval_runs(suite_name, created_at DESC);
