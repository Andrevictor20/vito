package service

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// TodoReminderWorker monitora tarefas pendentes com prazo iminente e despacha notificações push.
type TodoReminderWorker struct {
	todoRepo      domain.TodoRepository
	notifSvc      *NotificationService
	windowAhead   time.Duration
	checkInterval time.Duration
	stopCh        chan struct{}
	wg            sync.WaitGroup
	running       bool
	mu            sync.Mutex
}

// NewTodoReminderWorker instancia o worker de lembretes para tarefas.
func NewTodoReminderWorker(
	todoRepo domain.TodoRepository,
	notifSvc *NotificationService,
	windowAhead time.Duration,
	checkInterval ...time.Duration,
) *TodoReminderWorker {
	interval := 1 * time.Minute
	if len(checkInterval) > 0 && checkInterval[0] > 0 {
		interval = checkInterval[0]
	}
	if windowAhead <= 0 {
		windowAhead = 15 * time.Minute
	}
	return &TodoReminderWorker{
		todoRepo:      todoRepo,
		notifSvc:      notifSvc,
		windowAhead:   windowAhead,
		checkInterval: interval,
		stopCh:        make(chan struct{}),
	}
}

// CheckAndDispatchReminders busca tarefas elegíveis (antecedência e prazo imediato) e envia push.
func (w *TodoReminderWorker) CheckAndDispatchReminders(now time.Time) (int, error) {
	fromAdv := now.UTC()
	toAdv := now.Add(w.windowAhead).UTC()

	dispatchedCount := 0

	// 1. Lembretes de Antecedência para Tarefas ("Prazo às HH:MM")
	advTodos, err := w.todoRepo.ListUpcomingUnreminded(fromAdv, toAdv)
	if err != nil {
		log.Printf("[TodoReminderWorker] Erro ao listar tarefas para lembrete prévio: %v", err)
	} else {
		for _, todo := range advTodos {
			// Se a tarefa vence em menos de 2 minutos, pula antecedência para evitar notificação dupla
			if todo.DueDate != nil && todo.DueDate.Before(now.Add(2*time.Minute)) {
				continue
			}

			emoji := GetNotificationContextEmoji(todo.Title, "todo")
			title := todo.Title
			if emoji != "" {
				title = fmt.Sprintf("%s %s", emoji, todo.Title)
			} else {
				title = fmt.Sprintf("✓ %s", todo.Title)
			}

			timeStr := ""
			if todo.DueDate != nil {
				timeStr = todo.DueDate.In(defaultReminderLocation()).Format("15:04")
			}
			body := "Prazo se aproximando"
			if timeStr != "" {
				body = fmt.Sprintf("Prazo às %s", timeStr)
			}

			priority := "default"
			if todo.Priority == "high" {
				priority = "urgent"
			}

			data := map[string]interface{}{
				"todoId":    todo.ID,
				"type":      "todo_reminder",
				"title":     todo.Title,
				"priority":  priority,
				"channelId": "vito_todos",
			}

			sent, pushErr := w.notifSvc.SendPushToUser(todo.UserID, title, body, priority, data)
			if pushErr != nil {
				log.Printf("[TodoReminderWorker] Erro ao enviar push para tarefa %s (user %s): %v", todo.ID, todo.UserID, pushErr)
			} else if sent > 0 {
				dispatchedCount++
			}

			if markErr := w.todoRepo.MarkReminderSent(todo.ID, now); markErr != nil {
				log.Printf("[TodoReminderWorker] Erro ao marcar reminder_sent para tarefa %s: %v", todo.ID, markErr)
			}
		}
	}

	// 2. Alertas no Prazo Exato ("Prazo da tarefa atingido!")
	fromStart := now.Add(-2 * time.Minute).UTC()
	toStart := now.Add(1 * time.Minute).UTC()

	dueTodos, err := w.todoRepo.ListDueNowUnreminded(fromStart, toStart)
	if err != nil {
		log.Printf("[TodoReminderWorker] Erro ao listar tarefas com prazo atingido: %v", err)
	} else {
		for _, todo := range dueTodos {
			title := fmt.Sprintf("⏰ Prazo da Tarefa: %s", todo.Title)
			body := "O horário estipulado para esta tarefa chegou."

			data := map[string]interface{}{
				"todoId":    todo.ID,
				"type":      "todo_due",
				"title":     todo.Title,
				"priority":  "urgent",
				"channelId": "vito_todos",
			}

			sent, pushErr := w.notifSvc.SendPushToUser(todo.UserID, title, body, "urgent", data)
			if pushErr != nil {
				log.Printf("[TodoReminderWorker] Erro ao enviar push de prazo para tarefa %s (user %s): %v", todo.ID, todo.UserID, pushErr)
			} else if sent > 0 {
				dispatchedCount++
			}

			if markErr := w.todoRepo.MarkDueReminderSent(todo.ID, now); markErr != nil {
				log.Printf("[TodoReminderWorker] Erro ao marcar start_reminder_sent para tarefa %s: %v", todo.ID, markErr)
			}
		}
	}

	return dispatchedCount, nil
}

// Start inicia a rotina em background.
func (w *TodoReminderWorker) Start() {
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

		log.Printf("✓ [TodoReminderWorker] Monitoramento de tarefas iniciado (intervalo: %v, janela: %v).", w.checkInterval, w.windowAhead)

		// Executa na inicialização
		if _, err := w.CheckAndDispatchReminders(time.Now()); err != nil {
			log.Printf("[TodoReminderWorker] Erro na verificação inicial: %v", err)
		}

		for {
			select {
			case <-w.stopCh:
				log.Println("✓ [TodoReminderWorker] Encerrado.")
				return
			case t := <-ticker.C:
				if count, err := w.CheckAndDispatchReminders(t); err != nil {
					log.Printf("[TodoReminderWorker] Erro ao processar lembretes: %v", err)
				} else if count > 0 {
					log.Printf("✓ [TodoReminderWorker] %d lembrete(s) de tarefa despachado(s).", count)
				}
			}
		}
	}()
}

// Stop finaliza graciosamente a execução do worker.
func (w *TodoReminderWorker) Stop() {
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
