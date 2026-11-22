package main

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/catalog"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type botRunnerAdapter struct {
	runner *service.BotRunner
}

func (a *botRunnerAdapter) RunBotNow(ctx context.Context, userID, botID string) (*domain.BotRunReport, error) {
	return a.runner.RunBot(ctx, userID, botID, true)
}

type botChatAdapter struct {
	svc *service.BotChatService
}

func (a *botChatAdapter) GetMessages(ctx context.Context, userID, botID string) ([]handler.BotChatMessageDTO, error) {
	hist, err := a.svc.GetHistory(ctx, userID, botID)
	if err != nil {
		return nil, err
	}
	out := make([]handler.BotChatMessageDTO, 0, len(hist.Turns))
	for _, t := range hist.Turns {
		out = append(out, handler.BotChatMessageDTO{
			ID:        t.ID,
			Role:      t.Role,
			Content:   t.Content,
			CreatedAt: t.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	return out, nil
}

func (a *botChatAdapter) SendMessage(ctx context.Context, userID, botID, message string) (*handler.BotChatMessageDTO, error) {
	resp, err := a.svc.SendMessage(ctx, userID, botID, message)
	if err != nil {
		return nil, err
	}
	return &handler.BotChatMessageDTO{
		ID:        resp.ThreadID + "_reply",
		Role:      "assistant",
		Content:   resp.Reply,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		ModelUsed: resp.ModelUsed,
	}, nil
}

// setupBotSubsystem instancia BotService/BotRunner, BotChatService e BotHandler com catálogo e ADK.
func setupBotSubsystem(
	db *sql.DB,
	triggerRepo domain.TriggerRepository,
	notifSvc service.PushDispatcher,
	budgetSvc *service.AttentionBudgetService,
	agentSys *AgentSubsystem,
) *handler.BotHandler {
	botRepo := repository.NewBotRepository(db)
	cat, err := catalog.LoadDefaultCatalog()
	if err != nil {
		log.Printf("⚠️ [Bots] Falha ao carregar catálogo de bots: %v", err)
	}

	var botRuntime service.BotADKRuntime
	if agentSys != nil && agentSys.ADKFacade != nil {
		bridge := adkengine.NewToolsetBridge(agentSys.ToolsetRegistry)
		guardrail := adkengine.NewGuardrailPlugin(bridge, agentSys.ScopeGuard, agentSys.ConfGate, agentSys.TraceRecorder)
		botRuntime = adkengine.NewBotRuntimeAdapter(
			agentSys.ADKFacade.RoutedLLM(),
			agentSys.ADKFacade.SessionService(),
			bridge,
			guardrail,
		)
	}

	var convRepo *repository.ConversationStoreRepository
	if agentSys != nil {
		convRepo = agentSys.ConversationStore
	}
	botRunner := service.NewBotRunner(botRepo, triggerRepo, convRepo, cat, botRuntime, notifSvc, budgetSvc)
	botChatSvc := service.NewBotChatService(botRepo, triggerRepo, convRepo, cat, botRuntime, botRunner)

	botHandler := handler.NewBotHandler(db, botRepo, cat)
	botHandler.SetBotRunner(&botRunnerAdapter{runner: botRunner})
	botHandler.SetBotChatService(&botChatAdapter{svc: botChatSvc})
	if agentSys != nil {
		if agentSys.ConfGate != nil {
			botHandler.SetConfirmationGate(agentSys.ConfGate)
		}
		if agentSys.AIProviderSvc != nil {
			botHandler.SetAIProviderService(agentSys.AIProviderSvc)
		}
	}
	return botHandler
}
