package ai_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
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

type MockVisionProvider struct {
	MockProvider
}

func (m *MockVisionProvider) SupportsVision() bool { return true }

func TestGateway_MultimodalImageRouting(t *testing.T) {
	intent := &ai.ParsedIntent{
		Action:  ai.ActionCreateTodo,
		Message: "Recibo lido com sucesso",
	}

	textOnly := &MockProvider{name: "Groq Llama", shouldError: false, intent: intent}
	visionPro := &MockVisionProvider{MockProvider: MockProvider{name: "Gemini Vision", shouldError: false, intent: intent}}

	// textOnly vem primeiro na ordem padrão da cascata
	gw := ai.NewGateway(textOnly, visionPro)

	// Quando o input contém imagem, o gateway DEVE priorizar o visionPro e não o textOnly
	res, err := gw.ParseIntent(context.Background(), ai.UserInput{
		Text:     "Extraia o valor deste recibo",
		ImageB64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=",
	})

	if err != nil {
		t.Fatalf("ParseIntent falhou inesperadamente: %v", err)
	}

	if res.ProviderUsed != "Gemini Vision" {
		t.Errorf("Esperava provedor 'Gemini Vision' para requisição com imagem, mas obteve '%s'", res.ProviderUsed)
	}
}
