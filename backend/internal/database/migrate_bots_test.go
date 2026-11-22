package database

import (
	"path/filepath"
	"testing"
	"time"
)

func TestBotsMigration_027_FreshAndLegacyBackfill(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bots_mig.db")
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Verifica tabelas criadas pela 027_bots.sql
	for _, tbl := range []string{"bot_actions", "bot_skills", "bot_memories"} {
		if !hasTable(db, tbl) {
			t.Fatalf("027 deveria criar tabela %s", tbl)
		}
	}

	// Verifica colunas adicionadas em triggers
	expectedCols := []string{
		"goal", "rules_json", "category", "icon", "color",
		"skin_json", "template_key", "quiet_only_on_change",
		"thread_id", "consecutive_failures", "model_pref", "effort_pref",
	}
	for _, col := range expectedCols {
		if !hasColumn(db, "triggers", col) {
			t.Fatalf("027 deveria garantir coluna triggers.%s", col)
		}
	}

	// Simula gatilho legado sem goal e sem bot_actions e reexecuta backfill
	now := time.Now().UTC()
	if _, err := db.Exec(`INSERT OR IGNORE INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('u1', 'User', 'u1@example.com', 'hash', ?, ?)`, now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
		INSERT INTO triggers (id, user_id, title, category, query, condition_type, status, frequency, created_at, updated_at)
		VALUES ('trig-legacy-1', 'u1', 'Passagem Rio', 'travel', 'Monitorar voo GRU-SDU abaixo de 500', 'price_below', 'active', 'daily_morning', ?, ?)
	`, now, now); err != nil {
		t.Fatal(err)
	}

	if err := backfillLegacyTriggersToBots(db); err != nil {
		t.Fatalf("backfillLegacyTriggersToBots falhou: %v", err)
	}
	// Idempotência: rodar novamente não pode falhar nem duplicar ações
	if err := backfillLegacyTriggersToBots(db); err != nil {
		t.Fatalf("segunda execução de backfillLegacyTriggersToBots falhou: %v", err)
	}

	var goal string
	if err := db.QueryRow(`SELECT goal FROM triggers WHERE id = 'trig-legacy-1'`).Scan(&goal); err != nil {
		t.Fatal(err)
	}
	if goal != "Monitorar voo GRU-SDU abaixo de 500" {
		t.Fatalf("esperava goal preenchido com query legada, obtido: %q", goal)
	}

	var actionCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM bot_actions WHERE bot_id = 'trig-legacy-1' AND policy = 'auto'`).Scan(&actionCount); err != nil {
		t.Fatal(err)
	}
	if actionCount != 2 {
		t.Fatalf("esperava 2 ações padrão (search, notify) em auto para gatilho legado, vieram %d", actionCount)
	}
}
