-- 022_memory_hierarchy.sql
-- Arquitetura Conversacional v2: Conversation Store, Confirmation Gate State Machine,
-- Memória Hierárquica (3 níveis + FTS5) e Telemetria ai_traces.
-- (Colunas em user_ai_settings adicionadas com guarda em migrate.go)

-- 2. Conversation Store: Fios de Conversa Unificados e Resumo Rolante
CREATE TABLE IF NOT EXISTS conversation_threads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL, -- 'app_mobile', 'app_desktop', 'whatsapp', 'voice'
    external_chat_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    rolling_summary TEXT NOT NULL DEFAULT '',
    summary_up_to_turn_id TEXT NOT NULL DEFAULT '',
    sticky_model_name TEXT NOT NULL DEFAULT '',
    sticky_model_until DATETIME,
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_consolidated_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conv_threads_user_channel
    ON conversation_threads(user_id, channel, last_activity_at DESC);

-- 3. Conversation Store: Turnos Reais (user, assistant, tool, proactive_worker)
CREATE TABLE IF NOT EXISTS conversation_turns (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user', 'assistant', 'tool'
    origin TEXT NOT NULL DEFAULT 'direct', -- 'direct', 'proactive_worker', 'voice_live'
    worker_type TEXT NOT NULL DEFAULT '', -- ex: 'morning_briefing', 'trigger_alert', 'pending_nudge'
    content TEXT NOT NULL DEFAULT '',
    reasoning_json TEXT NOT NULL DEFAULT '[]',
    tool_calls_json TEXT NOT NULL DEFAULT '[]',
    tool_call_id TEXT NOT NULL DEFAULT '',
    cards_json TEXT NOT NULL DEFAULT '[]',
    reference_ids_json TEXT NOT NULL DEFAULT '[]',
    model_used TEXT NOT NULL DEFAULT '',
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    tainted_by_external INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES conversation_threads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conv_turns_thread_created
    ON conversation_turns(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_conv_turns_user_created
    ON conversation_turns(user_id, created_at DESC);

-- 4. Máquina de Estados Determinística do Confirmation Gate (SUSPENDED -> RESUMED)
CREATE TABLE IF NOT EXISTS pending_confirmations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    toolset_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    arguments_json TEXT NOT NULL,
    preview_json TEXT NOT NULL DEFAULT '{}',
    idempotency_key TEXT NOT NULL,
    tainted_context INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SUSPENDED', -- 'SUSPENDED', 'RESUMED', 'CANCELLED', 'SUPERSEDED', 'EXPIRED'
    expires_at DATETIME NOT NULL,
    resolved_at DATETIME,
    execution_result_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (thread_id) REFERENCES conversation_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_conf_user_status
    ON pending_confirmations(user_id, status, expires_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_conf_idempotency
    ON pending_confirmations(user_id, idempotency_key) WHERE status = 'SUSPENDED';

-- 5. Memória Hierárquica v2 — Nível 1: Fatos Atômicos
CREATE TABLE IF NOT EXISTS user_memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'chat',
    confidence REAL NOT NULL DEFAULT 0.5,
    importance INTEGER NOT NULL DEFAULT 3,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_active
    ON user_memories(user_id, is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_category
    ON user_memories(user_id, category, is_active);

-- Índice FTS5 para fatos atômicos (se ainda não existir)
CREATE VIRTUAL TABLE IF NOT EXISTS user_memories_fts USING fts5(
    record_id UNINDEXED,
    user_id UNINDEXED,
    content,
    category,
    tokenize='unicode61 remove_diacritics 2'
);

-- 6. Memória Hierárquica v2 — Nível 2: Episódios
CREATE TABLE IF NOT EXISTS memory_episodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    thread_id TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'app_mobile',
    title TEXT NOT NULL,
    narrative_summary TEXT NOT NULL,
    participants_json TEXT NOT NULL DEFAULT '[]',
    emotional_tone TEXT NOT NULL DEFAULT 'neutral',
    importance INTEGER NOT NULL DEFAULT 3, -- 1 a 5
    happened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    followup_date DATETIME,
    followup_done INTEGER NOT NULL DEFAULT 0,
    embedding_blob BLOB,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_episodes_user_date
    ON memory_episodes(user_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_episodes_followup
    ON memory_episodes(user_id, followup_done, followup_date) WHERE followup_date IS NOT NULL;

-- 7. Memória Hierárquica v2 — Nível 3: Resumos Temáticos Consolidados
CREATE TABLE IF NOT EXISTS memory_thematic_summaries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    theme_slug TEXT NOT NULL,
    theme_title TEXT NOT NULL,
    consolidated_summary TEXT NOT NULL,
    fact_count INTEGER NOT NULL DEFAULT 0,
    episode_count INTEGER NOT NULL DEFAULT 0,
    embedding_blob BLOB,
    last_consolidated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, theme_slug),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_themes_user
    ON memory_thematic_summaries(user_id, updated_at DESC);

-- Vínculo N:N entre Episódios (Nível 2) e Fatos Atômicos em user_memories (Nível 1)
CREATE TABLE IF NOT EXISTS memory_episode_facts (
    episode_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'extracted_from',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (episode_id, memory_id),
    FOREIGN KEY (episode_id) REFERENCES memory_episodes(id) ON DELETE CASCADE,
    FOREIGN KEY (memory_id) REFERENCES user_memories(id) ON DELETE CASCADE
);

-- 8. Índice Full-Text Search (FTS5) Unificado para Episódios e Resumos Temáticos
CREATE VIRTUAL TABLE IF NOT EXISTS memory_hierarchy_fts USING fts5(
    record_id UNINDEXED,
    user_id UNINDEXED,
    hierarchy_level UNINDEXED,
    title,
    body,
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS trg_memory_episodes_ai AFTER INSERT ON memory_episodes BEGIN
    INSERT INTO memory_hierarchy_fts(record_id, user_id, hierarchy_level, title, body)
    VALUES (new.id, new.user_id, 'episode', new.title, new.narrative_summary);
END;

CREATE TRIGGER IF NOT EXISTS trg_memory_episodes_au AFTER UPDATE ON memory_episodes BEGIN
    DELETE FROM memory_hierarchy_fts WHERE record_id = old.id AND hierarchy_level = 'episode';
    INSERT INTO memory_hierarchy_fts(record_id, user_id, hierarchy_level, title, body)
    VALUES (new.id, new.user_id, 'episode', new.title, new.narrative_summary);
END;

CREATE TRIGGER IF NOT EXISTS trg_memory_episodes_ad AFTER DELETE ON memory_episodes BEGIN
    DELETE FROM memory_hierarchy_fts WHERE record_id = old.id AND hierarchy_level = 'episode';
END;

CREATE TRIGGER IF NOT EXISTS trg_memory_themes_ai AFTER INSERT ON memory_thematic_summaries BEGIN
    INSERT INTO memory_hierarchy_fts(record_id, user_id, hierarchy_level, title, body)
    VALUES (new.id, new.user_id, 'theme', new.theme_title, new.consolidated_summary);
END;

CREATE TRIGGER IF NOT EXISTS trg_memory_themes_au AFTER UPDATE ON memory_thematic_summaries BEGIN
    DELETE FROM memory_hierarchy_fts WHERE record_id = old.id AND hierarchy_level = 'theme';
    INSERT INTO memory_hierarchy_fts(record_id, user_id, hierarchy_level, title, body)
    VALUES (new.id, new.user_id, 'theme', new.theme_title, new.consolidated_summary);
END;

CREATE TRIGGER IF NOT EXISTS trg_memory_themes_ad AFTER DELETE ON memory_thematic_summaries BEGIN
    DELETE FROM memory_hierarchy_fts WHERE record_id = old.id AND hierarchy_level = 'theme';
END;

-- 9. Telemetria Leve e Auditoria de Agente (Gravada em Lote via Ring Buffer)
CREATE TABLE IF NOT EXISTS ai_traces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    thread_id TEXT NOT NULL DEFAULT '',
    turn_id TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT '',
    task_type TEXT NOT NULL DEFAULT 'chat',
    provider_name TEXT NOT NULL,
    model_name TEXT NOT NULL,
    step_index INTEGER NOT NULL DEFAULT 0,
    toolset_called TEXT NOT NULL DEFAULT '',
    operation_called TEXT NOT NULL DEFAULT '',
    fallback_triggered INTEGER NOT NULL DEFAULT 0,
    fallback_reason TEXT NOT NULL DEFAULT '',
    tainted_turn INTEGER NOT NULL DEFAULT 0,
    confirmation_gate_status TEXT NOT NULL DEFAULT '',
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    status_code INTEGER NOT NULL DEFAULT 200,
    error_code TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_traces_created
    ON ai_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_traces_provider_task
    ON ai_traces(provider_name, task_type, created_at DESC);
