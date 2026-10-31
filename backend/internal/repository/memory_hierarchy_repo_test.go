package repository_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupMemoryDB(t *testing.T) *sql.DB {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_mem_hierarchy.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao inicializar sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:           "user-mem-1",
		Name:         "User Mem",
		Email:        "mem@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	// Criar thread para FK de episódios
	_, err = db.Exec(`INSERT INTO conversation_threads (id, user_id, channel) VALUES ('thread-mem-1', 'user-mem-1', 'chat')`)
	if err != nil {
		t.Fatalf("falha ao criar thread de teste: %v", err)
	}

	return db
}

func TestMemoryHierarchyRepository_EpisodesAndFTS(t *testing.T) {
	db := setupMemoryDB(t)
	defer db.Close()

	repo := repository.NewMemoryHierarchyRepository(db)
	ctx := context.Background()

	ep := &repository.MemoryEpisode{
		ID:               "ep-1",
		UserID:           "user-mem-1",
		ThreadID:         "thread-mem-1",
		Channel:          "chat",
		Title:            "Consulta com Dr. Rafael",
		NarrativeSummary: "Usuário agendou retorno com cardiologista Rafael para o dia 15.",
		Importance:       4,
		HappenedAt:       time.Now().UTC(),
	}

	if err := repo.CreateEpisode(ctx, ep); err != nil {
		t.Fatalf("falha ao criar episódio: %v", err)
	}

	list, err := repo.ListRecentEpisodes(ctx, "user-mem-1", 10)
	if err != nil {
		t.Fatalf("falha ao listar episódios: %v", err)
	}
	if len(list) != 1 || list[0].Title != "Consulta com Dr. Rafael" {
		t.Fatalf("esperava 1 episódio com título esperado, obteve %+v", list)
	}

	// Teste FTS5
	searchResults, err := repo.SearchHierarchy(ctx, "user-mem-1", "cardiologista", 5)
	if err != nil {
		t.Fatalf("falha na busca FTS5: %v", err)
	}
	if len(searchResults) == 0 {
		t.Fatalf("esperava encontrar resultado para 'cardiologista' via FTS5")
	}

	// Teste Deleção
	if err := repo.DeleteEpisode(ctx, "user-mem-1", "ep-1"); err != nil {
		t.Fatalf("falha ao deletar episódio: %v", err)
	}
	listAfter, _ := repo.ListRecentEpisodes(ctx, "user-mem-1", 10)
	if len(listAfter) != 0 {
		t.Fatalf("esperava 0 episódios após deleção, obteve %d", len(listAfter))
	}
}

func TestMemoryHierarchyRepository_ThematicSummariesAndFacts(t *testing.T) {
	db := setupMemoryDB(t)
	defer db.Close()

	repo := repository.NewMemoryHierarchyRepository(db)
	ctx := context.Background()

	// 1. Resumo Temático
	theme := &repository.MemoryThematicSummary{
		ID:                  "th-1",
		UserID:              "user-mem-1",
		ThemeSlug:           "saude",
		ThemeTitle:          "Saúde e Bem-Estar",
		ConsolidatedSummary: "Hipertenso controlado, faz natação terças e quintas.",
		FactCount:           2,
		EpisodeCount:        1,
	}
	if err := repo.UpsertThematicSummary(ctx, theme); err != nil {
		t.Fatalf("falha ao upsert tema: %v", err)
	}

	themes, err := repo.ListThematicSummaries(ctx, "user-mem-1")
	if err != nil {
		t.Fatalf("falha ao listar temas: %v", err)
	}
	if len(themes) != 1 || themes[0].ThemeSlug != "saude" {
		t.Fatalf("esperava tema 'saude', obteve %+v", themes)
	}

	// 2. Fatos Atômicos
	fact := &repository.UserMemoryFact{
		ID:         "fact-1",
		UserID:     "user-mem-1",
		Category:   "health",
		Content:    "Toma Losartana 50mg pela manhã",
		Confidence: 1.0,
		IsActive:   true,
	}
	if err := repo.CreateAtomicFact(ctx, fact); err != nil {
		t.Fatalf("falha ao criar fato atômico: %v", err)
	}

	facts, err := repo.ListAtomicFacts(ctx, "user-mem-1", 10)
	if err != nil {
		t.Fatalf("falha ao listar fatos atômicos: %v", err)
	}
	if len(facts) != 1 || facts[0].Content != "Toma Losartana 50mg pela manhã" {
		t.Fatalf("esperava 1 fato atômico, obteve %+v", facts)
	}

	// Desativação lógica do fato
	if err := repo.DeleteAtomicFact(ctx, "user-mem-1", "fact-1"); err != nil {
		t.Fatalf("falha ao desativar fato atômico: %v", err)
	}
	factsAfter, _ := repo.ListAtomicFacts(ctx, "user-mem-1", 10)
	if len(factsAfter) != 0 {
		t.Fatalf("esperava 0 fatos ativos após deleção, obteve %d", len(factsAfter))
	}

	// Remoção de tema
	if err := repo.DeleteThematicSummary(ctx, "user-mem-1", "saude"); err != nil {
		t.Fatalf("falha ao deletar tema: %v", err)
	}
	themesAfter, _ := repo.ListThematicSummaries(ctx, "user-mem-1")
	if len(themesAfter) != 0 {
		t.Fatalf("esperava 0 temas após deleção, obteve %d", len(themesAfter))
	}
}
