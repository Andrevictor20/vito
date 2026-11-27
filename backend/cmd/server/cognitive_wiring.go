package main

import (
	"context"
	"database/sql"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/finance"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
)

// CognitiveRuntimeConfig agrupa dependências de Onda 2 e Onda 3 conectadas após o setup do agente.
type CognitiveRuntimeConfig struct {
	DB                     *sql.DB
	EventRepo              domain.EventRepository
	NotifSvc               bots.PushDispatcher
	PendingSvc             *tasks.PendingService
	ReminderWorker         *calendar.ReminderWorker
	TodoReminderWorker     *tasks.TodoReminderWorker
	PendingNudgeWorker     *tasks.PendingNudgeWorker
	ExecutiveSummaryWorker *service.ExecutiveSummaryWorker
	TriggerWorker          *bots.TriggerWorker
	MorningBriefingWorker  *service.MorningBriefingWorker
	BehavioralWorker       *service.BehavioralWorker
	AgentSys               *AgentSubsystem
	FinanceRepo            finance.FinanceRepository
	FinanceSvc             *finance.FinanceService
	SpendingLimitEval      *finance.SpendingLimitEvaluator
	WhatsAppSvc            *whatsapp.WhatsAppService
}

type financePushNotifierAdapter struct {
	notif bots.PushDispatcher
}

func (a financePushNotifierAdapter) SendFinanceAlert(ctx context.Context, userID, title, body, deepLink string) error {
	if a.notif == nil {
		return nil
	}
	_, err := a.notif.SendPushToUser(userID, title, body, "normal", map[string]interface{}{
		"type":      "finance_alert",
		"deep_link": deepLink,
	})
	return err
}

type financeWASelfNotifierAdapter struct {
	wa *whatsapp.WhatsAppService
}

func (a financeWASelfNotifierAdapter) SendSelfFinanceAlert(ctx context.Context, userID, message string) error {
	if a.wa == nil || strings.TrimSpace(message) == "" {
		return nil
	}
	integ, err := a.wa.GetStatus(ctx, userID)
	if err != nil || integ == nil || integ.Status != domain.WhatsAppStatusConnected {
		return nil
	}
	digits := domain.PhoneDigits(integ.Phone)
	if digits == "" {
		return nil
	}
	return a.wa.SendWhatsAppMessage(ctx, userID, digits+"@s.whatsapp.net", message)
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
		if c.SpendingLimitEval != nil {
			c.SpendingLimitEval.SetAttentionBudget(budgetSvc)
			var pushN finance.FinancePushNotifier
			if c.NotifSvc != nil {
				pushN = financePushNotifierAdapter{notif: c.NotifSvc}
			}
			var waN finance.FinanceWhatsAppSelfNotifier
			if c.WhatsAppSvc != nil {
				waN = financeWASelfNotifierAdapter{wa: c.WhatsAppSvc}
			}
			c.SpendingLimitEval.SetNotifiers(pushN, waN)
		}
		if c.FinanceSvc != nil && c.FinanceRepo != nil {
			collector := finance.NewFinanceTriggerCollector(c.FinanceRepo, c.SpendingLimitEval, budgetSvc)
			c.FinanceSvc.SetOnSyncComplete(func(ctx context.Context, userID string) {
				_ = collector.CollectAndNotify(ctx, userID, time.Now().UTC())
			})
		}
	}

	if c.BehavioralWorker != nil && c.NotifSvc != nil {
		c.BehavioralWorker.SetNotificationService(c.NotifSvc)
	}

	if c.MorningBriefingWorker != nil && c.AgentSys != nil && c.AgentSys.ADKFacade != nil && c.AgentSys.ADKFacade.RoutedLLM() != nil {
		bridge := c.AgentSys.ADKFacade.ToolsetBridge()
		if bridge == nil {
			bridge = adkengine.NewToolsetBridge(c.AgentSys.ToolsetRegistry)
		}
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
