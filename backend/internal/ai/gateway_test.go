package ai_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/andrevmp/kito/backend/internal/ai"
)

// MockProvider implementa ai.Provider para testes de failover.
type MockProvider struct {
	name        string
	shouldError bool
	intent      *ai.ParsedIntent
}

func (m *MockProvider) Name() string { return m.name }
func (m *MockProvider) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	if m.shouldError {
		return nil, errors.New("provider failure")
	}
	res := *m.intent
	res.ProviderUsed = m.name
	return &res, nil
}

func TestGateway_FailoverCascade(t *testing.T) {
	expectedIntent := &ai.ParsedIntent{
		Action:  ai.ActionCreateEvent,
		Message: "Evento agendado com sucesso!",
		Event: &ai.ParsedEvent{
			Title:   "Médico",
			StartAt: time.Now().Add(24 * time.Hour),
			EndAt:   time.Now().Add(25 * time.Hour),
		},
	}

	// Cenário 1: Provedor 1 falha, Provedor 2 assume com sucesso
	p1 := &MockProvider{name: "Google Gemini", shouldError: true}
	p2 := &MockProvider{name: "OpenRouter Free", shouldError: false, intent: expectedIntent}

	gw := ai.NewGateway(p1, p2)
	result, err := gw.ParseIntent(context.Background(), ai.UserInput{Text: "Marque médico amanhã"})
	if err != nil {
		t.Fatalf("expected nil error on failover, got: %v", err)
	}

	if result.ProviderUsed != "OpenRouter Free" {
		t.Errorf("expected provider 'OpenRouter Free', got '%s'", result.ProviderUsed)
	}
	if result.Action != ai.ActionCreateEvent {
		t.Errorf("expected action CREATE_EVENT, got %s", result.Action)
	}

	// Cenário 2: Todos falham
	pAllFail := ai.NewGateway(
		&MockProvider{name: "P1", shouldError: true},
		&MockProvider{name: "P2", shouldError: true},
	)
	_, err = pAllFail.ParseIntent(context.Background(), ai.UserInput{Text: "Olá"})
	if err == nil {
		t.Errorf("expected error when all providers fail, got nil")
	}
}
