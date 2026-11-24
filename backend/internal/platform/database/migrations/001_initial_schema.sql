-- 001_initial_schema.sql
-- Consolidated baseline schema for Vito (SQLite WAL + FTS5).

-- ============================================================================
-- 1. Users & Auth
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT,
    token_version INTEGER DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    device_name TEXT NOT NULL DEFAULT 'Dispositivo Vito',
    ip_address TEXT NOT NULL DEFAULT '',
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(user_id, revoked_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

CREATE TABLE IF NOT EXISTS device_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'expo',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_user_token ON device_tokens(user_id, token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

CREATE TABLE IF NOT EXISTS whatsapp_auth_otps (
    phone TEXT PRIMARY KEY,
    otp_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_expires ON whatsapp_auth_otps(expires_at);

-- ============================================================================
-- 2. Calendar, Events, Booking & Meetings
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    source TEXT DEFAULT 'vito',
    category TEXT DEFAULT 'general',
    color TEXT,
    recurrence TEXT,
    reminder_sent_at DATETIME,
    start_reminder_sent_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_user_start ON events(user_id, start_at);

CREATE TABLE IF NOT EXISTS calendar_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    account_email TEXT NOT NULL,
    encrypted_credentials TEXT NOT NULL,
    calendar_id TEXT NOT NULL DEFAULT 'primary',
    calendar_name TEXT,
    sync_token TEXT,
    channel_id TEXT,
    channel_expiration DATETIME,
    status TEXT NOT NULL DEFAULT 'active',
    last_synced_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_integrations_user_prov ON calendar_integrations(user_id, provider, account_email);
CREATE INDEX IF NOT EXISTS idx_cal_integrations_user ON calendar_integrations(user_id);

CREATE TABLE IF NOT EXISTS external_event_mappings (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    external_etag TEXT,
    content_hash TEXT NOT NULL,
    last_synced_at DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'synced',
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_map_user_prov_ext ON external_event_mappings(user_id, provider, external_event_id);
CREATE INDEX IF NOT EXISTS idx_ext_map_event_id ON external_event_mappings(event_id);

CREATE TABLE IF NOT EXISTS calendar_tombstones (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    deleted_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tombstones_user_prov ON calendar_tombstones(user_id, provider);

CREATE TABLE IF NOT EXISTS booking_types (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    buffer_minutes INTEGER NOT NULL DEFAULT 10,
    days_of_week TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    start_hour TEXT NOT NULL DEFAULT '09:00',
    end_hour TEXT NOT NULL DEFAULT '18:00',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    valid_from DATETIME,
    valid_until DATETIME,
    allowed_dates TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_types_user_slug ON booking_types(user_id, slug);
CREATE INDEX IF NOT EXISTS idx_booking_types_user ON booking_types(user_id);

CREATE TABLE IF NOT EXISTS booking_appointments (
    id TEXT PRIMARY KEY,
    booking_type_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_notes TEXT,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    event_id TEXT,
    created_at DATETIME NOT NULL,
    FOREIGN KEY(booking_type_id) REFERENCES booking_types(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_appts_user_time ON booking_appointments(user_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_booking_appts_type ON booking_appointments(booking_type_id);

CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    mode TEXT NOT NULL DEFAULT 'one_on_one',
    status TEXT NOT NULL DEFAULT 'open',
    short_url TEXT,
    expires_at DATETIME NOT NULL,
    confirmed_slot_id TEXT,
    confirmed_slot_start DATETIME,
    confirmed_slot_end DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meetings_user_status ON meetings(user_id, status);

CREATE TABLE IF NOT EXISTS meeting_slots (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    votes_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_slots_meeting ON meeting_slots(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_participants (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_info TEXT,
    vito_user_id TEXT,
    responded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY(vito_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_votes (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slot_id, participant_id),
    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY(slot_id) REFERENCES meeting_slots(id) ON DELETE CASCADE,
    FOREIGN KEY(participant_id) REFERENCES meeting_participants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_votes_slot ON meeting_votes(slot_id);

CREATE TABLE IF NOT EXISTS p2p_meeting_invites (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'pending',
    event_id_from TEXT,
    event_id_to TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_p2p_invites_to_status ON p2p_meeting_invites(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_p2p_invites_from ON p2p_meeting_invites(from_user_id);

-- ============================================================================
-- 3. Todos & Pending Items
-- ============================================================================
CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT 'geral',
    due_date DATETIME,
    remind_at DATETIME,
    remind_repeat TEXT DEFAULT 'none',
    remind_advance INTEGER DEFAULT 0,
    event_id TEXT,
    event_title TEXT,
    reminder_sent_at DATETIME,
    start_reminder_sent_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todos_user_status ON todos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(status, due_date);
CREATE INDEX IF NOT EXISTS idx_todos_user_category ON todos(user_id, category);

CREATE TABLE IF NOT EXISTS todo_subtasks (
    id TEXT PRIMARY KEY,
    todo_id TEXT NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(todo_id) REFERENCES todos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todo_subtasks_todo ON todo_subtasks(todo_id);

CREATE TABLE IF NOT EXISTS pending_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'geral',
    status TEXT NOT NULL DEFAULT 'inbox',
    scheduled_date TEXT,
    remind_at DATETIME,
    remind_repeat TEXT DEFAULT 'none',
    remind_advance INTEGER DEFAULT 0,
    nudge_sent_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_items_user_status ON pending_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_items_user_date ON pending_items(user_id, scheduled_date);

-- ============================================================================
-- 4. Bots (Triggers), Skills, Actions & Memories
-- ============================================================================
CREATE TABLE IF NOT EXISTS triggers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    query TEXT NOT NULL,
    condition_type TEXT NOT NULL DEFAULT 'daily_brief',
    target_value TEXT NOT NULL DEFAULT '',
    current_value TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    frequency TEXT NOT NULL DEFAULT 'daily_morning',
    scheduled_time TEXT DEFAULT '',
    days_of_week TEXT DEFAULT 'DAILY',
    last_run_status TEXT DEFAULT '',
    last_checked_at DATETIME,
    next_check_at DATETIME,
    last_error TEXT DEFAULT '',
    last_seen_hashes TEXT DEFAULT '[]',
    user_intent TEXT DEFAULT '',
    search_keywords TEXT DEFAULT '',
    last_notified_at DATETIME,
    search_config_json TEXT NOT NULL DEFAULT '{}',
    seen_fingerprints_json TEXT NOT NULL DEFAULT '[]',
    last_metric_value REAL,
    goal TEXT NOT NULL DEFAULT '',
    rules_json TEXT NOT NULL DEFAULT '[]',
    icon TEXT NOT NULL DEFAULT 'radar',
    color TEXT NOT NULL DEFAULT 'orange',
    skin_json TEXT NOT NULL DEFAULT '{}',
    template_key TEXT NOT NULL DEFAULT '',
    quiet_only_on_change INTEGER NOT NULL DEFAULT 1,
    thread_id TEXT NOT NULL DEFAULT '',
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    model_pref TEXT NOT NULL DEFAULT '',
    effort_pref TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_triggers_user_status ON triggers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_triggers_user_category ON triggers(user_id, category);
CREATE INDEX IF NOT EXISTS idx_triggers_worker ON triggers(status, next_check_at);

CREATE TABLE IF NOT EXISTS trigger_logs (
    id TEXT PRIMARY KEY,
    trigger_id TEXT NOT NULL,
    triggered_at DATETIME NOT NULL,
    message TEXT NOT NULL,
    payload TEXT,
    is_read BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY(trigger_id) REFERENCES triggers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trigger_logs_trigger ON trigger_logs(trigger_id);

CREATE TABLE IF NOT EXISTS bot_actions (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action_key TEXT NOT NULL,
    policy TEXT NOT NULL DEFAULT 'ask' CHECK (policy IN ('auto','ask','off')),
    config_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(bot_id) REFERENCES triggers(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(bot_id, action_key)
);

CREATE INDEX IF NOT EXISTS idx_bot_actions_bot ON bot_actions(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_actions_user ON bot_actions(user_id, bot_id);

CREATE TABLE IF NOT EXISTS bot_skills (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    skill_key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    FOREIGN KEY(bot_id) REFERENCES triggers(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(bot_id, skill_key)
);

CREATE INDEX IF NOT EXISTS idx_bot_skills_bot ON bot_skills(bot_id);

CREATE TABLE IF NOT EXISTS bot_memories (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'chat' CHECK (source IN ('chat','auto')),
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(bot_id) REFERENCES triggers(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bot_memories_bot ON bot_memories(bot_id, is_active);

-- ============================================================================
-- 5. Settings, Briefings, Chat & AI Providers / Traces / Evals
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_briefing_settings (
    user_id TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    scheduled_time TEXT NOT NULL DEFAULT '07:30',
    wakeup_alarm_early BOOLEAN NOT NULL DEFAULT 1,
    last_sent_date TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_ai_settings (
    user_id TEXT PRIMARY KEY,
    autonomy_mode TEXT NOT NULL DEFAULT 'assisted',
    auto_focus_blocks BOOLEAN NOT NULL DEFAULT 0,
    persona_style TEXT NOT NULL DEFAULT 'balanced',
    preferred_voice TEXT NOT NULL DEFAULT 'gemini-default',
    emoji_policy TEXT NOT NULL DEFAULT 'auto',
    response_length TEXT NOT NULL DEFAULT 'medium',
    default_model TEXT NOT NULL DEFAULT '',
    default_effort TEXT NOT NULL DEFAULT 'auto',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_ai_providers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_key TEXT NOT NULL CHECK (provider_key IN ('anthropic','google','openai','groq','openrouter','custom')),
    base_url TEXT NOT NULL DEFAULT '',
    key_ciphertext TEXT NOT NULL,
    key_last4 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','invalid')),
    verified_at DATETIME,
    models_json TEXT NOT NULL DEFAULT '[]',
    models_fetched_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE(user_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_providers_user ON user_ai_providers(user_id, provider_key);

CREATE TABLE IF NOT EXISTS summary_dispatches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    summary_type TEXT NOT NULL,
    period_key TEXT NOT NULL,
    dispatched_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_summary_dispatch_uniq ON summary_dispatches(user_id, summary_type, period_key);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    preview TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    image_uri TEXT,
    action_performed TEXT,
    created_at DATETIME NOT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

CREATE TABLE IF NOT EXISTS conversation_threads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    external_chat_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    rolling_summary TEXT NOT NULL DEFAULT '',
    summary_up_to_turn_id TEXT NOT NULL DEFAULT '',
    sticky_model_name TEXT NOT NULL DEFAULT '',
    sticky_model_until DATETIME,
    model_pref TEXT NOT NULL DEFAULT '',
    effort_pref TEXT NOT NULL DEFAULT '',
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_consolidated_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conv_threads_user_channel ON conversation_threads(user_id, channel, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS conversation_turns (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    role TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'direct',
    worker_type TEXT NOT NULL DEFAULT '',
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

CREATE INDEX IF NOT EXISTS idx_conv_turns_thread_created ON conversation_turns(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_conv_turns_user_created ON conversation_turns(user_id, created_at DESC);

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
    status TEXT NOT NULL DEFAULT 'SUSPENDED',
    expires_at DATETIME NOT NULL,
    resolved_at DATETIME,
    execution_result_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (thread_id) REFERENCES conversation_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_conf_user_status ON pending_confirmations(user_id, status, expires_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_conf_idempotency ON pending_confirmations(user_id, idempotency_key) WHERE status = 'SUSPENDED';

CREATE TABLE IF NOT EXISTS ai_traces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    thread_id TEXT NOT NULL DEFAULT '',
    turn_id TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT '',
    task_type TEXT NOT NULL DEFAULT 'chat',
    provider_name TEXT NOT NULL,
    model_name TEXT NOT NULL,
    agent_name TEXT NOT NULL DEFAULT '',
    credential_source TEXT NOT NULL DEFAULT '',
    provider_key TEXT NOT NULL DEFAULT '',
    effort TEXT NOT NULL DEFAULT '',
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

CREATE INDEX IF NOT EXISTS idx_ai_traces_created ON ai_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_traces_provider_task ON ai_traces(provider_name, task_type, created_at DESC);

CREATE TABLE IF NOT EXISTS attention_budget_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_worker TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'geral',
    urgency TEXT NOT NULL DEFAULT 'normal',
    dedup_key TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'DELIVERED',
    defer_reason TEXT NOT NULL DEFAULT '',
    scheduled_for DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attention_budget_user_created ON attention_budget_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attention_budget_dedup ON attention_budget_logs(user_id, dedup_key, created_at DESC) WHERE dedup_key != '';

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

CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_suite_created ON ai_eval_runs(suite_name, created_at DESC);

-- ============================================================================
-- 6. Memory Hierarchy, Embeddings & Entity Links
-- ============================================================================
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 3,
    confidence REAL DEFAULT 1.0,
    access_count INTEGER DEFAULT 0,
    last_accessed_at DATETIME,
    superseded_by TEXT DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content, category, content='memories', content_rowid='rowid');

CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, content, category) VALUES (new.rowid, new.content, new.category);
END;
CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content, category) VALUES ('delete', old.rowid, old.content, old.category);
END;
CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content, category) VALUES ('delete', old.rowid, old.content, old.category);
    INSERT INTO memories_fts(rowid, content, category) VALUES (new.rowid, new.content, new.category);
END;

CREATE TABLE IF NOT EXISTS user_entities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relation TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_entities_user_name ON user_entities(user_id, name);

CREATE TABLE IF NOT EXISTS user_core_profile (
    user_id TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    profile_value TEXT NOT NULL DEFAULT '',
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, profile_key)
);

CREATE INDEX IF NOT EXISTS idx_core_profile_user ON user_core_profile(user_id);

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

CREATE INDEX IF NOT EXISTS idx_user_memories_user_active ON user_memories(user_id, is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_category ON user_memories(user_id, category, is_active);

CREATE VIRTUAL TABLE IF NOT EXISTS user_memories_fts USING fts5(
    record_id UNINDEXED,
    user_id UNINDEXED,
    content,
    category,
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS memory_episodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    thread_id TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'app_mobile',
    title TEXT NOT NULL,
    narrative_summary TEXT NOT NULL,
    participants_json TEXT NOT NULL DEFAULT '[]',
    emotional_tone TEXT NOT NULL DEFAULT 'neutral',
    importance INTEGER NOT NULL DEFAULT 3,
    happened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    followup_date DATETIME,
    followup_done INTEGER NOT NULL DEFAULT 0,
    embedding_blob BLOB,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_episodes_user_date ON memory_episodes(user_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_episodes_followup ON memory_episodes(user_id, followup_done, followup_date) WHERE followup_date IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_memory_themes_user ON memory_thematic_summaries(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS memory_episode_facts (
    episode_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'extracted_from',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (episode_id, memory_id),
    FOREIGN KEY (episode_id) REFERENCES memory_episodes(id) ON DELETE CASCADE,
    FOREIGN KEY (memory_id) REFERENCES user_memories(id) ON DELETE CASCADE
);

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

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_user ON memory_embeddings(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS entity_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
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

CREATE INDEX IF NOT EXISTS idx_entity_links_user_name ON entity_links(user_id, canonical_name);
CREATE INDEX IF NOT EXISTS idx_entity_links_user_wa ON entity_links(user_id, whatsapp_jid) WHERE whatsapp_jid != '';
CREATE INDEX IF NOT EXISTS idx_entity_links_user_email ON entity_links(user_id, email) WHERE email != '';

-- ============================================================================
-- 7. WhatsApp, Gmail & Contacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    instance_name TEXT NOT NULL UNIQUE,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected',
    pairing_code TEXT,
    last_connected_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_user_id ON whatsapp_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instance ON whatsapp_integrations(instance_name);

CREATE TABLE IF NOT EXISTS gmail_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    account_email TEXT NOT NULL,
    encrypted_credentials TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    history_id TEXT,
    last_scanned_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gmail_user_id ON gmail_integrations(user_id);

CREATE TABLE IF NOT EXISTS whatsapp_conversation_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    instance_name TEXT NOT NULL,
    chat_jid TEXT NOT NULL,
    chat_kind TEXT NOT NULL,
    chat_label TEXT NOT NULL DEFAULT '',
    sender_jid TEXT NOT NULL DEFAULT '',
    sender_name TEXT NOT NULL DEFAULT '',
    from_me INTEGER NOT NULL DEFAULT 0,
    kind TEXT NOT NULL DEFAULT 'text',
    text TEXT NOT NULL DEFAULT '',
    quoted_text TEXT NOT NULL DEFAULT '',
    media_kind TEXT NOT NULL DEFAULT '',
    media_mime TEXT NOT NULL DEFAULT '',
    media_status TEXT NOT NULL DEFAULT '',
    media_text TEXT NOT NULL DEFAULT '',
    media_payload TEXT NOT NULL DEFAULT '',
    quoted_id TEXT NOT NULL DEFAULT '',
    message_timestamp DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_user_chat_ts ON whatsapp_conversation_messages (user_id, chat_jid, message_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_user_ts ON whatsapp_conversation_messages (user_id, message_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_instance_ts ON whatsapp_conversation_messages (instance_name, message_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_media_pending ON whatsapp_conversation_messages (user_id, media_status, message_timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_quoted ON whatsapp_conversation_messages (user_id, quoted_id);

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

CREATE TABLE IF NOT EXISTS whatsapp_context_settings (
    user_id TEXT PRIMARY KEY,
    scope TEXT NOT NULL DEFAULT 'all',
    window_size INTEGER NOT NULL DEFAULT 12,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_pending_state (
    user_id TEXT NOT NULL,
    chat_jid TEXT NOT NULL,
    last_nudged_at DATETIME,
    snoozed_until DATETIME,
    dismissed_at DATETIME,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chat_jid),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_pending_user ON whatsapp_pending_state (user_id);

CREATE TABLE IF NOT EXISTS whatsapp_contact_aliases (
    user_id TEXT NOT NULL,
    chat_jid TEXT NOT NULL,
    alias TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chat_jid, alias),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_alias_user_alias ON whatsapp_contact_aliases (user_id, alias);

CREATE TABLE IF NOT EXISTS synced_contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone_digits TEXT NOT NULL,
    jid TEXT NOT NULL DEFAULT '',
    lid TEXT NOT NULL DEFAULT '',
    saved_name TEXT NOT NULL,
    profile_name TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'phonebook',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_phone_unique ON synced_contacts(user_id, phone_digits);
CREATE INDEX IF NOT EXISTS idx_contacts_user_phone ON synced_contacts(user_id, phone_digits);
CREATE INDEX IF NOT EXISTS idx_contacts_user_jid ON synced_contacts(user_id, jid);
CREATE INDEX IF NOT EXISTS idx_contacts_user_lid ON synced_contacts(user_id, lid);
CREATE INDEX IF NOT EXISTS idx_contacts_user_saved_name ON synced_contacts(user_id, saved_name COLLATE NOCASE);

-- ============================================================================
-- 8. Vito Finance (BYOK Open Finance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    pluggy_item_id TEXT NOT NULL UNIQUE,
    connector_id INTEGER DEFAULT 200,
    institution_name TEXT DEFAULT 'Meu Pluggy',
    status TEXT DEFAULT 'UPDATED',
    last_sync_at DATETIME,
    consent_expires_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fin_conn_user ON finance_connections(user_id);

CREATE TABLE IF NOT EXISTS finance_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    connection_id TEXT,
    pluggy_account_id TEXT NOT NULL UNIQUE,
    institution_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    account_subtype TEXT,
    name TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0.0,
    credit_limit REAL,
    available_credit_limit REAL,
    currency_code TEXT DEFAULT 'BRL',
    closing_day INTEGER,
    due_day INTEGER,
    minimum_payment REAL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(connection_id) REFERENCES finance_connections(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fin_acc_user ON finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_acc_conn ON finance_accounts(connection_id);

CREATE TABLE IF NOT EXISTS finance_merchants (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    logo_key TEXT,
    default_category TEXT,
    mcc INTEGER,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE(user_id, normalized_name),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_credit_bills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    pluggy_bill_id TEXT UNIQUE,
    closing_date TEXT,
    due_date TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0.0,
    minimum_payment REAL,
    finance_charges REAL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    paid_at DATETIME,
    is_estimated INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES finance_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fin_bill_user_due ON finance_credit_bills(user_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_bill_account ON finance_credit_bills(account_id, due_date DESC);

CREATE TABLE IF NOT EXISTS finance_installment_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    merchant_id TEXT,
    plan_key TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    installment_count INTEGER NOT NULL,
    installment_amount REAL NOT NULL,
    total_amount REAL,
    first_due_date TEXT,
    source TEXT NOT NULL DEFAULT 'PLUGGY',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE(user_id, plan_key),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES finance_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(merchant_id) REFERENCES finance_merchants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fin_plan_user ON finance_installment_plans(user_id);

CREATE TABLE IF NOT EXISTS finance_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    pluggy_transaction_id TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    clean_merchant_name TEXT,
    amount REAL NOT NULL,
    transaction_type TEXT NOT NULL,
    payment_method TEXT,
    category TEXT DEFAULT 'Outros',
    is_recurring INTEGER DEFAULT 0,
    installment_number INTEGER,
    total_installments INTEGER,
    installment_plan_id TEXT REFERENCES finance_installment_plans(id) ON DELETE SET NULL,
    bill_id TEXT REFERENCES finance_credit_bills(id) ON DELETE SET NULL,
    merchant_id TEXT REFERENCES finance_merchants(id) ON DELETE SET NULL,
    payment_type TEXT,
    mcc INTEGER,
    tx_status TEXT NOT NULL DEFAULT 'POSTED',
    occurred_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_user_date ON finance_transactions(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_user_cat ON finance_transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_fin_tx_account ON finance_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_bill ON finance_transactions(user_id, bill_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_plan ON finance_transactions(user_id, installment_plan_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_merchant ON finance_transactions(user_id, merchant_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS finance_category_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE(user_id, merchant_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(merchant_id) REFERENCES finance_merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_budgets_and_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    category_filter TEXT,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0.0,
    deadline_date TEXT,
    auto_alert_threshold INTEGER DEFAULT 80,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fin_budgets_user ON finance_budgets_and_goals(user_id);

CREATE TABLE IF NOT EXISTS finance_byok_backup (
    user_id TEXT PRIMARY KEY,
    ciphertext BLOB NOT NULL,
    nonce BLOB NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
