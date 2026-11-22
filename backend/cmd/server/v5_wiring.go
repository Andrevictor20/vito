package main

import (
	"database/sql"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type v5SubsystemResult struct {
	NotifInboxHandler      *handler.NotificationsInboxHandler
	StoreComplianceHandler *handler.StoreComplianceHandler
}

func setupV5Subsystem(
	db *sql.DB,
	budgetSvc *service.AttentionBudgetService,
	agentSys *AgentSubsystem,
	todoRepo domain.TodoRepository,
) v5SubsystemResult {
	inboxRepo := repository.NewNotificationsInboxRepository(db)
	inboxSvc := service.NewNotificationsInboxService(inboxRepo)
	inboxSvc.SetAttentionBudget(budgetSvc)
	inboxSvc.SetTodoRepository(todoRepo)
	inboxSvc.SetBotRepository(repository.NewBotRepository(db))
	if agentSys != nil && agentSys.ConfGate != nil {
		inboxSvc.SetConfirmationGate(agentSys.ConfGate)
	}

	storeRepo := repository.NewStoreComplianceRepository(db)
	storeSvc := service.NewStoreComplianceService(storeRepo)

	return v5SubsystemResult{
		NotifInboxHandler:      handler.NewNotificationsInboxHandler(inboxSvc),
		StoreComplianceHandler: handler.NewStoreComplianceHandler(storeSvc),
	}
}
