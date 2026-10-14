-- 005_core_profile.sql — §8.2 Camada 1 Core Profile (UPSERT por memory_key).
CREATE TABLE IF NOT EXISTS user_core_profile (
	user_id TEXT NOT NULL,
	profile_key TEXT NOT NULL,
	profile_value TEXT NOT NULL DEFAULT '',
	updated_at DATETIME NOT NULL,
	PRIMARY KEY (user_id, profile_key)
);
CREATE INDEX IF NOT EXISTS idx_core_profile_user ON user_core_profile(user_id);
