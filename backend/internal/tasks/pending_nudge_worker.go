package tasks

import (
	"context"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/platform/timeutil"
	"github.com/andrevmp/vito/backend/internal/platform/worker"
	"github.com/andrevmp/vito/backend/internal/service"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// PendingNudgeWorker monitora pendências sem data agendada paradas há > 24h e envia nudges executivos.
type PendingNudgeWorker struct {
	pendingRepo     domain.PendingRepository
	userRepo        domain.UserRepository
	notifSvc        *service.NotificationService
	attentionBudget *service.AttentionBudgetService
	checkInterval   time.Duration
	targetTime      string // ex: "17:30"
	loop            *worker.PeriodicLoop
	mu              sync.Mutex
	location        *time.Location
}

// SetAttentionBudget injeta o controlador de orçamento de atenção no worker de nudges.
func (w *PendingNudgeWorker) SetAttentionBudget(ab *service.AttentionBudgetService) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.attentionBudget = ab
}

func (w *PendingNudgeWorker) getAttentionBudget() *service.AttentionBudgetService {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.attentionBudget
}

// NewPendingNudgeWorker instancia o worker de lembretes diários para pendências.
func NewPendingNudgeWorker(
	pendingRepo domain.PendingRepository,
	userRepo domain.UserRepository,
	notifSvc *service.NotificationService,
	checkInterval ...time.Duration,
) *PendingNudgeWorker {
	interval := 1 * time.Minute
	if len(checkInterval) > 0 && checkInterval[0] > 0 {
		interval = checkInterval[0]
	}

	loc := timeutil.SaoPauloLocation()

	return &PendingNudgeWorker{
		pendingRepo:   pendingRepo,
		userRepo:      userRepo,
		notifSvc:      notifSvc,
		checkInterval: interval,
		targetTime:    "17:30",
		loop:          worker.NewPeriodicLoop(interval, false),
		location:      loc,
	}
}

// SetLocation customiza o timezone para testes.
func (w *PendingNudgeWorker) SetLocation(loc *time.Location) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.location = loc
}

// SetTargetTime customiza o horário do nudge diário (padrão 17:30).
func (w *PendingNudgeWorker) SetTargetTime(t string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.targetTime = t
}

// FormatNudgeMessage formata a notificação de incentivo a agendamento de pendências.
// scheduled informa quantas estão agendadas para hoje/atrasadas (digest inclui os dois grupos).
func FormatNudgeMessage(userName string, items []domain.PendingItem, scheduled int) (string, string) {
	firstName := strings.TrimSpace(userName)
	if parts := strings.Fields(firstName); len(parts) > 0 {
		firstName = parts[0]
	}
	if firstName == "" {
		firstName = "você"
	}

	title := "📥 Pendências"
	count := len(items)

	if count == 1 {
		return title, fmt.Sprintf("%s, você tem 1 pendência aguardando agendamento: '%s'. Que tal reservar um horário?", firstName, items[0].Title)
	}

	if scheduled > 0 {
		return title, fmt.Sprintf("%s, você tem %d pendências (%d agendada(s) para hoje ou atrasadas). Que tal revisar seu dia?", firstName, count, scheduled)
	}

	return title, fmt.Sprintf("%s, você tem %d pendências paradas há mais de 24h. Que tal agendar no seu dia?", firstName, count)
}

// ProcessNudges varre itens sem agendamento e despacha notificações consolidadas por usuário.
func (w *PendingNudgeWorker) ProcessNudges(now time.Time) (int, error) {
	w.mu.Lock()
	loc := w.location
	targetTime := w.targetTime
	w.mu.Unlock()

	userNow := now.In(loc)
	currentTimeStr := userNow.Format("15:04")

	// Se targetTime for especificado, só dispara naquele minuto
	if targetTime != "" && currentTimeStr != targetTime {
		return 0, nil
	}

	cutoff := now.UTC().Add(-24 * time.Hour)
	dueItems, err := w.pendingRepo.ListUnscheduledDueForNudge(cutoff)
	if err != nil {
		return 0, fmt.Errorf("falha ao listar pendências para nudge: %w", err)
	}

	// Digest inclui também agendadas para hoje/atrasadas sem nudge hoje.
	todayStr := userNow.Format("2006-01-02")
	scheduledDue, err := w.pendingRepo.ListScheduledDueForNudge(todayStr, now.UTC())
	if err != nil {
		return 0, fmt.Errorf("falha ao listar agendadas para nudge: %w", err)
	}

	// Agrupa pendências por usuário para evitar notificações repetidas
	userItemsMap := make(map[string][]domain.PendingItem)
	scheduledCount := make(map[string]int)
	for _, item := range dueItems {
		userItemsMap[item.UserID] = append(userItemsMap[item.UserID], item)
	}
	for _, item := range scheduledDue {
		userItemsMap[item.UserID] = append(userItemsMap[item.UserID], item)
		scheduledCount[item.UserID]++
	}

	dispatchedUsers := 0

	for userID, items := range userItemsMap {
		userName := "você"
		if w.userRepo != nil {
			if user, err := w.userRepo.GetByID(userID); err == nil && user != nil {
				userName = user.Name
			}
		}

		title, body := FormatNudgeMessage(userName, items, scheduledCount[userID])
		data := map[string]interface{}{
			"type":       "pending_nudge",
			"itemsCount": len(items),
		}

		cand := service.AttentionCandidate{
			UserID:       userID,
			SourceWorker: "pending_nudge_worker",
			Category:     "tarefas",
			Urgency:      "normal",
			DedupKey:     "pending_nudge:" + todayStr,
			Title:        title,
			Body:         body,
			Now:          now,
		}
		if allowed, _ := w.getAttentionBudget().ShouldDeliver(context.Background(), cand); allowed && w.notifSvc != nil {
			sentCount, err := w.notifSvc.SendPushToUser(userID, title, body, "default", data)
			if err != nil {
				log.Printf("[PendingNudgeWorker] Erro ao enviar push de nudge para %s: %v", userID, err)
			} else if sentCount > 0 {
				dispatchedUsers++
			}
		}

		// Marca todos os itens notificados com o timestamp de hoje
		for _, item := range items {
			_ = w.pendingRepo.MarkNudgeSent(item.ID, now.UTC())
		}
	}

	return dispatchedUsers, nil
}

// Start inicia o worker em background.
func (w *PendingNudgeWorker) Start() {
	if !w.loop.Start(func() {
		if _, err := w.ProcessNudges(time.Now()); err != nil {
			log.Printf("[PendingNudgeWorker] Erro ao processar nudges: %v", err)
		}
	}) {
		return
	}
	log.Printf("[PendingNudgeWorker] Iniciado com verificação a cada %v (Horário alvo: %s).", w.checkInterval, w.targetTime)
}

// Stop encerra o worker com segurança.
func (w *PendingNudgeWorker) Stop() {
	if !w.loop.IsRunning() {
		return
	}
	log.Println("[PendingNudgeWorker] Encerrando worker...")
	w.loop.Stop()
	log.Println("[PendingNudgeWorker] Parado com sucesso.")
}
