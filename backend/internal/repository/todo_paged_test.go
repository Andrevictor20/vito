package repository

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
)

func openPagedTestDB(t *testing.T, userID string) *TodoRepositorySQLite {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "paged.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	now := time.Now().UTC()
	_, err = db.Exec(`INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
		userID, userID+"@x.com", "U", "h", now, now)
	if err != nil {
		t.Fatal(err)
	}
	return NewTodoRepository(db)
}

func seedPagedTodo(t *testing.T, r *TodoRepositorySQLite, id, userID, title, priority, due string) {
	t.Helper()
	var dueArg any
	if due != "" {
		parsed, err := time.Parse(time.RFC3339, due)
		if err != nil {
			t.Fatal(err)
		}
		dueArg = parsed
	}
	now := time.Now().UTC()
	_, err := r.db.Exec(`INSERT INTO todos (id, user_id, title, status, priority, created_at, updated_at, due_date) VALUES (?,?,?,?,?,?,?,?)`,
		id, userID, title, "pending", priority, now, now, dueArg)
	if err != nil {
		t.Fatal(err)
	}
}

func TestListPaged_PaginationFiltersSort(t *testing.T) {
	r := openPagedTestDB(t, "u1")
	seedPagedTodo(t, r, "t1", "u1", "Alfa urgente", "high", "2020-01-01T10:00:00Z")
	seedPagedTodo(t, r, "t2", "u1", "Beta futura", "low", "2099-01-01T10:00:00Z")
	seedPagedTodo(t, r, "t3", "u1", "Gama sem data", "medium", "")
	seedPagedTodo(t, r, "t4", "u1", "Delta hoje", "medium", time.Now().UTC().Add(2*time.Hour).Format(time.RFC3339))

	// Página 1/2
	page1, total, err := r.ListPaged("u1", domain.TodoFilter{Limit: 2, Offset: 0})
	if err != nil {
		t.Fatal(err)
	}
	if total != 4 || len(page1) != 2 {
		t.Fatalf("esperava total 4 e 2 itens, veio %d/%d", total, len(page1))
	}
	page2, _, err := r.ListPaged("u1", domain.TodoFilter{Limit: 2, Offset: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(page2) != 2 || page1[0].ID == page2[0].ID {
		t.Fatalf("páginas deveriam ser distintas: %v vs %v", page1[0].ID, page2[0].ID)
	}

	// Sem limit = tudo (compat)
	all, total, err := r.ListPaged("u1", domain.TodoFilter{})
	if err != nil || total != 4 || len(all) != 4 {
		t.Fatalf("sem limit deveria retornar tudo: %v %d", err, len(all))
	}

	// Overdue
	over, _, err := r.ListPaged("u1", domain.TodoFilter{Overdue: true})
	if err != nil || len(over) != 1 || over[0].ID != "t1" {
		t.Fatalf("overdue inesperado: %v %+v", err, over)
	}

	// NoDate
	nd, _, err := r.ListPaged("u1", domain.TodoFilter{NoDate: true})
	if err != nil || len(nd) != 1 || nd[0].ID != "t3" {
		t.Fatalf("nodate inesperado: %v %+v", err, nd)
	}

	// Busca
	q, _, err := r.ListPaged("u1", domain.TodoFilter{Query: "beta"})
	if err != nil || len(q) != 1 || q[0].ID != "t2" {
		t.Fatalf("busca inesperada: %v %+v", err, q)
	}

	// Sort prioridade: high primeiro
	pri, _, err := r.ListPaged("u1", domain.TodoFilter{Sort: "priority"})
	if err != nil || pri[0].ID != "t1" {
		t.Fatalf("sort prioridade inesperado: %v %+v", err, pri)
	}

	// Sort alpha: Alfa primeiro
	alpha, _, err := r.ListPaged("u1", domain.TodoFilter{Sort: "alpha"})
	if err != nil || alpha[0].Title != "Alfa urgente" {
		t.Fatalf("sort alpha inesperado: %v %+v", err, alpha)
	}

	// Isolamento multi-tenant
	other, total, err := r.ListPaged("u2", domain.TodoFilter{})
	if err != nil || total != 0 || len(other) != 0 {
		t.Fatalf("vazamento entre usuários: %v %d", err, total)
	}
}
