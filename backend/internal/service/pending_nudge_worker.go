package service

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// PendingNudgeWorker monitora pendências sem data agendada paradas há > 24h e envia nudges executivos.
type PendingNudgeWorker struct {
	pendingRepo   domain.PendingRepository
	userRepo      domain.UserRepository
	notifSvc      *NotificationService
	checkInterval time.Duration
	targetTime    string // ex: "17:30"
	stopCh        chan struct{}
	wg            sync.WaitGroup
	running       bool
	mu            sync.Mutex
	location      *time.Location
}

// NewPendingNudgeWorker instancia o worker de lembretes diários para pendências.
func NewPendingNudgeWorker(
	pendingRepo domain.PendingRepository,
	userRepo domain.UserRepository,
	notifSvc *NotificationService,
	checkInterval ...time.Duration,
) *PendingNudgeWorker {
	interval := 1 * time.Minute
	if len(checkInterval) > 0 && checkInterval[0] > 0 {
		interval = checkInterval[0]
	}

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.UTC
	}

	return &PendingNudgeWorker{
		pendingRepo:   pendingRepo,
		userRepo:      userRepo,
		notifSvc:      notifSvc,
		checkInterval: interval,
		targetTime:    "17:30",
		stopCh:        make(chan struct{}),
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
func FormatNudgeMessage(userName string, items []domain.PendingItem) (string, string) {
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

	if len(dueItems) == 0 {
		return 0, nil
	}

	// Agrupa pendências por usuário para evitar notificações repetidas
	userItemsMap := make(map[string][]domain.PendingItem)
	for _, item := range dueItems {
		userItemsMap[item.UserID] = append(userItemsMap[item.UserID], item)
	}

	dispatchedUsers := 0

	for userID, items := range userItemsMap {
		userName := "você"
		if w.userRepo != nil {
			if user, err := w.userRepo.GetByID(userID); err == nil && user != nil {
				userName = user.Name
			}
		}

		title, body := FormatNudgeMessage(userName, items)
		data := map[string]interface{}{
			"type":       "pending_nudge",
			"itemsCount": len(items),
		}

		sentCount, err := w.notifSvc.SendPushToUser(userID, title, body, "default", data)
		if err != nil {
			log.Printf("[PendingNudgeWorker] Erro ao enviar push de nudge para %s: %v", userID, err)
		} else if sentCount > 0 {
			dispatchedUsers++
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
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	w.stopCh = make(chan struct{})
	w.mu.Unlock()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		ticker := time.NewTicker(w.checkInterval)
		defer ticker.Stop()

		log.Printf("[PendingNudgeWorker] Iniciado com verificação a cada %v (Horário alvo: %s).", w.checkInterval, w.targetTime)

		for {
			select {
			case <-w.stopCh:
				log.Println("[PendingNudgeWorker] Encerrando worker...")
				return
			case tickTime := <-ticker.C:
				if _, err := w.ProcessNudges(tickTime); err != nil {
					log.Printf("[PendingNudgeWorker] Erro ao processar nudges: %v", err)
				}
			}
		}
	}()
}

// Stop encerra o worker com segurança.
func (w *PendingNudgeWorker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	close(w.stopCh)
	w.mu.Unlock()

	w.wg.Wait()
	log.Println("[PendingNudgeWorker] Parado com sucesso.")
}
