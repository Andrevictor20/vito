package service

import (
	"context"
	"fmt"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

// AssistantEngine define o contrato do motor Google ADK v2 (ADKLoopFacade).
type AssistantEngine interface {
	Run(ctx context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error)
	RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, onDelta func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error)
}

// AgentLoop atua como fachada delegando 100% da execução ao motor Google ADK v2.
type AgentLoop struct {
	router           *ai.ModelRouter
	registry         *toolsets.ToolsetsRegistry
	scopeGuard       domain.ScopeGuard
	confirmationGate *ConfirmationGateService
	convRepo         *repository.ConversationStoreRepository
	traceRecorder    ai.TraceRecorder
	userRepo         domain.UserRepository
	aiSettingsRepo   domain.AISettingsRepository
	contextEnricher  *AssistantContextEnricher
	engine           AssistantEngine
}

func (l *AgentLoop) SetEngine(engine AssistantEngine) { l.engine = engine }

func NewAgentLoop(
	router *ai.ModelRouter,
	registry *toolsets.ToolsetsRegistry,
	scopeGuard domain.ScopeGuard,
	confirmationGate *ConfirmationGateService,
	convRepo *repository.ConversationStoreRepository,
	traceRecorder ai.TraceRecorder,
) *AgentLoop {
	return &AgentLoop{
		router:           router,
		registry:         registry,
		scopeGuard:       scopeGuard,
		confirmationGate: confirmationGate,
		convRepo:         convRepo,
		traceRecorder:    traceRecorder,
	}
}

func (l *AgentLoop) SetUserRepositories(userRepo domain.UserRepository, aiSettingsRepo domain.AISettingsRepository) {
	l.userRepo = userRepo
	l.aiSettingsRepo = aiSettingsRepo
}

func (l *AgentLoop) SetContextEnricher(enricher *AssistantContextEnricher) {
	l.contextEnricher = enricher
}

func (l *AgentLoop) Run(ctx context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	if l.engine == nil {
		return nil, fmt.Errorf("motor ADK v2 não configurado no AgentLoop")
	}
	return l.engine.Run(ctx, req)
}

func (l *AgentLoop) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, onDelta func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	if l.engine == nil {
		return nil, fmt.Errorf("motor ADK v2 não configurado no AgentLoop")
	}
	return l.engine.RunStream(ctx, req, onDelta)
}
