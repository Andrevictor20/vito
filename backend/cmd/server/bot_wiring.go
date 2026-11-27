package main

import (
	"context"
	"database/sql"
	"log"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/ai/search"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/bots/catalog"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func triggerFromBot(b *domain.Bot) *domain.Trigger {
	if b == nil {
		return nil
	}
	return &domain.Trigger{
		ID:            b.ID,
		UserID:        b.UserID,
		Title:         b.Title,
		Query:         b.Query,
		Category:      domain.TriggerCategory(b.Category),
		ConditionType: domain.TriggerConditionType(b.ConditionType),
	}
}

func fetchTriggerDelta(fetchCtx context.Context, triggerRepo domain.TriggerRepository, t *domain.Trigger) ([]string, []string, error) {
	if t == nil || triggerRepo == nil {
		return nil, nil, nil
	}
	items, err := search.RouteTriggerSource(t).Fetch(fetchCtx, t)
	if err != nil {
		return nil, nil, err
	}
	stored, err := triggerRepo.GetSeenHashes(t.ID)
	if err != nil {
		return nil, nil, err
	}
	seen := make(map[string]bool, len(stored))
	for _, h := range stored {
		seen[h] = true
	}
	var fresh, all []string
	for _, it := range items {
		h := search.HashDataPoint(it)
		all = append(all, h)
		if !seen[h] {
			fresh = append(fresh, h)
		}
	}
	return fresh, all, nil
}

func fetchTriggerPrice(fetchCtx context.Context, t *domain.Trigger) (float64, string, bool, error) {
	if t == nil || (t.ConditionType != domain.ConditionPriceAbove && t.ConditionType != domain.ConditionPriceBelow) {
		return 0, "", false, nil
	}
	items, err := search.RouteTriggerSource(t).Fetch(fetchCtx, t)
	if err != nil {
		return 0, "", false, err
	}
	for _, it := range items {
		if v, ok := bots.ParseMoneyValue(it.Value); ok {
			return v, it.Value, true, nil
		}
	}
	return 0, "", false, nil
}

// setupBotSubsystem instancia BotService/BotRunner, BotChatService e BotHandler com catálogo e ADK.
func setupBotSubsystem(
	db *sql.DB,
	triggerRepo domain.TriggerRepository,
	notifSvc bots.PushDispatcher,
	budgetSvc *service.AttentionBudgetService,
	agentSys *AgentSubsystem,
) (*bots.BotHandler, *bots.BotRunner) {
	var (
		botRepo *bots.BotRepositorySQLite
		cat     *catalog.Catalog
	)
	if agentSys != nil {
		botRepo = agentSys.BotRepo
		cat = agentSys.Catalog
	}
	if botRepo == nil && db != nil {
		botRepo = bots.NewBotRepository(db)
	}
	if cat == nil {
		var err error
		cat, err = catalog.LoadDefaultCatalog()
		if err != nil {
			log.Printf("⚠️ [Bots] Falha ao carregar catálogo de bots: %v", err)
		}
	}

	var botRuntime bots.BotADKRuntime
	if agentSys != nil && agentSys.ADKFacade != nil {
		bridge := agentSys.ADKFacade.ToolsetBridge()
		if bridge == nil {
			bridge = adkengine.NewToolsetBridge(agentSys.ToolsetRegistry)
		}
		guardrail := agentSys.ADKFacade.GuardrailPlugin()
		if guardrail == nil {
			guardrail = adkengine.NewGuardrailPlugin(bridge, agentSys.ScopeGuard, agentSys.ConfGate, agentSys.TraceRecorder)
		}
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
	botRunner := bots.NewBotRunner(botRepo, triggerRepo, convRepo, cat, botRuntime, notifSvc, budgetSvc)
	if triggerRepo != nil {
		botRunner.SetDeltaFetcher(func(fetchCtx context.Context, b *domain.Bot) ([]string, []string, error) {
			return fetchTriggerDelta(fetchCtx, triggerRepo, triggerFromBot(b))
		})
		botRunner.SetPriceFetcher(func(fetchCtx context.Context, b *domain.Bot) (float64, string, bool, error) {
			return fetchTriggerPrice(fetchCtx, triggerFromBot(b))
		})
	}
	botChatSvc := bots.NewBotChatService(botRepo, triggerRepo, convRepo, cat, botRuntime, botRunner)

	botHandler := bots.NewBotHandler(db, botRepo, cat)
	botHandler.SetBotRunner(botRunner)
	botHandler.SetBotChatService(botChatSvc.AsHandlerService())
	if agentSys != nil {
		if agentSys.ConfGate != nil {
			botHandler.SetConfirmationGate(agentSys.ConfGate)
		}
		if agentSys.AIProviderSvc != nil {
			botHandler.SetAIProviderService(agentSys.AIProviderSvc)
		}
		if agentSys.ToolsetRegistry != nil {
			botHandler.SetToolsetRegistry(agentSys.ToolsetRegistry)
		}
		if agentSys.ConversationStore != nil {
			botHandler.SetConversationStore(agentSys.ConversationStore)
		}
	}
	return botHandler, botRunner
}
