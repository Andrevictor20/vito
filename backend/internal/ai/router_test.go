package ai

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

// mockAgentProvider implementa AgentProvider para testes determinísticos sem I/O de rede.
type mockAgentProvider struct {
	name             string
	modelName        string
	tier             int
	supportsTools    bool
	supportsVision   bool
	maxContextTokens int
}

func (m *mockAgentProvider) Name() string             { return m.name }
func (m *mockAgentProvider) ModelName() string        { return m.modelName }
func (m *mockAgentProvider) QualityTier() int         { return m.tier }
func (m *mockAgentProvider) SupportsTools() bool      { return m.supportsTools }
func (m *mockAgentProvider) SupportsVision() bool     { return m.supportsVision }
func (m *mockAgentProvider) MaxContextTokens() int    { return m.maxContextTokens }
func (m *mockAgentProvider) Chat(ctx context.Context, req AgentChatRequest) (*AgentChatResponse, error) {
	return &AgentChatResponse{Text: "mock reply", ProviderName: m.name, ModelName: m.modelName}, nil
}
func (m *mockAgentProvider) StreamChat(ctx context.Context, req AgentChatRequest, onDelta func(StreamDelta) error) (*AgentChatResponse, error) {
	return m.Chat(ctx, req)
}

// TestModelRouter_SbETable1_QualityFloor valida os cenários da Tabela SbE 1 do SPEC-12-ATDD.
func TestModelRouter_SbETable1_QualityFloor(t *testing.T) {
	groqSmall := &mockAgentProvider{name: "groq-small", modelName: "llama-3-8b", tier: 1, supportsTools: true}
	groqLarge := &mockAgentProvider{name: "groq-large", modelName: "llama-3-70b", tier: 2, supportsTools: true}
	gemini := &mockAgentProvider{name: "gemini-flash", modelName: "gemini-2.5-flash", tier: 3, supportsTools: true}

	t.Run("Chat puro aceita provedor Tier 1", func(t *testing.T) {
		router := NewModelRouter(groqSmall)
		req := AgentChatRequest{Task: TaskChat, Messages: []TurnMessage{{Role: RoleUser, Content: "Olá"}}}
		p, err := router.SelectProvider(context.Background(), req)
		if err != nil {
			t.Fatalf("esperava sucesso para chat com tier 1, obteve erro: %v", err)
		}
		if p.Name() != "groq-small" {
			t.Errorf("esperava groq-small, obteve %s", p.Name())
		}
	})

	t.Run("TaskToolUse bloqueia provedor Tier 1 (Piso de Qualidade MinTier=2)", func(t *testing.T) {
		router := NewModelRouter(groqSmall)
		req := AgentChatRequest{Task: TaskToolUse, RequireTools: true}
		_, err := router.SelectProvider(context.Background(), req)
		if err == nil {
			t.Fatal("esperava erro ao tentar TaskToolUse com apenas Tier 1 disponível")
		}
		if !errors.Is(err, ErrNoProviderAvailable) {
			t.Errorf("esperava ErrNoProviderAvailable, obteve: %v", err)
		}
	})

	t.Run("TaskToolUse seleciona Tier 2 ou superior quando disponível", func(t *testing.T) {
		router := NewModelRouter(groqSmall, groqLarge)
		req := AgentChatRequest{Task: TaskToolUse, RequireTools: true}
		p, err := router.SelectProvider(context.Background(), req)
		if err != nil {
			t.Fatalf("esperava sucesso com Tier 2, obteve erro: %v", err)
		}
		if p.QualityTier() < 2 {
			t.Errorf("esperava no mínimo Tier 2, obteve %d (%s)", p.QualityTier(), p.Name())
		}
		if p.Name() != "groq-large" {
			t.Errorf("esperava groq-large, obteve %s", p.Name())
		}
	})

	t.Run("Seleciona o maior Tier disponível quando múltiplos satisfazem o piso", func(t *testing.T) {
		router := NewModelRouter(groqSmall, groqLarge, gemini)
		req := AgentChatRequest{Task: TaskToolUse, RequireTools: true}
		p, err := router.SelectProvider(context.Background(), req)
		if err != nil {
			t.Fatalf("esperava sucesso, obteve erro: %v", err)
		}
		if p.QualityTier() != 3 {
			t.Errorf("esperava Tier 3 (gemini-flash), obteve Tier %d (%s)", p.QualityTier(), p.Name())
		}
	})

	t.Run("Grounding, MemoryConsolidation e Vision exigem piso mínimo Tier 2", func(t *testing.T) {
		router := NewModelRouter(groqSmall)
		tasks := []TaskCategory{TaskGrounding, TaskMemoryConsolid, TaskVision}
		for _, task := range tasks {
			req := AgentChatRequest{Task: task}
			_, err := router.SelectProvider(context.Background(), req)
			if err == nil {
				t.Errorf("esperava erro para task=%s com provedor Tier 1", task)
			}
		}
	})
}

