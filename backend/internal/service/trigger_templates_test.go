package service_test

import (
	"context"
	"testing"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestTriggerTemplates_ListTemplates(t *testing.T) {
	templates := service.DefaultTriggerTemplates()
	if len(templates) < 8 {
		t.Fatalf("esperava no mínimo 8 templates no catálogo, obteve %d", len(templates))
	}

	expectedAreas := map[string]bool{
		"carreiras": false,
		"concursos": false,
		"imoveis":   false,
		"financas":  false,
		"viagens":   false,
		"trabalho":  false,
		"estudos":   false,
	}

	for _, tmpl := range templates {
		if tmpl.ID == "" || tmpl.Title == "" || tmpl.Description == "" || tmpl.Icon == "" {
			t.Errorf("template com dados incompletos: %+v", tmpl)
		}
		if tmpl.Query == "" || tmpl.UserIntent == "" {
			t.Errorf("template %s sem query ou user_intent", tmpl.ID)
		}
		if tmpl.ConditionType == "" || tmpl.Frequency == "" {
			t.Errorf("template %s sem condition_type ou frequency", tmpl.ID)
		}
		if _, ok := expectedAreas[tmpl.Area]; ok {
			expectedAreas[tmpl.Area] = true
		}
	}

	for area, found := range expectedAreas {
		if !found {
			t.Errorf("área esperada %q não encontrada no catálogo de templates", area)
		}
	}
}

func TestTriggerTemplates_GetByID(t *testing.T) {
	tmpl, err := service.GetTriggerTemplateByID("tmpl-career-jobs")
	if err != nil {
		t.Fatalf("falha ao buscar template tmpl-career-jobs: %v", err)
	}
	if tmpl.Area != "carreiras" {
		t.Errorf("esperava área 'carreiras', obteve %q", tmpl.Area)
	}

	_, err = service.GetTriggerTemplateByID("tmpl-inexistente")
	if err == nil {
		t.Error("esperava erro ao buscar template inexistente")
	}
}

func TestTriggerTemplates_ActivateTemplate(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	userID := "user-tmpl-1"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{ID: userID, Name: "André", Email: "andre@test.com", PasswordHash: "x"})

	repo := repository.NewTriggerRepository(db)
	svc := service.NewTriggerService(repo)

	// 1. Ativação direta em 1-toque
	trig, err := svc.ActivateTemplate(context.Background(), userID, "tmpl-concursos-editais", nil)
	if err != nil {
		t.Fatalf("falha ao ativar template: %v", err)
	}

	if trig.ID == "" || trig.UserID != userID {
		t.Errorf("trigger criado incorretamente: %+v", trig)
	}
	if trig.Status != domain.TriggerStatusActive {
		t.Errorf("esperava status active, obteve %s", trig.Status)
	}
	if trig.Category != domain.CategoryPublicExams {
		t.Errorf("esperava categoria public_exams, obteve %s", trig.Category)
	}

	// 2. Ativação com personalização
	customTitle := "Concurso Auditor Fiscal Receita"
	customQuery := "concurso auditor fiscal receita federal edital"
	trigCustom, err := svc.ActivateTemplate(context.Background(), userID, "tmpl-concursos-editais", &domain.ActivateTemplateInput{
		Title: customTitle,
		Query: customQuery,
	})
	if err != nil {
		t.Fatalf("falha ao ativar template com customização: %v", err)
	}
	if trigCustom.Title != customTitle {
		t.Errorf("título customizado não foi aplicado: %s", trigCustom.Title)
	}
	if trigCustom.Query != customQuery {
		t.Errorf("query customizada não foi aplicada: %s", trigCustom.Query)
	}
}
