package calendar

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

// ReminderWorker monitora compromissos iminentes e despacha notificações push ativas.
type ReminderWorker struct {
	eventRepo       domain.EventRepository
	notifSvc        *service.NotificationService
	attentionBudget *service.AttentionBudgetService
	windowAhead     time.Duration
	checkInterval   time.Duration
	loop            *worker.PeriodicLoop
	mu              sync.Mutex
}

// SetAttentionBudget injeta o controlador de orçamento de atenção para silêncio contextual e deduplicação.
func (w *ReminderWorker) SetAttentionBudget(ab *service.AttentionBudgetService) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.attentionBudget = ab
}

func (w *ReminderWorker) getAttentionBudget() *service.AttentionBudgetService {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.attentionBudget
}

func buildReminderAttentionCandidate(event domain.Event, kind, title, body, urgency string, now time.Time) service.AttentionCandidate {
	category := "agenda"
	dedupKey := ""
	if kind == "start" {
		dedupKey = fmt.Sprintf("event_start:%s", event.ID)
	}
	return service.AttentionCandidate{
		UserID:       event.UserID,
		SourceWorker: "reminder_worker",
		Category:     category,
		Urgency:      urgency,
		DedupKey:     dedupKey,
		Title:        title,
		Body:         body,
		Now:          now,
	}
}

// NewReminderWorker inicializa o worker de lembretes.
func NewReminderWorker(
	eventRepo domain.EventRepository,
	notifSvc *service.NotificationService,
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
		loop:          worker.NewPeriodicLoop(interval, true),
	}
}

// IsAllDayEvent detecta se o evento representa um dia inteiro ou feriado civil (RFC 5545).
func IsAllDayEvent(event domain.Event) bool {
	// 1. Duração igual ou superior a 20 horas (cobre 24h, feriados, multi-dias e legados 03:00Z..23:59Z)
	diff := event.EndAt.Sub(event.StartAt)
	if diff >= 20*time.Hour {
		return true
	}
	// 2. Início explicitamente à meia-noite (UTC ou BRT 03:00Z) e fim próximo às 23:59
	if (event.StartAt.Hour() == 0 || event.StartAt.Hour() == 3) && event.StartAt.Minute() == 0 && event.StartAt.Second() == 0 &&
		event.EndAt.Hour() == 23 && event.EndAt.Minute() == 59 {
		return true
	}
	// 3. Categoria explícita de feriado
	if event.Category == "holiday" {
		return true
	}
	// 4. Reconhecimento contextual de feriados no título
	t := strings.ToLower(event.Title)
	if strings.Contains(t, "feriado") || strings.Contains(t, "nossa senhora") ||
		strings.Contains(t, "ano novo") || strings.Contains(t, "natal") ||
		strings.Contains(t, "páscoa") || strings.Contains(t, "pascoa") ||
		strings.Contains(t, "tiradentes") || strings.Contains(t, "carnaval") ||
		strings.Contains(t, "independência") || strings.Contains(t, "independencia") ||
		strings.Contains(t, "finados") || strings.Contains(t, "consciência negra") ||
		strings.Contains(t, "consciencia negra") || strings.Contains(t, "proclamação da república") ||
		strings.Contains(t, "proclamacao da republica") || strings.Contains(t, "dia das crianças") ||
		strings.Contains(t, "dia das criancas") {
		if diff >= 12*time.Hour || (event.StartAt.Minute() == 0 && (event.StartAt.Hour() == 0 || event.StartAt.Hour() == 21)) {
			return true
		}
	}
	return false
}