// TestModelRouter_RequireTools_Filtering valida o filtro de suporte a ferramentas.
func TestModelRouter_RequireTools_Filtering(t *testing.T) {
	geminiNoTools := &mockAgentProvider{name: "gemini-notools", tier: 3, supportsTools: false}
	groqWithTools := &mockAgentProvider{name: "groq-tools", tier: 2, supportsTools: true}

	router := NewModelRouter(geminiNoTools, groqWithTools)
	req := AgentChatRequest{
		Task:         TaskToolUse,
		RequireTools: true,
	}

	p, err := router.SelectProvider(context.Background(), req)
	if err != nil {
		t.Fatalf("falha ao selecionar provedor com tools: %v", err)
	}
	if !p.SupportsTools() {
		t.Errorf("provedor selecionado %s não suporta ferramentas", p.Name())
	}
	if p.Name() != "groq-tools" {
		t.Errorf("esperava groq-tools, obteve %s", p.Name())
	}
}

// TestModelRouter_StickyThread_15Minutes valida a fixação do provedor forte em threads com tools.
func TestModelRouter_StickyThread_15Minutes(t *testing.T) {
	groqSmall := &mockAgentProvider{name: "groq-small", tier: 1, supportsTools: true}
	geminiFlash := &mockAgentProvider{name: "gemini-flash", tier: 3, supportsTools: true}

	router := NewModelRouter(groqSmall, geminiFlash)
	threadID := "thread-sbe-sticky-123"

	// 1ª chamada: tarefa com ferramenta na thread escala para Gemini (Tier 3)
	req1 := AgentChatRequest{
		ThreadID:     threadID,
		Task:         TaskToolUse,
		RequireTools: true,
		Tools:        []ToolDefinition{{Name: "calendar_manager"}},
	}
	p1, err := router.SelectProvider(context.Background(), req1)
	if err != nil {
		t.Fatalf("falha na 1ª requisição: %v", err)
	}
	if p1.Name() != "gemini-flash" {
		t.Fatalf("esperava gemini-flash, obteve %s", p1.Name())
	}

	// Verifica se a thread ficou sticky
	isSticky, stickyProvider := router.IsSticky(threadID)
	if !isSticky {
		t.Fatal("esperava que a thread estivesse fixada (sticky)")
	}
	if stickyProvider != "gemini-flash" {
		t.Errorf("esperava stickyProvider=gemini-flash, obteve %s", stickyProvider)
	}

	// 2ª chamada: tarefa leve de chat puro na MESMA thread deve REUTILIZAR o Gemini fixado
	req2 := AgentChatRequest{
		ThreadID: threadID,
		Task:     TaskChat,
	}
	p2, err := router.SelectProvider(context.Background(), req2)
	if err != nil {
		t.Fatalf("falha na 2ª requisição: %v", err)
	}
	if p2.Name() != "gemini-flash" {
		t.Errorf("esperava retenção do sticky provider gemini-flash, obteve %s", p2.Name())
	}

	// Limpeza explícita da Sticky Thread
	router.ClearStickyThread(threadID)
	isStickyAfterClear, _ := router.IsSticky(threadID)
	if isStickyAfterClear {
		t.Error("esperava que a thread não estivesse mais fixada após ClearStickyThread")
	}
}

// TestModelRouter_StickyThread_Expiration valida que após expiração o router volta ao piso padrão.
func TestModelRouter_StickyThread_Expiration(t *testing.T) {
	groqSmall := &mockAgentProvider{name: "groq-small", tier: 1, supportsTools: true}
	geminiFlash := &mockAgentProvider{name: "gemini-flash", tier: 3, supportsTools: true}

	router := NewModelRouter(groqSmall, geminiFlash)
	threadID := "thread-expire-test"

	// Define TTL muito curto para testar expiração sem congelar suite
	router.SetStickyThread(threadID, "gemini-flash", 10*time.Millisecond)

	time.Sleep(25 * time.Millisecond)

	isSticky, _ := router.IsSticky(threadID)
	if isSticky {
		t.Error("esperava que a thread tivesse expirado após TTL")
	}

	// Requisição subsequente de TaskChat pura deve cair no groq-small se o gemini não for forçado
	routerClear := NewModelRouter(groqSmall)
	req := AgentChatRequest{ThreadID: threadID, Task: TaskChat}
	p, err := routerClear.SelectProvider(context.Background(), req)
	if err != nil {
		t.Fatalf("erro ao selecionar após expiração: %v", err)
	}
	if p.Name() != "groq-small" {
		t.Errorf("esperava groq-small após expiração, obteve %s", p.Name())
	}
}

// TestModelRouter_Concurrency testa concorrência com -race sem deadlock.
func TestModelRouter_Concurrency(t *testing.T) {
	p1 := &mockAgentProvider{name: "p1", tier: 1, supportsTools: true}
	p2 := &mockAgentProvider{name: "p2", tier: 3, supportsTools: true}
	router := NewModelRouter(p1, p2)

	var wg sync.WaitGroup
	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			req := AgentChatRequest{
				ThreadID:     "concurrent-thread",
				Task:         TaskToolUse,
				RequireTools: true,
			}
			_, _ = router.SelectProvider(context.Background(), req)
			router.IsSticky("concurrent-thread")
		}(i)
	}
	wg.Wait()
}
