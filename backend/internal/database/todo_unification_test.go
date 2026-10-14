package database

import (
	"database/sql"
	"testing"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestMigratePendingItemsToTodos(t *testing.T) {
	db := openTestDB(t)

	_, err := db.Exec(`INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES ('u1','a@a.com','A','h',datetime('now'),datetime('now'))`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO pending_items (id, user_id, title, category, status, scheduled_date, created_at, updated_at) VALUES ('p1','u1','Ler livro','estudos','scheduled','2026-10-20',datetime('now'),datetime('now'))`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO pending_items (id, user_id, title, category, status, created_at, updated_at) VALUES ('p2','u1','Ideia solta','geral','inbox',datetime('now'),datetime('now'))`)
	if err != nil {
		t.Fatal(err)
	}

	if err := MigratePendingItemsToTodos(db); err != nil {
		t.Fatal(err)
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM todos WHERE id IN ('p1','p2')`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("esperava 2 migradas, veio %d", count)
	}

	var cat, status string
	if err := db.QueryRow(`SELECT category, status FROM todos WHERE id='p1'`).Scan(&cat, &status); err != nil {
		t.Fatal(err)
	}
	if cat != "estudos" || status != "pending" {
		t.Fatalf("p1 inesperada: %s/%s", cat, status)
	}

	// Idempotência: segunda rodada não duplica
	if err := MigratePendingItemsToTodos(db); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM todos WHERE id IN ('p1','p2')`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("migração duplicou: %d", count)
	}
}
