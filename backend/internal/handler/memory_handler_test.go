package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/go-chi/chi/v5"
	_ "modernc.org/sqlite"
)

func setupMemoryHandlerTest(t *testing.T) (*handler.MemoryHandler, *repository.MemoryHierarchyRepository, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_mem_handler.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao inicializar sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-mem-h1"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "User Mem H",
		Email:        "memh@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	repo := repository.NewMemoryHierarchyRepository(db)
	h := handler.NewMemoryHandler(repo)
	return h, repo, userID
}

func TestMemoryHandler_ListMemories(t *testing.T) {
	h, repo, userID := setupMemoryHandlerTest(t)
	ctx := context.Background()

	_ = repo.UpsertThematicSummary(ctx, &repository.MemoryThematicSummary{
		ID:                  "thm-1",
		UserID:              userID,
		ThemeSlug:           "rotina",
		ThemeTitle:          "Rotina Diária",
		ConsolidatedSummary: "Acorda às 06h30 e caminha 30 minutos.",
	})

	_ = repo.CreateAtomicFact(ctx, &repository.UserMemoryFact{
		ID:         "fct-1",
		UserID:     userID,
		Category:   "preference",
		Content:    "Prefere café sem açúcar",
		Confidence: 1.0,
		IsActive:   true,
	})

	req := httptest.NewRequest("GET", "/api/v1/memories", nil)
	reqCtx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(reqCtx)

	rr := httptest.NewRecorder()
	h.ListMemories(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d. Body: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Themes   []repository.MemoryThematicSummary `json:"themes"`
		Episodes []repository.MemoryEpisode         `json:"episodes"`
		Facts    []repository.UserMemoryFact        `json:"facts"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("falha ao decodificar JSON: %v", err)
	}

	if len(resp.Themes) != 1 || resp.Themes[0].ThemeSlug != "rotina" {
		t.Errorf("esperava tema 'rotina', obteve %+v", resp.Themes)
	}
	if len(resp.Facts) != 1 || resp.Facts[0].Content != "Prefere café sem açúcar" {
		t.Errorf("esperava fato do café, obteve %+v", resp.Facts)
	}
}

func TestMemoryHandler_Deletes(t *testing.T) {
	h, repo, userID := setupMemoryHandlerTest(t)
	ctx := context.Background()

	_ = repo.CreateAtomicFact(ctx, &repository.UserMemoryFact{
		ID:       "fct-del",
		UserID:   userID,
		Content:  "Vai se mudar em breve",
		IsActive: true,
	})

	// Test DeleteFact with Chi context
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID))
			next.ServeHTTP(w, req)
		})
	})
	r.Delete("/api/v1/memories/facts/{id}", h.DeleteFact)

	req := httptest.NewRequest("DELETE", "/api/v1/memories/facts/fct-del", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperava 200 ao deletar fato, obteve %d", rr.Code)
	}

	facts, _ := repo.ListAtomicFacts(ctx, userID, 10)
	if len(facts) != 0 {
		t.Errorf("esperava 0 fatos ativos após deleção, obteve %d", len(facts))
	}
}
