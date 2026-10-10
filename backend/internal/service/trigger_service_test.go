package service_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupTriggerServiceTest(t *testing.T) (*service.TriggerService, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_vito_trigger_service.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)

	userID := "user-svc-1"
	_ = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "User Service",
		Email:        "service@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	triggerSvc := service.NewTriggerService(triggerRepo)
	return triggerSvc, userID
}

func TestHeuristicClassifyCategory(t *testing.T) {
	tests := []struct {
		input    string
		expected domain.TriggerCategory
	}{
		{"Ações da PETR3 acima de R$ 35", domain.CategoryFinance},
		{"Monitore o lote de restituição do IRPF 2026", domain.CategoryTaxesDocs},
		{"Apartamento para alugar no Pinheiros até R$ 4000", domain.CategoryRealEstate},
		{"Tabela FIPE do Honda Civic", domain.CategoryAutomotive},
		{"Vagas de Tech Lead no Nubank ou edital do concurso", domain.CategoryCareer},
		{"Resumo de notícias sobre inteligência artificial", domain.CategoryNews},
		{"Lançamento do iPhone 17 e novidades da Apple", domain.CategoryTech},
		{"Passagem aérea de GRU para JFK barata", domain.CategoryTravel},
		{"Preço do tênis Nike Dunk na promoção", domain.CategoryShopping},
		{"Próximo jogo do Flamengo no domingo", domain.CategoryEventsSports},
		{"Nova temporada de série na Netflix", domain.CategoryEntertainment},
		{"Previsão de chuva e tempestade para amanhã", domain.CategoryWeather},
		{"Qualquer outra coisa que eu inventar", domain.CategoryCustom},
	}

	for _, tt := range tests {
		got := service.HeuristicClassifyCategory(tt.input)
		if got != tt.expected {
			t.Errorf("para '%s', esperava %s, mas obteve %s", tt.input, tt.expected, got)
		}
	}
}

func TestTriggerService_FullFlow(t *testing.T) {
	svc, userID := setupTriggerServiceTest(t)

	// 1. Criar disparador com categoria automática
	input := domain.CreateTriggerInput{
		Title: "Passagem para Lisboa",
		Query: "Avise se o voo de GRU para LIS ficar abaixo de R$ 3200",
	}

	created, err := svc.CreateTrigger(userID, input)
	if err != nil {
		t.Fatalf("falha ao criar disparador: %v", err)
	}

	if created.Category != domain.CategoryTravel {
		t.Errorf("categoria esperada travel, obteve %s", created.Category)
	}
	if created.Status != domain.TriggerStatusActive {
		t.Errorf("status inicial esperado active, obteve %s", created.Status)
	}

	// 2. Toggle Status para Pausado
	toggled, err := svc.ToggleStatus(created.ID, userID)
	if err != nil {
		t.Fatalf("falha ao alternar status: %v", err)
	}
	if toggled.Status != domain.TriggerStatusPaused {
		t.Errorf("status esperado paused, obteve %s", toggled.Status)
	}

	// 3. Toggle de volta para Ativo
	toggledBack, err := svc.ToggleStatus(created.ID, userID)
	if err != nil || toggledBack.Status != domain.TriggerStatusActive {
		t.Fatalf("esperava active após segundo toggle, obteve %s", toggledBack.Status)
	}

	// 4. Update
	newTitle := "Passagem para Lisboa (TAP ou Latam)"
	updated, err := svc.UpdateTrigger(created.ID, userID, domain.UpdateTriggerInput{
		Title: &newTitle,
	})
	if err != nil || updated.Title != newTitle {
		t.Fatalf("falha ao atualizar título: %v", err)
	}

	// 5. Record Evaluation & Logs
	err = svc.RecordTriggerEvaluation(created.ID, "R$ 3.150,00", domain.TriggerStatusTriggered, "Voo encontrado por R$ 3.150 na TAP!")
	if err != nil {
		t.Fatalf("falha ao registrar avaliação: %v", err)
	}

	logs, err := svc.ListTriggerLogs(created.ID, userID)
	if err != nil || len(logs) != 1 {
		t.Fatalf("esperava 1 log registrado, recebeu %d, err: %v", len(logs), err)
	}

	// 6. Delete
	if err := svc.DeleteTrigger(created.ID, userID); err != nil {
		t.Fatalf("falha ao deletar: %v", err)
	}
	_, err = svc.GetTrigger(created.ID, userID)
	if err == nil {
		t.Errorf("esperava erro ao buscar disparador excluído")
	}
}
