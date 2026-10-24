package repository

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
)

func openCognitionDB(t *testing.T) (*MemoryRepositorySQLite, string) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "cog.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	userID := "u-cog"
	now := time.Now().UTC()
	_, err = db.Exec(`INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
		userID, "c@c.com", "C", "h", now, now)
	if err != nil {
		t.Fatal(err)
	}
	return NewMemoryRepository(db), userID
}

func seedMemory(t *testing.T, r *MemoryRepositorySQLite, userID, category, content string, importance int) string {
	t.Helper()
	m := &domain.Memory{
		ID:     userID + "-" + content[:4] + string(rune('0'+importance)),
		UserID: userID, Category: category, Content: content,
		Importance: importance, Confidence: 1.0,
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	// ID único por conteúdo
	m.ID = userID + "/" + content
	if err := r.Create(m); err != nil {
		t.Fatal(err)
	}
	return m.ID
}

func TestSearchRelevant_RanksBySimilarity(t *testing.T) {
	r, userID := openCognitionDB(t)
	seedMemory(t, r, userID, "rotina", "academia todos os dias às sete da manhã", 3)
	seedMemory(t, r, userID, "trabalho", "reunião de alinhamento às segundas", 3)

	res, err := r.SearchRelevant(userID, "academia manhã", 8)
	if err != nil {
		t.Fatal(err)
	}
	if len(res) == 0 {
		t.Fatal("esperava ao menos 1 relevante")
	}
	if res[0].Content != "academia todos os dias às sete da manhã" {
		t.Fatalf("top1 inesperado: %q", res[0].Content)
	}
}

func TestSearchRelevant_ExcludesSuperseded(t *testing.T) {
	r, userID := openCognitionDB(t)
	oldID := seedMemory(t, r, userID, "rotina", "academia às sete da manhã", 5)
	if err := r.Supersede(oldID, userID, "new-id"); err != nil {
		t.Fatal(err)
	}
	res, err := r.SearchRelevant(userID, "academia manhã", 8)
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range res {
		if m.ID == oldID {
			t.Fatal("memória substituída não deveria retornar")
		}
	}
}

func TestReinforce_IncrementsAccess(t *testing.T) {
	r, userID := openCognitionDB(t)
	id := seedMemory(t, r, userID, "geral", "prefere café forte pela manhã", 3)
	before, err := r.GetByID(id, userID)
	if err != nil {
		t.Fatal(err)
	}

	time.Sleep(10 * time.Millisecond)
	if err := r.Reinforce(id, userID); err != nil {
		t.Fatal(err)
	}
	got, err := r.GetByID(id, userID)
	if err != nil {
		t.Fatal(err)
	}
	if got.AccessCount != 1 || got.LastAccessedAt == nil {
		t.Fatalf("reforço esperado, veio %+v", got)
	}
	if !got.UpdatedAt.Equal(before.UpdatedAt) {
		t.Fatalf("updated_at não deve mudar no Reinforce: antes=%v, depois=%v", before.UpdatedAt, got.UpdatedAt)
	}
}
