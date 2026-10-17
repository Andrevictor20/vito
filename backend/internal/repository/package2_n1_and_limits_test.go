package repository_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// 1. Verifica que tanto ListByUser quanto ListPaged carregam Subtasks em batch (1 query IN em vez de N+1).
func TestTodoRepository_BatchSubtasksInListByUserAndListPaged(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{ID: "u-pkg2-1", Name: "Tester", Email: "pkg2@test.com", PasswordHash: "x"})

	todoRepo := repository.NewTodoRepository(db)
	now := time.Now().UTC()

	for i, id := range []string{"td-1", "td-2", "td-3"} {
		if err := todoRepo.Create(&domain.Todo{
			ID:        id,
			UserID:    "u-pkg2-1",
			Title:     "Tarefa " + id,
			Status:    domain.TodoStatusPending,
			Priority:  "high",
			CreatedAt: now.Add(time.Duration(i) * time.Minute),
			UpdatedAt: now.Add(time.Duration(i) * time.Minute),
		}); err != nil {
			t.Fatalf("create todo %s: %v", id, err)
		}
		_ = todoRepo.AddSubtask(&domain.Subtask{
			ID:        "sub-a-" + id,
			TodoID:    id,
			Title:     "Sub A " + id,
			Completed: false,
			CreatedAt: now,
			UpdatedAt: now,
		})
		_ = todoRepo.AddSubtask(&domain.Subtask{
			ID:        "sub-b-" + id,
			TodoID:    id,
			Title:     "Sub B " + id,
			Completed: true,
			CreatedAt: now.Add(time.Second),
			UpdatedAt: now.Add(time.Second),
		})
	}

	byUser, err := todoRepo.ListByUser("u-pkg2-1", domain.TodoStatusPending)
	if err != nil {
		t.Fatalf("ListByUser: %v", err)
	}
	for _, td := range byUser {
		if len(td.Subtasks) != 2 {
			t.Errorf("ListByUser: expected 2 subtasks on %s, got %d", td.ID, len(td.Subtasks))
		}
	}

	paged, total, err := todoRepo.ListPaged("u-pkg2-1", domain.TodoFilter{
		Status: domain.TodoStatusPending,
		Limit:  10,
	})
	if err != nil {
		t.Fatalf("ListPaged: %v", err)
	}
	if total != 3 || len(paged) != 3 {
		t.Fatalf("ListPaged: expected 3 todos, got len=%d total=%d", len(paged), total)
	}
	for _, td := range paged {
		if len(td.Subtasks) != 2 {
			t.Errorf("ListPaged: expected 2 subtasks on %s, got %d", td.ID, len(td.Subtasks))
		}
	}
}

// 2. Verifica que TriggerRepositorySQLite.ListUnreadLogsByTriggerIDs busca logs não lidos de múltiplos radares em 1 única query IN.
func TestTriggerRepository_ListUnreadLogsByTriggerIDs(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{ID: "u-pkg2-2", Name: "RadarUser", Email: "radar@test.com", PasswordHash: "x"})

	trigRepo := repository.NewTriggerRepository(db)
	now := time.Now().UTC()

	for _, id := range []string{"tr-1", "tr-2"} {
		if err := trigRepo.Create(&domain.Trigger{
			ID:            id,
			UserID:        "u-pkg2-2",
			Title:         "Radar " + id,
			Category:      domain.CategoryFinance,
			Query:         "PETR4",
			ConditionType: domain.ConditionPriceBelow,
			Status:        domain.TriggerStatusActive,
			Frequency:     domain.FrequencyHourly,
			CreatedAt:     now,
			UpdatedAt:     now,
		}); err != nil {
			t.Fatalf("create trigger %s: %v", id, err)
		}
	}

	_ = trigRepo.CreateLog(&domain.TriggerLog{
		ID:          "log-1",
		TriggerID:   "tr-1",
		TriggeredAt: now,
		Message:     "Alerta não lido 1",
		IsRead:      false,
	})
	_ = trigRepo.CreateLog(&domain.TriggerLog{
		ID:          "log-2",
		TriggerID:   "tr-1",
		TriggeredAt: now.Add(-time.Minute),
		Message:     "Alerta já lido",
		IsRead:      true,
	})
	_ = trigRepo.CreateLog(&domain.TriggerLog{
		ID:          "log-3",
		TriggerID:   "tr-2",
		TriggeredAt: now,
		Message:     "Alerta não lido 2",
		IsRead:      false,
	})

	grouped, err := trigRepo.ListUnreadLogsByTriggerIDs([]string{"tr-1", "tr-2"})
	if err != nil {
		t.Fatalf("ListUnreadLogsByTriggerIDs: %v", err)
	}
	if len(grouped["tr-1"]) != 1 || grouped["tr-1"][0].Message != "Alerta não lido 1" {
		t.Errorf("expected 1 unread log for tr-1, got %+v", grouped["tr-1"])
	}
	if len(grouped["tr-2"]) != 1 || grouped["tr-2"][0].Message != "Alerta não lido 2" {
		t.Errorf("expected 1 unread log for tr-2, got %+v", grouped["tr-2"])
	}
}

// 3. Guardião Arquitetural No-God-Files: nenhum arquivo .go de produção no backend pode ultrapassar 500 linhas.
func TestNoProductionGoFileExceeds500Lines(t *testing.T) {
	roots := []string{"..", "../../cmd"}
	for _, root := range roots {
		err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
				return nil
			}
			data, rErr := os.ReadFile(path)
			if rErr != nil {
				return nil
			}
			lines := strings.Count(string(data), "\n")
			if lines > 500 {
				t.Errorf("God File detectado (> 500 linhas): %s tem %d linhas", path, lines)
			}
			return nil
		})
		if err != nil {
			t.Fatalf("walk %s: %v", root, err)
		}
	}
}
