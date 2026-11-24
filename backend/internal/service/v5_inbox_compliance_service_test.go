package service_test

import (
	"context"
	"database/sql"
	"errors"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupV5ServiceDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "v5_svc.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	q := database.NewSingleWriterQueue(64)
	database.SetDefaultWriterQueue(q)
	t.Cleanup(func() {
		q.Close()
		database.SetDefaultWriterQueue(nil)
	})

	now := time.Now().UTC()
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID: "u-v5", Name: "André", Email: "andre@vito.test", PasswordHash: "hash", CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestNotificationsInbox_AttentionBudgetAndSync(t *testing.T) {
	db := setupV5ServiceDB(t)
	ctx := context.Background()

	inboxRepo := repository.NewNotificationsInboxRepository(db)
	budgetSvc := service.NewAttentionBudgetService(db, calendar.NewEventRepository(db))
	inboxSvc := service.NewNotificationsInboxService(inboxRepo)
	inboxSvc.SetAttentionBudget(budgetSvc)

	// 1. Candidato entregue via AttentionBudgetService deve persistir na caixa user_notifications.
	allowed, dec := budgetSvc.ShouldDeliver(ctx, service.AttentionCandidate{
		UserID:       "u-v5",
		SourceWorker: "finance_trigger",
		Category:     "financas",
		Urgency:      "normal",
		DedupKey:     "fatura-nubank-nov",
		Title:        "Fatura Nubank fecha em 2 dias",
		Body:         "Atual em R$ 1.870,00",
		Now:          time.Now().UTC(),
	})
	if !allowed || dec.Status != service.AttentionStatusDelivered {
		t.Fatalf("esperava entrega permitida, obteve allowed=%v dec=%+v", allowed, dec)
	}

	items, counts, err := inboxSvc.ListNotifications(ctx, "u-v5", domain.NotificationInboxFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || counts.Unread != 1 || items[0].SourceDomain != "financas" {
		t.Fatalf("esperava 1 notificação financeira não lida na caixa, obteve items=%+v counts=%+v", items, counts)
	}

	// 2. Desativar categoria 'financas' via preferências deve bloquear entregas futuras no AttentionBudgetService.
	f := false
	prefs, err := inboxSvc.UpdatePreferences(ctx, "u-v5", domain.NotificationPreferencesUpdate{Financas: &f})
	if err != nil {
		t.Fatal(err)
	}
	if prefs.Financas {
		t.Fatal("esperava financas=false após atualização")
	}

	allowedAfter, decAfter := budgetSvc.ShouldDeliver(ctx, service.AttentionCandidate{
		UserID:       "u-v5",
		SourceWorker: "finance_trigger",
		Category:     "financas",
		Urgency:      "normal",
		DedupKey:     "fatura-inter-nov",
		Title:        "Fatura Inter",
		Body:         "Fecha amanhã",
		Now:          time.Now().UTC(),
	})
	if allowedAfter || decAfter.Status != service.AttentionStatusSuppressed {
		t.Fatalf("esperava supressão por preferência do usuário, obteve allowed=%v dec=%+v", allowedAfter, decAfter)
	}

	// 3. Mesmo sem cache em memória (nova instância do AttentionBudgetService), deve ler notification_preferences do SQLite.
	freshBudget := service.NewAttentionBudgetService(db, nil)
	allowedFresh, decFresh := freshBudget.ShouldDeliver(ctx, service.AttentionCandidate{
		UserID:       "u-v5",
		SourceWorker: "finance_trigger",
		Category:     "financas",
		Urgency:      "normal",
		DedupKey:     "fatura-c6-nov",
		Title:        "Fatura C6",
		Body:         "Fecha hoje",
		Now:          time.Now().UTC(),
	})
	if allowedFresh || decFresh.Status != service.AttentionStatusSuppressed {
		t.Fatalf("esperava leitura persistida de notification_preferences, obteve allowed=%v dec=%+v", allowedFresh, decFresh)
	}
}

func TestNotificationsInbox_BotPendingAndOverdueTodoActions(t *testing.T) {
	db := setupV5ServiceDB(t)
	ctx := context.Background()

	botRepo := bots.NewBotRepository(db)
	todoRepo := tasks.NewTodoRepository(db)
	convRepo := repository.NewConversationStoreRepository(db)
	confGate := service.NewConfirmationGateService(db)
	inboxRepo := repository.NewNotificationsInboxRepository(db)
	inboxSvc := service.NewNotificationsInboxService(inboxRepo)
	inboxSvc.SetConfirmationGate(confGate)
	inboxSvc.SetBotRepository(botRepo)
	inboxSvc.SetTodoRepository(todoRepo)

	// Cria bot, thread, confirmação suspensa e tarefa atrasada.
	if err := botRepo.Create(ctx, &domain.Bot{
		ID: "bot-1", UserID: "u-v5", Title: "Radar Cobrança", Goal: "Cobrar", ThreadID: "bot_bot-1",
		Status: domain.TriggerStatusActive, Frequency: domain.FrequencyDailyMorning,
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := convRepo.GetOrCreateThread(ctx, "u-v5", "bot", "bot_bot-1"); err != nil {
		t.Fatal(err)
	}
	pend, err := confGate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:        "u-v5",
		ThreadID:      "bot_bot-1",
		Channel:       "bot",
		ToolsetName:   "task_and_pending_manager",
		Operation:     "create_todo",
		ArgumentsJSON: `{"title":"Pagar boleto"}`,
		PreviewJSON:   `{"summary":"Criar tarefa: Pagar boleto"}`,
	})
	if err != nil {
		t.Fatal(err)
	}

	yesterday := time.Now().UTC().Add(-24 * time.Hour)
	if err := todoRepo.Create(&domain.Todo{
		ID: "todo-late", UserID: "u-v5", Title: "Enviar NF", Status: domain.TodoStatusPending,
		Priority: "high", DueDate: &yesterday, CreatedAt: yesterday, UpdatedAt: yesterday,
	}); err != nil {
		t.Fatal(err)
	}

	items, counts, err := inboxSvc.ListNotifications(ctx, "u-v5", domain.NotificationInboxFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 || counts.Approve != 1 || counts.Alert != 1 {
		t.Fatalf("esperava 1 aprovação de bot + 1 alerta de tarefa atrasada, obteve items=%+v counts=%+v", items, counts)
	}

	var botNotifID, todoNotifID string
	for _, it := range items {
		if it.SourceDomain == "bots" {
			botNotifID = it.ID
		} else if it.SourceDomain == "tarefas" {
			todoNotifID = it.ID
		}
	}

	// Aprovar confirmação do bot via central de notificações.
	botRes, err := inboxSvc.ResolveAction(ctx, "u-v5", botNotifID, "approve", "")
	if err != nil {
		t.Fatalf("ResolveAction bot: %v", err)
	}
	if botRes.Status != "approved" {
		t.Fatalf("esperava approved, obteve %+v", botRes)
	}
	updatedPend, err := confGate.GetByID(ctx, pend.ID, "u-v5")
	if err != nil || updatedPend.Status != service.StatusResumed {
		t.Fatalf("esperava confirmação RESUMED, obteve %+v err=%v", updatedPend, err)
	}

	// Reagendar tarefas atrasadas para hoje via central.
	todoRes, err := inboxSvc.ResolveAction(ctx, "u-v5", todoNotifID, "reschedule_today", "")
	if err != nil {
		t.Fatalf("ResolveAction todo: %v", err)
	}
	if todoRes.Status != "rescheduled" || todoRes.RescheduledCount != 1 {
		t.Fatalf("esperava 1 tarefa reagendada, obteve %+v", todoRes)
	}
	reloadedTodo, err := todoRepo.GetByID("todo-late", "u-v5")
	if err != nil || reloadedTodo.DueDate == nil || !reloadedTodo.DueDate.After(time.Now().UTC().Add(-1*time.Hour)) {
		t.Fatalf("tarefa deveria ter sido reagendada para hoje, obteve %+v", reloadedTodo)
	}
}

func TestStoreComplianceService_BillingLGPDAndDeletion(t *testing.T) {
	db := setupV5ServiceDB(t)
	ctx := context.Background()

	storeRepo := repository.NewStoreComplianceRepository(db)
	svc := service.NewStoreComplianceService(storeRepo)

	// Trial de 7 dias + token da loja hasheado.
	sub, err := svc.UpsertSubscription(ctx, "u-v5", service.SubscriptionUpdateInput{
		Plan:         "pro",
		BillingCycle: "year",
		StoreToken:   "play-purchase-secret-token",
	})
	if err != nil {
		t.Fatal(err)
	}
	if sub.Plan != domain.PlanPro || sub.BillingCycle != domain.BillingCycleYear || !sub.HasStoreToken {
		t.Fatalf("assinatura inesperada: %+v", sub)
	}
	if sub.StoreTokenHash == "play-purchase-secret-token" || len(sub.StoreTokenHash) != 64 {
		t.Fatalf("store_token deveria ser armazenado em SHA-256 hex, obteve %q", sub.StoreTokenHash)
	}

	restored, _, err := svc.RestoreSubscription(ctx, "u-v5", "play-purchase-secret-token")
	if err != nil || !restored {
		t.Fatalf("esperava restauração bem-sucedida, obteve restored=%v err=%v", restored, err)
	}
	restoredWrong, _, err := svc.RestoreSubscription(ctx, "u-v5", "wrong-token")
	if err != nil || restoredWrong {
		t.Fatalf("esperava restored=false para token divergente, obteve %v", restoredWrong)
	}

	// Exclusão exige confirmação "EXCLUIR".
	if _, err := svc.ScheduleAccountDeletion(ctx, "u-v5", "apagar"); !errors.Is(err, domain.ErrInvalidDeleteConfirm) {
		t.Fatalf("esperava ErrInvalidDeleteConfirm, obteve %v", err)
	}
	delReq, err := svc.ScheduleAccountDeletion(ctx, "u-v5", " excluir ")
	if err != nil {
		t.Fatal(err)
	}
	if delReq.Kind != domain.ComplianceKindDeleteAccount || delReq.Status != "scheduled" || delReq.ScheduledFor == nil {
		t.Fatalf("agendamento inválido: %+v", delReq)
	}
	days := delReq.ScheduledFor.Sub(delReq.RequestedAt).Hours() / 24
	if days < 29.9 || days > 30.1 {
		t.Fatalf("esperava prazo de 30 dias, obteve %.2f dias", days)
	}

	// Exportação LGPD retorna dados sem password_hash.
	bundle, err := svc.ExportAccountJSON(ctx, "u-v5")
	if err != nil {
		t.Fatal(err)
	}
	if bundle.Kind != domain.ComplianceKindExportJSON || bundle.Data.User == nil || bundle.Data.User.PasswordHash != "" {
		t.Fatalf("bundle LGPD inválido: %+v", bundle)
	}
}
