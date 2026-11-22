package database

import (
	"path/filepath"
	"testing"
	"time"
)

func TestBotsSchema_TablesColumnsAndCascade(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bots_mig.db")
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Verifica tabelas de bots criadas pela 001_initial_schema.sql
	for _, tbl := range []string{"bot_actions", "bot_skills", "bot_memories"} {
		if !hasTable(db, tbl) {
			t.Fatalf("001 deveria criar tabela %s", tbl)
		}
	}

	// Verifica colunas de bot em triggers
	expectedCols := []string{
		"goal", "rules_json", "category", "icon", "color",
		"skin_json", "template_key", "quiet_only_on_change",
		"thread_id", "consecutive_failures", "model_pref", "effort_pref",
	}
	for _, col := range expectedCols {
		if !hasColumn(db, "triggers", col) {
			t.Fatalf("001 deveria garantir coluna triggers.%s", col)
		}
	}

	// Verifica constraints e ON DELETE CASCADE de bot_actions ao excluir trigger
	now := time.Now().UTC()
	if _, err := db.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('u1', 'User', 'u1@example.com', 'hash', ?, ?)`, now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
		INSERT INTO triggers (id, user_id, title, category, query, condition_type, status, frequency, created_at, updated_at)
		VALUES ('bot-1', 'u1', 'Passagem Rio', 'travel', 'Monitorar voo GRU-SDU', 'price_below', 'active', 'daily_morning', ?, ?)
	`, now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
		INSERT INTO bot_actions (id, bot_id, user_id, action_key, policy, config_json, created_at, updated_at)
		VALUES ('act-1', 'bot-1', 'u1', 'search', 'auto', '{}', ?, ?)
	`, now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
		INSERT INTO bot_actions (id, bot_id, user_id, action_key, policy, config_json, created_at, updated_at)
		VALUES ('act-bad', 'bot-1', 'u1', 'notify', 'invalid', '{}', ?, ?)
	`, now, now); err == nil {
		t.Fatal("esperava falha na CHECK constraint de policy em bot_actions")
	}
	if _, err := db.Exec(`DELETE FROM triggers WHERE id = 'bot-1'`); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM bot_actions WHERE bot_id = 'bot-1'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("esperava cascata em bot_actions ao excluir trigger, restaram %d", count)
	}
}
