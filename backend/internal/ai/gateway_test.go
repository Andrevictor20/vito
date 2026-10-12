package ai_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
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

type MockTriggerEvaluatorProvider struct {
	MockProvider
	shouldEvalError bool
	result          *domain.TriggerTestResult
}

func (m *MockTriggerEvaluatorProvider) EvaluateTrigger(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	if m.shouldEvalError {
		return nil, errors.New("eval trigger failed")
	}
	return m.result, nil
}

type MockTextGeneratorProvider struct {
	MockProvider
	shouldGenError bool
	generatedText  string
}

func (m *MockTextGeneratorProvider) GenerateText(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	if m.shouldGenError {
		return "", errors.New("generate text failed")
	}
	return m.generatedText, nil
}

func TestGateway_EvaluateTrigger_Cascade(t *testing.T) {
	trig := &domain.Trigger{
		ID:    "trig-123",
		Title: "Jogos do Flamengo",
		Query: "Resultados recentes",
	}

	expectedResult := &domain.TriggerTestResult{
		TriggerID:    trig.ID,
		Title:        trig.Title,
		ConditionMet: true,
		Summary:      "Flamengo venceu última partida",
		CurrentData:  "Panorama detalhado do confronto",
	}

	// P1 (ex: Gemini) falha na avaliação
	p1 := &MockTriggerEvaluatorProvider{
		MockProvider:    MockProvider{name: "Gemini Pro"},
		shouldEvalError: true,
	}

	// P2 (ex: Groq) assume a avaliação e tem sucesso
	p2 := &MockTriggerEvaluatorProvider{
		MockProvider:    MockProvider{name: "Groq Qwen"},
		shouldEvalError: false,
		result:          expectedResult,
	}

	gw := ai.NewGateway(p1, p2)
	res, err := gw.EvaluateTrigger(context.Background(), trig)
	if err != nil {
		t.Fatalf("Esperava sucesso na cascata de vigília, mas obteve erro: %v", err)
	}

	if res.Summary != expectedResult.Summary {
		t.Errorf("Esperava summary '%s', obteve '%s'", expectedResult.Summary, res.Summary)
	}
	if res.CurrentData != expectedResult.CurrentData {
		t.Errorf("Esperava currentData '%s', obteve '%s'", expectedResult.CurrentData, res.CurrentData)
	}
}

func TestGateway_GenerateText_Cascade(t *testing.T) {
	// P1 falha
	p1 := &MockTextGeneratorProvider{
		MockProvider:   MockProvider{name: "Gemini"},
		shouldGenError: true,
	}

	// P2 tem sucesso
	p2 := &MockTextGeneratorProvider{
		MockProvider:   MockProvider{name: "Groq"},
		shouldGenError: false,
		generatedText:  "Síntese executiva diária gerada com sucesso",
	}

	gw := ai.NewGateway(p1, p2)
	text, err := gw.GenerateText(context.Background(), "System prompt", "User prompt")
	if err != nil {
		t.Fatalf("Esperava sucesso na geração de texto, mas obteve erro: %v", err)
	}

	if text != "Síntese executiva diária gerada com sucesso" {
		t.Errorf("Texto gerado inesperado: %s", text)
	}
}

