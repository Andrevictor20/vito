-- 027_bots.sql
-- Fundação de Bots: ações, habilidades e memórias isoladas por bot.

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
