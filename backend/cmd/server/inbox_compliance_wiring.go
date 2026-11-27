package main

import (
	"database/sql"

	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type inboxComplianceSubsystem struct {
	NotifInboxHandler      *handler.NotificationsInboxHandler
	StoreComplianceHandler *handler.StoreComplianceHandler
}

func setupInboxComplianceSubsystem(
	db *sql.DB,
	budgetSvc *service.AttentionBudgetService,
	agentSys *AgentSubsystem,
	todoRepo domain.TodoRepository,
) inboxComplianceSubsystem {
	inboxRepo := repository.NewNotificationsInboxRepository(db)
	inboxSvc := service.NewNotificationsInboxService(inboxRepo)
	inboxSvc.SetAttentionBudget(budgetSvc)
	inboxSvc.SetTodoRepository(todoRepo)

	var botRepo service.BotActionPolicyUpdater
	if agentSys != nil && agentSys.BotRepo != nil {
		botRepo = agentSys.BotRepo
	} else {
		botRepo = bots.NewBotRepository(db)
	}
	inboxSvc.SetBotRepository(botRepo)
	if agentSys != nil && agentSys.ConfGate != nil {
		inboxSvc.SetConfirmationGate(agentSys.ConfGate)
	}

	storeRepo := repository.NewStoreComplianceRepository(db)
	storeSvc := service.NewStoreComplianceService(storeRepo)

	return inboxComplianceSubsystem{
		NotifInboxHandler:      handler.NewNotificationsInboxHandler(inboxSvc),
		StoreComplianceHandler: handler.NewStoreComplianceHandler(storeSvc),
	}
}