// CheckAndDispatchReminders busca eventos com alertas pendentes (antecedência e início) e despacha push.
func (w *ReminderWorker) CheckAndDispatchReminders(now time.Time) (int, error) {
	fromAdv := now.UTC()
	toAdv := now.Add(w.windowAhead).UTC()

	dispatchedCount := 0

	// 1. Lembretes de Antecedência ("Começa às HH:MM")
	advEvents, err := w.eventRepo.ListUpcomingUnreminded(fromAdv, toAdv)
	if err != nil {
		log.Printf("[ReminderWorker] Erro ao listar eventos para lembrete prévio: %v", err)
	} else {
		for _, event := range advEvents {
			// Eventos de dia inteiro e feriados não recebem alarme de contagem regressiva
			if IsAllDayEvent(event) {
				_ = w.eventRepo.MarkReminderSent(event.ID, now)
				continue
			}

			// Se o evento inicia em menos de 2 minutos, pula antecedência para priorizar o alerta de início exato
			if event.StartAt.Before(now.Add(2 * time.Minute)) {
				continue
			}

			emoji := service.GetNotificationContextEmoji(event.Title, event.Category)
			title := event.Title
			if emoji != "" {
				title = fmt.Sprintf("%s %s", emoji, event.Title)
			}
			timeStr := event.StartAt.In(timeutil.SaoPauloLocation()).Format("15:04")
			body := fmt.Sprintf("Começa às %s", timeStr)
			if event.Location != "" {
				body += fmt.Sprintf(" em %s", event.Location)
			}

			priority := "default"
			data := map[string]interface{}{
				"eventId":  event.ID,
				"type":     "advance",
				"title":    event.Title,
				"start_at": event.StartAt.Format(time.RFC3339),
				"priority": priority,
			}

			cand := buildReminderAttentionCandidate(event, "advance", title, body, "normal", now)
			allowed, dec := w.getAttentionBudget().ShouldDeliver(context.Background(), cand)
			if dec != nil && dec.Status == service.AttentionStatusDeferred {
				continue
			}
			if allowed && w.notifSvc != nil {
				sent, pushErr := w.notifSvc.SendPushToUser(event.UserID, title, body, priority, data)
				if pushErr != nil {
					log.Printf("[ReminderWorker] Erro ao enviar push de antecedência para evento %s (user %s): %v", event.ID, event.UserID, pushErr)
				} else if sent > 0 {
					dispatchedCount++
				}
			}

			// Marca como notificado mesmo se o usuário não possuir tokens ativos no momento
			if markErr := w.eventRepo.MarkReminderSent(event.ID, now); markErr != nil {
				log.Printf("[ReminderWorker] Erro ao marcar reminder_sent para evento %s: %v", event.ID, markErr)
			}
		}
	}

	// 2. Alertas no Horário Exato de Início ("Começando agora!")
	fromStart := now.Add(-2 * time.Minute).UTC()
	toStart := now.Add(1 * time.Minute).UTC()

	startEvents, err := w.eventRepo.ListStartingNowUnreminded(fromStart, toStart)
	if err != nil {
		log.Printf("[ReminderWorker] Erro ao listar eventos iniciando agora: %v", err)
	} else {
		for _, event := range startEvents {
			// Eventos de dia inteiro e feriados não recebem alarme de início imediato
			if IsAllDayEvent(event) {
				_ = w.eventRepo.MarkStartReminderSent(event.ID, now)
				continue
			}
			emoji := service.GetNotificationContextEmoji(event.Title, event.Category)
			title := event.Title
			if emoji != "" {
				title = fmt.Sprintf("%s %s", emoji, event.Title)
			}
			body := "Começando agora!"
			if event.Location != "" {
				body = fmt.Sprintf("Começando agora em %s!", event.Location)
			}

			priority := "urgent"
			data := map[string]interface{}{
				"eventId":  event.ID,
				"type":     "start",
				"title":    event.Title,
				"start_at": event.StartAt.Format(time.RFC3339),
				"priority": priority,
			}

			cand := buildReminderAttentionCandidate(event, "start", title, body, "high", now)
			allowed, dec := w.getAttentionBudget().ShouldDeliver(context.Background(), cand)
			if dec != nil && dec.Status == service.AttentionStatusDeferred {
				continue
			}
			if allowed && w.notifSvc != nil {
				sent, pushErr := w.notifSvc.SendPushToUser(event.UserID, title, body, priority, data)
				if pushErr != nil {
					log.Printf("[ReminderWorker] Erro ao enviar push de início para evento %s (user %s): %v", event.ID, event.UserID, pushErr)
				} else if sent > 0 {
					dispatchedCount++
				}
			}

			if markErr := w.eventRepo.MarkStartReminderSent(event.ID, now); markErr != nil {
				log.Printf("[ReminderWorker] Erro ao marcar start_reminder_sent para evento %s: %v", event.ID, markErr)
			}
		}
	}

	return dispatchedCount, nil
}

// Start inicia o loop em background.
func (w *ReminderWorker) Start() {
	if !w.loop.Start(func() {
		if count, err := w.CheckAndDispatchReminders(time.Now()); err != nil {
			log.Printf("[ReminderWorker] Erro ao processar lembretes: %v", err)
		} else if count > 0 {
			log.Printf("🔔 [ReminderWorker] %d lembrete(s) despachado(s) com sucesso.", count)
		}
	}) {
		return
	}
	log.Printf("🔔 [ReminderWorker] Iniciado com intervalo de %v e janela de %v.", w.checkInterval, w.windowAhead)
}

// Stop encerra o loop de background de forma graciosa.
func (w *ReminderWorker) Stop() {
	if !w.loop.IsRunning() {
		return
	}
	w.loop.Stop()
	log.Println("🔔 [ReminderWorker] Encerrado.")
}
