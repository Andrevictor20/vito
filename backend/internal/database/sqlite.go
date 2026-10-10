package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Open conecta ao banco SQLite, aplica pragmas de performance e executa migrações.
func Open(dbPath string) (*sql.DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("falha ao criar diretório do banco %s: %w", dir, err)
	}

	dsn := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)&_pragma=synchronous(NORMAL)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("falha ao abrir conexão sqlite: %w", err)
	}

	if dbPath == ":memory:" {
		db.SetMaxOpenConns(1)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("falha no ping do sqlite: %w", err)
	}

	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("falha ao executar migrações: %w", err)
	}

	return db, nil
}

func runMigrations(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

	CREATE TABLE IF NOT EXISTS events (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL,
		description TEXT,
		location TEXT,
		start_at DATETIME NOT NULL,
		end_at DATETIME NOT NULL,
		reminder_sent_at DATETIME,
		start_reminder_sent_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_events_user_start ON events(user_id, start_at);

	CREATE TABLE IF NOT EXISTS todos (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		priority TEXT NOT NULL DEFAULT 'medium',
		due_date DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_todos_user_status ON todos(user_id, status);

	CREATE TABLE IF NOT EXISTS memories (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		category TEXT NOT NULL DEFAULT 'general',
		content TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);

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

	CREATE TABLE IF NOT EXISTS triggers (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL,
		category TEXT NOT NULL,
		query TEXT NOT NULL,
		condition_type TEXT NOT NULL DEFAULT 'daily_brief',
		target_value TEXT NOT NULL DEFAULT '',
		current_value TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'active',
		frequency TEXT NOT NULL DEFAULT 'daily_morning',
		last_checked_at DATETIME,
		next_check_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_triggers_user_status ON triggers(user_id, status);
	CREATE INDEX IF NOT EXISTS idx_triggers_user_category ON triggers(user_id, category);

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
	`

	if _, err := db.Exec(schema); err != nil {
		return err
	}

	// Migração incremental de colunas sem quebrar bancos existentes
	_, _ = db.Exec("ALTER TABLE events ADD COLUMN source TEXT DEFAULT 'vito'")
	_, _ = db.Exec("ALTER TABLE events ADD COLUMN category TEXT DEFAULT 'general'")
	_, _ = db.Exec("ALTER TABLE events ADD COLUMN color TEXT")
	_, _ = db.Exec("ALTER TABLE events ADD COLUMN recurrence TEXT")
	_, _ = db.Exec("ALTER TABLE events ADD COLUMN reminder_sent_at DATETIME")
	_, _ = db.Exec("ALTER TABLE events ADD COLUMN start_reminder_sent_at DATETIME")
	_, _ = db.Exec("ALTER TABLE todos ADD COLUMN event_id TEXT")
	_, _ = db.Exec("ALTER TABLE todos ADD COLUMN event_title TEXT")

	return nil
}
