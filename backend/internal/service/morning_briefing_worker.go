package service

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// MorningBriefingWorker orquestra a geração e o despacho proativo do resumo matinal diário.
type MorningBriefingWorker struct {
	briefingRepo  domain.BriefingRepository
	eventRepo     domain.EventRepository
	todoRepo      domain.TodoRepository
	userRepo      domain.UserRepository
	notifSvc      *NotificationService
	checkInterval time.Duration
	stopCh        chan struct{}
	wg            sync.WaitGroup
	running       bool
	mu            sync.Mutex
	location      *time.Location
}

// NewMorningBriefingWorker cria uma nova instância do worker de briefing matinal.
func NewMorningBriefingWorker(
	briefingRepo domain.BriefingRepository,
	eventRepo domain.EventRepository,
	todoRepo domain.TodoRepository,
	userRepo domain.UserRepository,
	notifSvc *NotificationService,
	checkInterval ...time.Duration,
) *MorningBriefingWorker {
	interval := 1 * time.Minute
	if len(checkInterval) > 0 && checkInterval[0] > 0 {
		interval = checkInterval[0]
	}

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.UTC
	}

	return &MorningBriefingWorker{
		briefingRepo:  briefingRepo,
		eventRepo:     eventRepo,
		todoRepo:      todoRepo,
		userRepo:      userRepo,
		notifSvc:      notifSvc,
		checkInterval: interval,
		stopCh:        make(chan struct{}),
		location:      loc,
	}
}

// SetLocation permite customizar o fuso de referência para testes ou personalização.
func (w *MorningBriefingWorker) SetLocation(loc *time.Location) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.location = loc
}

// FormatBriefingMessage formata o título e o corpo da notificação de forma executiva, clara e amigável.
func FormatBriefingMessage(userName string, events []domain.Event, todos []domain.Todo, loc *time.Location) (string, string) {
	firstName := strings.TrimSpace(userName)
	if parts := strings.Fields(firstName); len(parts) > 0 {
		firstName = parts[0]
	}
	if firstName == "" {
		firstName = "você"
	}

	title := fmt.Sprintf("☀️ Bom dia, %s!", firstName)

	if len(events) == 0 && len(todos) == 0 {
		return title, "Sua agenda está livre hoje e você está sem pendências. Aproveite o seu dia!"
	}

	var sb strings.Builder

	if len(events) > 0 {
		if len(events) == 1 {
			sb.WriteString("Você tem 1 compromisso hoje.")
		} else {
			sb.WriteString(fmt.Sprintf("Você tem %d compromissos hoje.", len(events)))
		}

		firstEvent := events[0]
		startTimeStr := firstEvent.StartAt.In(loc).Format("15:04")
		sb.WriteString(fmt.Sprintf(" O primeiro é '%s' às %s.", firstEvent.Title, startTimeStr))
	} else {
		sb.WriteString("Sem compromissos agendados para hoje.")
	}

	if len(todos) > 0 {
		if len(events) > 0 {
			sb.WriteString(" ")
		}
		if len(todos) == 1 {
			sb.WriteString("1 tarefa pendente.")
		} else {
			sb.WriteString(fmt.Sprintf("%d tarefas pendentes.", len(todos)))
		}
	}

	return title, sb.String()
}

// ProcessBriefings verifica e despacha os briefings programados para o momento atual.
func (w *MorningBriefingWorker) ProcessBriefings(now time.Time) (int, error) {
	w.mu.Lock()
	loc := w.location
	w.mu.Unlock()

	userNow := now.In(loc)
	currentTimeStr := userNow.Format("15:04")
	currentDateStr := userNow.Format("2006-01-02")

	activeSettings, err := w.briefingRepo.ListActiveSettings()
	if err != nil {
		return 0, fmt.Errorf("falha ao listar configurações de briefing ativas: %w", err)
	}

	dispatched := 0

	for _, s := range activeSettings {
		// Checa se o horário atual bate com o horário programado e se ainda não foi enviado hoje
		if s.ScheduledTime != currentTimeStr || s.LastSentDate == currentDateStr {
			continue
		}

		// Intervalo do dia local em UTC para consulta de eventos
		startOfDay := time.Date(userNow.Year(), userNow.Month(), userNow.Day(), 0, 0, 0, 0, loc).UTC()
		endOfDay := time.Date(userNow.Year(), userNow.Month(), userNow.Day(), 23, 59, 59, 999999999, loc).UTC()

		events, err := w.eventRepo.ListByUser(s.UserID, startOfDay, endOfDay)
		if err != nil {
			log.Printf("[MorningBriefingWorker] Erro ao listar eventos do usuário %s: %v", s.UserID, err)
			continue
		}

		todos, err := w.todoRepo.ListByUser(s.UserID, domain.TodoStatusPending)
		if err != nil {
			log.Printf("[MorningBriefingWorker] Erro ao listar tarefas do usuário %s: %v", s.UserID, err)
			continue
		}

		userName := "usuário"
		if user, err := w.userRepo.GetByID(s.UserID); err == nil && user != nil {
			userName = user.Name
		}

		title, body := FormatBriefingMessage(userName, events, todos, loc)

		priority := "default"
		// Se configurado alarme antecipado e o primeiro evento ocorrer em até 45 minutos do briefing
		if s.WakeupAlarmEarly && len(events) > 0 {
			firstStart := events[0].StartAt.In(loc)
			diff := firstStart.Sub(userNow)
			if diff > 0 && diff <= 45*time.Minute {
				priority = "wakeup"
			}
		}

		data := map[string]interface{}{
			"type":      "morning_briefing",
			"date":      currentDateStr,
			"eventsCount": len(events),
			"todosCount":  len(todos),
		}

		sentCount, err := w.notifSvc.SendPushToUser(s.UserID, title, body, priority, data)
		if err != nil {
			log.Printf("[MorningBriefingWorker] Erro ao despachar push para %s: %v", s.UserID, err)
		} else if sentCount > 0 {
			dispatched++
		}

		// Marca como enviado no dia corrente para garantir idempotência estrita
		if err := w.briefingRepo.MarkSent(s.UserID, currentDateStr); err != nil {
			log.Printf("[MorningBriefingWorker] Falha ao marcar envio de briefing para %s: %v", s.UserID, err)
		}
	}

	return dispatched, nil
}

// Start inicia o loop de monitoramento em background.
func (w *MorningBriefingWorker) Start() {
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

		log.Printf("[MorningBriefingWorker] Iniciado com verificação a cada %v.", w.checkInterval)

		for {
			select {
			case <-w.stopCh:
				log.Println("[MorningBriefingWorker] Encerrando worker...")
				return
			case tickTime := <-ticker.C:
				if _, err := w.ProcessBriefings(tickTime); err != nil {
					log.Printf("[MorningBriefingWorker] Erro ao processar briefings: %v", err)
				}
			}
		}
	}()
}

// Stop finaliza a execução do worker de forma suave.
func (w *MorningBriefingWorker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	close(w.stopCh)
	w.mu.Unlock()

	w.wg.Wait()
	log.Println("[MorningBriefingWorker] Parado com sucesso.")
}
