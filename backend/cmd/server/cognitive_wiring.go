package main

import (
	"database/sql"
	"log"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// CognitiveRuntimeConfig agrupa dependências de Onda 2 e Onda 3 conectadas após o setup do agente.
type CognitiveRuntimeConfig struct {
	DB                     *sql.DB
	EventRepo              domain.EventRepository
	NotifSvc               service.PushDispatcher
	PendingSvc             *service.PendingService
	ReminderWorker         *service.ReminderWorker
	TodoReminderWorker     *service.TodoReminderWorker
	PendingNudgeWorker     *service.PendingNudgeWorker
	ExecutiveSummaryWorker *service.ExecutiveSummaryWorker
	TriggerWorker          *service.TriggerWorker
	MorningBriefingWorker  *service.MorningBriefingWorker
	BehavioralWorker       *service.BehavioralWorker
	AgentSys               *AgentSubsystem
}

// CognitiveRuntimeResult expõe referências construídas para testes e inspeção.
type CognitiveRuntimeResult struct {
	BudgetSvc      *service.AttentionBudgetService
	WorkflowRunner *adkengine.CrossDomainBriefingWorkflowRunner
}

// wireCognitiveRuntime conecta EntityLinkRepository em PendingService, AttentionBudgetService nos workers
// proativos e o workflow ADK (ParallelAgent + SequentialAgent) no MorningBriefingWorker.
func wireCognitiveRuntime(c CognitiveRuntimeConfig) CognitiveRuntimeResult {
	var res CognitiveRuntimeResult

	if c.PendingSvc != nil && c.AgentSys != nil && c.AgentSys.EntityLinkRepo != nil {
		c.PendingSvc.SetEntityLinkRepository(c.AgentSys.EntityLinkRepo)
	}

	if c.DB != nil && c.EventRepo != nil {
		budgetSvc := service.NewAttentionBudgetService(c.DB, c.EventRepo)
		res.BudgetSvc = budgetSvc
		if c.ReminderWorker != nil {
			c.ReminderWorker.SetAttentionBudget(budgetSvc)
		}
		if c.TodoReminderWorker != nil {
			c.TodoReminderWorker.SetAttentionBudget(budgetSvc)
		}
		if c.PendingNudgeWorker != nil {
			c.PendingNudgeWorker.SetAttentionBudget(budgetSvc)
		}
		if c.ExecutiveSummaryWorker != nil {
			c.ExecutiveSummaryWorker.SetAttentionBudget(budgetSvc)
		}
		if c.TriggerWorker != nil {
			c.TriggerWorker.SetAttentionBudget(budgetSvc)
		}
		if c.MorningBriefingWorker != nil {
			c.MorningBriefingWorker.SetAttentionBudget(budgetSvc)
		}
		if c.BehavioralWorker != nil {
			c.BehavioralWorker.SetAttentionBudget(budgetSvc)
		}
	}

	if c.BehavioralWorker != nil && c.NotifSvc != nil {
		c.BehavioralWorker.SetNotificationService(c.NotifSvc)
	}

	if c.MorningBriefingWorker != nil && c.AgentSys != nil && c.AgentSys.ADKFacade != nil && c.AgentSys.ADKFacade.RoutedLLM() != nil {
		bridge := adkengine.NewToolsetBridge(c.AgentSys.ToolsetRegistry)
		wfRunner, err := adkengine.NewCrossDomainBriefingWorkflowRunner(c.AgentSys.ADKFacade.RoutedLLM(), bridge)
		if err != nil {
			log.Printf("⚠️ [Google ADK v2] Falha ao inicializar CrossDomainBriefingWorkflowRunner: %v", err)
		} else if wfRunner != nil {
			c.MorningBriefingWorker.SetBriefingWorkflowRunner(wfRunner)
			res.WorkflowRunner = wfRunner
		}
	}

	return res
}
