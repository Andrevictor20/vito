package service

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// ReminderWorker monitora compromissos iminentes e despacha notificações push ativas.
type ReminderWorker struct {
	eventRepo     domain.EventRepository
	notifSvc      *NotificationService
	windowAhead   time.Duration
	checkInterval time.Duration
	stopCh        chan struct{}
	wg            sync.WaitGroup
	running       bool
	mu            sync.Mutex
}

// NewReminderWorker inicializa o worker de lembretes.
func NewReminderWorker(
	eventRepo domain.EventRepository,
	notifSvc *NotificationService,
	windowAhead time.Duration,
	checkInterval ...time.Duration,
) *ReminderWorker {
	interval := 1 * time.Minute
	if len(checkInterval) > 0 && checkInterval[0] > 0 {
		interval = checkInterval[0]
	}
	if windowAhead <= 0 {
		windowAhead = 15 * time.Minute
	}
	return &ReminderWorker{
		eventRepo:     eventRepo,
		notifSvc:      notifSvc,
		windowAhead:   windowAhead,
		checkInterval: interval,
		stopCh:        make(chan struct{}),
	}
}

// CheckAndDispatchReminders busca eventos que começam entre now e now + windowAhead e despacha push.
func (w *ReminderWorker) CheckAndDispatchReminders(now time.Time) (int, error) {
	from := now.UTC()
	to := now.Add(w.windowAhead).UTC()

	events, err := w.eventRepo.ListUpcomingUnreminded(from, to)
	if err != nil {
		return 0, fmt.Errorf("erro ao listar eventos para lembrete: %w", err)
	}

	dispatchedCount := 0
	for _, event := range events {
		emoji := GetNotificationContextEmoji(event.Title, event.Category)
		title := event.Title
		if emoji != "" {
			title = fmt.Sprintf("%s %s", emoji, event.Title)
		}
		timeStr := event.StartAt.Local().Format("15:04")
		body := fmt.Sprintf("Começa às %s", timeStr)
		if event.Location != "" {
			body += fmt.Sprintf(" em %s", event.Location)
		}

		priority := "default"

		data := map[string]interface{}{
			"eventId":  event.ID,
			"title":    event.Title,
			"start_at": event.StartAt.Format(time.RFC3339),
			"priority": priority,
		}

		sent, err := w.notifSvc.SendPushToUser(event.UserID, title, body, priority, data)
		if err != nil {
			log.Printf("[ReminderWorker] Erro ao enviar push para evento %s (user %s): %v", event.ID, event.UserID, err)
			continue
		}

		if sent > 0 {
			dispatchedCount++
		}

		// Marca como notificado mesmo se o usuário não possuir tokens ativos no momento
		if markErr := w.eventRepo.MarkReminderSent(event.ID, now); markErr != nil {
			log.Printf("[ReminderWorker] Erro ao marcar reminder_sent para evento %s: %v", event.ID, markErr)
		}
	}

	return dispatchedCount, nil
}

// Start inicia o loop em background.
func (w *ReminderWorker) Start() {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	w.mu.Unlock()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		ticker := time.NewTicker(w.checkInterval)
		defer ticker.Stop()

		log.Printf("🔔 [ReminderWorker] Iniciado com intervalo de %v e janela de %v.", w.checkInterval, w.windowAhead)

		// Executa imediatamente na inicialização
		if _, err := w.CheckAndDispatchReminders(time.Now()); err != nil {
			log.Printf("[ReminderWorker] Erro na verificação inicial: %v", err)
		}

		for {
			select {
			case <-w.stopCh:
				log.Println("🔔 [ReminderWorker] Encerrado.")
				return
			case t := <-ticker.C:
				if count, err := w.CheckAndDispatchReminders(t); err != nil {
					log.Printf("[ReminderWorker] Erro ao processar lembretes: %v", err)
				} else if count > 0 {
					log.Printf("🔔 [ReminderWorker] %d lembrete(s) despachado(s) com sucesso.", count)
				}
			}
		}
	}()
}

// Stop encerra o loop de background de forma graciosa.
func (w *ReminderWorker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	close(w.stopCh)
	w.mu.Unlock()

	w.wg.Wait()
}
