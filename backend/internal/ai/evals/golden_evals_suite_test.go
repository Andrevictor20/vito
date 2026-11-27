package evals

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// TestAC06_COG06_ADKGoldenEvalsSuiteAndBotScope valida AC-06 (COG-06 / Onda 4):
// Dado a suíte ADK Golden Evals (36 trajetórias críticas: tool calling, zero tabelas e teto 320 na voz,
// ancoragem financeira, Pix/Web taint tracking no BeforeToolCallback e escopo de llmagent de bot),
// quando executa, então 100% das 36 trajetórias passam e são registradas em ai_eval_runs.
func TestAC06_COG06_ADKGoldenEvalsSuiteAndBotScope(t *testing.T) {
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "vito_adk_wave4.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:           "eval-user",
		Name:         "Eval User",
		Email:        "eval@vito.ai",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	runner := NewGoldenEvalRunner(db)
	report, err := runner.RunDefaultSuite(ctx)
	if err != nil {
		t.Fatalf("AC-06: erro ao executar suíte ADK Golden Evals: %v", err)
	}

	if report.Total < 35 {
		t.Fatalf("AC-06: esperava ao menos 35 cenários na suíte ADK Golden Evals, obteve %d", report.Total)
	}
	if report.FailedCount > 0 || report.PassedCount != report.Total {
		for _, r := range report.Results {
			if !r.Passed {
				t.Errorf("AC-06: cenário %s (%s) falhou: %s", r.ScenarioID, r.Category, r.Notes)
			}
		}
		t.Fatalf("AC-06: esperava 100%% de aprovação (%d/%d), mas %d falharam", report.PassedCount, report.Total, report.FailedCount)
	}

	var storedCount int
	if err := db.QueryRow(`SELECT COUNT(1) FROM ai_eval_runs WHERE suite_name = 'adk_golden_evals' AND passed = 1`).Scan(&storedCount); err != nil {
		t.Fatalf("AC-06: falha ao consultar tabela ai_eval_runs: %v", err)
	}
	if storedCount != report.Total {
		t.Errorf("AC-06: esperava %d execuções persistidas em ai_eval_runs, obteve %d", report.Total, storedCount)
	}
}
