package database

import (
	"path/filepath"
	"testing"
)

func TestMigration002_TablesConstraintsAndCascade(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "v5_mig.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := db.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		t.Fatal(err)
	}

	requiredTables := []string{
		"user_notifications",
		"notification_preferences",
		"user_subscriptions",
		"account_compliance_requests",
		"ai_content_reports",
		"user_privacy_settings",
		"support_requests",
	}
	for _, tbl := range requiredTables {
		if !hasTable(db, tbl) {
			t.Fatalf("migration 002 deveria criar tabela %s", tbl)
		}
	}

	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('u-m2', 'V5', 'v5@test.com', 'h', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
	if err != nil {
		t.Fatal(err)
	}

	// CHECK constraints em user_notifications, user_subscriptions e account_compliance_requests
	if _, err := db.Exec(`INSERT INTO user_notifications (id, user_id, group_key, type, title) VALUES ('n-bad', 'u-m2', 'Agora', 'invalid_type', 'T')`); err == nil {
		t.Fatal("esperava erro CHECK para type inválido em user_notifications")
	}
	if _, err := db.Exec(`INSERT INTO user_subscriptions (user_id, plan, billing_cycle, status) VALUES ('u-m2', 'enterprise', 'month', 'active')`); err == nil {
		t.Fatal("esperava erro CHECK para plan inválido em user_subscriptions")
	}
	if _, err := db.Exec(`INSERT INTO account_compliance_requests (id, user_id, kind, status) VALUES ('c-bad', 'u-m2', 'erase_all', 'pending')`); err == nil {
		t.Fatal("esperava erro CHECK para kind inválido em account_compliance_requests")
	}

	// Inserções válidas + reexecução idempotente + ON DELETE CASCADE
	if _, err := db.Exec(`INSERT INTO user_notifications (id, user_id, group_key, type, title) VALUES ('n-1', 'u-m2', 'Agora', 'aprovar', 'Ok')`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO notification_preferences (user_id, agenda) VALUES ('u-m2', 1)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO user_subscriptions (user_id, plan, billing_cycle, status) VALUES ('u-m2', 'pro', 'year', 'trialing')`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO account_compliance_requests (id, user_id, kind, status) VALUES ('c-1', 'u-m2', 'export_json', 'completed')`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO ai_content_reports (id, user_id, thread_id, reason) VALUES ('r-1', 'u-m2', 'th-1', 'erro')`); err != nil {
		t.Fatal(err)
	}

	if err := runVersionedMigrations(db); err != nil {
		t.Fatalf("reexecução idempotente falhou: %v", err)
	}

	if _, err := db.Exec(`DELETE FROM users WHERE id = 'u-m2'`); err != nil {
		t.Fatal(err)
	}
	for _, tbl := range []string{"user_notifications", "notification_preferences", "user_subscriptions", "account_compliance_requests", "ai_content_reports"} {
		var cnt int
		if err := db.QueryRow(`SELECT COUNT(*) FROM ` + tbl + ` WHERE user_id = 'u-m2'`).Scan(&cnt); err != nil {
			t.Fatal(err)
		}
		if cnt != 0 {
			t.Fatalf("esperava cascata ao excluir usuário em %s, restaram %d", tbl, cnt)
		}
	}
}
