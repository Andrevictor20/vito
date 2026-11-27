package repository_test

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupAIProviderRepoTest(t *testing.T) (*repository.AIProviderRepositorySQLite, string) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "test_ai_providers.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-byok-1"
	_, err = db.Exec(
		`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, 'BYOK User', 'byok@vito.app', 'h', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		userID,
	)
	if err != nil {
		t.Fatalf("falha ao inserir usuário: %v", err)
	}

	return repository.NewAIProviderRepository(db), userID
}

func TestAIProviderRepository_CRUDAndNoCiphertextLeak(t *testing.T) {
	repo, userID := setupAIProviderRepoTest(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)

	provider := &domain.UserAIProvider{
		UserID:        userID,
		ProviderKey:   domain.ProviderKeyAnthropic,
		KeyCiphertext: "secret-ciphertext-never-expose",
		KeyLast4:      "9876",
		Status:        domain.ProviderStatusOK,
		VerifiedAt:    &now,
		Models: []domain.ProviderModelInfo{
			{
				ID:             "claude-sonnet-4",
				Name:           "Claude Sonnet 4",
				SupportsTools:  true,
				SupportsVision: true,
				Reasoning:      true,
				QualityTier:    3,
				MaxContext:     200000,
			},
		},
		ModelsFetchedAt: &now,
	}

	if err := repo.Upsert(ctx, provider); err != nil {
		t.Fatalf("Upsert falhou: %v", err)
	}

	// JSON marshaling do UserAIProvider e Summary não deve conter KeyCiphertext.
	rawProviderJSON, err := json.Marshal(provider)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(rawProviderJSON), "secret-ciphertext-never-expose") {
		t.Fatalf("UserAIProvider vazou KeyCiphertext no JSON: %s", rawProviderJSON)
	}

	got, err := repo.GetByUserAndKey(ctx, userID, domain.ProviderKeyAnthropic)
	if err != nil {
		t.Fatalf("GetByUserAndKey falhou: %v", err)
	}
	if got.KeyCiphertext != "secret-ciphertext-never-expose" || got.KeyLast4 != "9876" {
		t.Fatalf("dados inesperados: %+v", got)
	}
	if len(got.Models) != 1 || got.Models[0].ID != "claude-sonnet-4" {
		t.Fatalf("modelos inesperados: %+v", got.Models)
	}

	// Upsert idempotente no mesmo (user_id, provider_key)
	provider.KeyLast4 = "4321"
	provider.KeyCiphertext = "updated-ciphertext"
	if err := repo.Upsert(ctx, provider); err != nil {
		t.Fatalf("Upsert update falhou: %v", err)
	}

	list, err := repo.ListByUser(ctx, userID)
	if err != nil {
		t.Fatalf("ListByUser falhou: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("esperava 1 provedor na lista, veio %d", len(list))
	}
	if list[0].KeyLast4 != "4321" || list[0].ModelCount != 1 || !list[0].Connected {
		t.Fatalf("resumo inválido: %+v", list[0])
	}
	rawSummaryJSON, _ := json.Marshal(list)
	if strings.Contains(string(rawSummaryJSON), "updated-ciphertext") {
		t.Fatalf("ListByUser vazou ciphertext no JSON: %s", rawSummaryJSON)
	}

	// UpdateStatus
	if err := repo.UpdateStatus(ctx, userID, domain.ProviderKeyAnthropic, domain.ProviderStatusInvalid); err != nil {
		t.Fatalf("UpdateStatus falhou: %v", err)
	}
	afterStatus, _ := repo.GetByUserAndKey(ctx, userID, domain.ProviderKeyAnthropic)
	if afterStatus.Status != domain.ProviderStatusInvalid {
		t.Fatalf("esperava status invalid, veio %s", afterStatus.Status)
	}

	// UpdateModels
	newModels := []domain.ProviderModelInfo{
		{ID: "claude-opus-4", Name: "Claude Opus 4", SupportsTools: true, Reasoning: true, QualityTier: 3, MaxContext: 200000},
		{ID: "claude-haiku-4", Name: "Claude Haiku 4", SupportsTools: true, Reasoning: true, QualityTier: 2, MaxContext: 200000},
	}
	if err := repo.UpdateModels(ctx, userID, domain.ProviderKeyAnthropic, newModels, now.Add(time.Minute)); err != nil {
		t.Fatalf("UpdateModels falhou: %v", err)
	}
	afterModels, _ := repo.ListByUser(ctx, userID)
	if afterModels[0].ModelCount != 2 {
		t.Fatalf("esperava 2 modelos após UpdateModels, veio %d", afterModels[0].ModelCount)
	}

	// Delete + ErrAIProviderNotFound
	if err := repo.Delete(ctx, userID, domain.ProviderKeyAnthropic); err != nil {
		t.Fatalf("Delete falhou: %v", err)
	}
	_, err = repo.GetByUserAndKey(ctx, userID, domain.ProviderKeyAnthropic)
	if !errors.Is(err, domain.ErrAIProviderNotFound) {
		t.Fatalf("esperava ErrAIProviderNotFound após Delete, veio %v", err)
	}
	if err := repo.Delete(ctx, userID, domain.ProviderKeyAnthropic); !errors.Is(err, domain.ErrAIProviderNotFound) {
		t.Fatalf("esperava ErrAIProviderNotFound ao deletar inexistente, veio %v", err)
	}
}

func TestAIProviderRepository_RejectsServerOrInvalidKey(t *testing.T) {
	repo, userID := setupAIProviderRepoTest(t)
	ctx := context.Background()

	err := repo.Upsert(ctx, &domain.UserAIProvider{
		UserID:        userID,
		ProviderKey:   domain.ProviderKeyServer,
		KeyCiphertext: "x",
		KeyLast4:      "0000",
	})
	if !errors.Is(err, domain.ErrInvalidProviderKey) {
		t.Fatalf("esperava ErrInvalidProviderKey para srv, veio %v", err)
	}
}
