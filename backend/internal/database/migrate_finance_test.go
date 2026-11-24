package database

import (
	"path/filepath"
	"testing"
)

func TestMigration004_FinanceSyncAndLimitsSchema(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "finance_mig.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// 1. Colunas de telemetria em finance_connections
	connCols := []string{
		"last_attempt_at",
		"last_bank_refresh_at",
		"pluggy_execution_status",
		"last_error_code",
		"last_error_message",
		"consecutive_failures",
	}
	for _, col := range connCols {
		if !hasColumn(db, "finance_connections", col) {
			t.Fatalf("migration 004 deveria adicionar coluna %s em finance_connections", col)
		}
	}

	// 2. Colunas multi-escopo em finance_budgets_and_goals
	budgetCols := []string{
		"scope_type",
		"account_id",
		"merchant_id",
		"merchant_pattern",
		"period_type",
		"alert_thresholds_json",
		"repeat_over_step_percent",
		"pace_alert_enabled",
		"notify_channels_json",
		"include_pending",
		"is_active",
		"muted_until",
	}
	for _, col := range budgetCols {
		if !hasColumn(db, "finance_budgets_and_goals", col) {
			t.Fatalf("migration 004 deveria adicionar coluna %s em finance_budgets_and_goals", col)
		}
	}

	// 3. Tabela finance_limit_alert_events + constraint UNIQUE anti-duplicidade
	if !hasTable(db, "finance_limit_alert_events") {
		t.Fatalf("migration 004 deveria criar tabela finance_limit_alert_events")
	}

	if _, err := db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('u-fin', 'Fin', 'fin@test.com', 'h', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO finance_budgets_and_goals (id, user_id, kind, title, target_amount, created_at, updated_at) VALUES ('lim-1', 'u-fin', 'CATEGORY_LIMIT', 'Delivery', 500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO finance_limit_alert_events (id, user_id, limit_id, period_key, trigger_kind, threshold_percent, spent_amount, target_amount, notified_channels, created_at) VALUES ('ev-1', 'u-fin', 'lim-1', '2026-11', 'THRESHOLD', 80, 410, 500, '["in_app","push"]', CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO finance_limit_alert_events (id, user_id, limit_id, period_key, trigger_kind, threshold_percent, spent_amount, target_amount, notified_channels, created_at) VALUES ('ev-dup', 'u-fin', 'lim-1', '2026-11', 'THRESHOLD', 80, 420, 500, '["in_app","push"]', CURRENT_TIMESTAMP)`); err == nil {
		t.Fatal("esperava erro UNIQUE ao inserir evento duplicado em finance_limit_alert_events")
	}

	// 4. Reexecução idempotente
	if err := runVersionedMigrations(db); err != nil {
		t.Fatalf("reexecução idempotente falhou: %v", err)
	}
}
