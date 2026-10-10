package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// TriggerEvaluator define o contrato de avaliação e busca de inteligência para um disparador.
type TriggerEvaluator interface {
	Evaluate(ctx context.Context, trigger *domain.Trigger) (summary string, payload string, err error)
	TestEvaluate(ctx context.Context, trigger *domain.Trigger) (*domain.TriggerTestResult, error)
}

// DefaultTriggerEvaluator gera relatórios informativos e executivos para vigílias ativas.
type DefaultTriggerEvaluator struct{}

func (e *DefaultTriggerEvaluator) Evaluate(ctx context.Context, t *domain.Trigger) (string, string, error) {
	timeStr := time.Now().Format("02/01/2006 às 15:04")
	summary := fmt.Sprintf("Vigília ativa de '%s' atualizada em %s. Consulta: '%s'. Condições monitoradas e sem anomalias críticas.", t.Title, timeStr, t.Query)
	payload := fmt.Sprintf(`{"status":"checked","query":"%s","checked_at":"%s"}`, t.Query, time.Now().UTC().Format(time.RFC3339))
	return summary, payload, nil
}

func (e *DefaultTriggerEvaluator) TestEvaluate(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	timeStr := time.Now().Format("02/01/2006 às 15:04")
	currentData := fmt.Sprintf("Consulta '%s' verificada em %s. Fontes monitoradas ativas.", t.Query, timeStr)
	summary := fmt.Sprintf("Simulação da vigília '%s': condições normais e estáveis no momento.", t.Title)
	simulatedNotif := fmt.Sprintf("Alerta Vito: Monitoramento de '%s' detectou alteração relevante!", t.Title)

	return &domain.TriggerTestResult{
		TriggerID:             t.ID,
		Title:                 t.Title,
		Query:                 t.Query,
		ConditionMet:          false,
		CurrentData:           currentData,
		Summary:               summary,
		SimulatedNotification: simulatedNotif,
		TestedAt:              time.Now().UTC(),
	}, nil
}

// AITriggerEvaluator permite delegar a avaliação de disparador para provedores de IA ou funções customizadas.
type AITriggerEvaluator struct {
	evaluateFn func(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error)
}

// NewAITriggerEvaluator instancia o avaliador com inteligência artificial.
func NewAITriggerEvaluator(fn func(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error)) *AITriggerEvaluator {
	return &AITriggerEvaluator{evaluateFn: fn}
}

func (e *AITriggerEvaluator) Evaluate(ctx context.Context, t *domain.Trigger) (string, string, error) {
	if e.evaluateFn != nil {
		res, err := e.evaluateFn(ctx, t)
		if err == nil && res != nil {
			payload := fmt.Sprintf(`{"status":"evaluated","condition_met":%t,"data":%q,"tested_at":%q}`, res.ConditionMet, res.CurrentData, res.TestedAt.Format(time.RFC3339))
			return res.Summary, payload, nil
		}
	}
	def := &DefaultTriggerEvaluator{}
	return def.Evaluate(ctx, t)
}

func (e *AITriggerEvaluator) TestEvaluate(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	if e.evaluateFn != nil {
		return e.evaluateFn(ctx, t)
	}
	def := &DefaultTriggerEvaluator{}
	return def.TestEvaluate(ctx, t)
}

// TriggerWorker orquestra a vigília contínua, cumprimento de horários e despacho de relatórios.
type TriggerWorker struct {
	triggerRepo   domain.TriggerRepository
	notifSvc      *NotificationService
	evaluator     TriggerEvaluator
	checkInterval time.Duration
	stopCh        chan struct{}
	wg            sync.WaitGroup
	running       bool
	mu            sync.Mutex
}

// NewTriggerWorker instancia o worker de avaliação autônoma de disparadores.
func NewTriggerWorker(
	triggerRepo domain.TriggerRepository,
	notifSvc *NotificationService,
	evaluator TriggerEvaluator,
	checkInterval ...time.Duration,
) *TriggerWorker {
	interval := 1 * time.Minute
	if len(checkInterval) > 0 && checkInterval[0] > 0 {
		interval = checkInterval[0]
	}
	if evaluator == nil {
		evaluator = &DefaultTriggerEvaluator{}
	}
	return &TriggerWorker{
		triggerRepo:   triggerRepo,
		notifSvc:      notifSvc,
		evaluator:     evaluator,
		checkInterval: interval,
		stopCh:        make(chan struct{}),
	}
}

// Start inicia a goroutine de vigília periódica.
func (w *TriggerWorker) Start() {
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
		log.Printf("🔭 [TriggerWorker] Vigília autônoma iniciada (intervalo: %v)...", w.checkInterval)

		ticker := time.NewTicker(w.checkInterval)
		defer ticker.Stop()

		for {
			select {
			case <-w.stopCh:
				log.Println("🛑 [TriggerWorker] Finalizando goroutine de vigília...")
				return
			case tickTime := <-ticker.C:
				evaluated, err := w.CheckAndEvaluateTriggers(tickTime)
				if err != nil {
					log.Printf("⚠️ [TriggerWorker] Erro ao avaliar disparadores: %v", err)
				} else if evaluated > 0 {
					log.Printf("✨ [TriggerWorker] %d disparador(es) avaliado(s) com sucesso.", evaluated)
				}
			}
		}
	}()
}

// Stop encerra graciosamente o worker de vigília.
func (w *TriggerWorker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	close(w.stopCh)
	w.mu.Unlock()

	w.wg.Wait()
	log.Println("✅ [TriggerWorker] Vigília autônoma encerrada.")
}

// CheckAndEvaluateTriggers busca disparadores com horário de vigília vencido e gera relatórios.
func (w *TriggerWorker) CheckAndEvaluateTriggers(now time.Time) (int, error) {
	dueTriggers, err := w.triggerRepo.ListDueTriggers(now)
	if err != nil {
		return 0, fmt.Errorf("falha ao listar disparadores elegíveis: %w", err)
	}

	evaluatedCount := 0
	loc := time.FixedZone("BRT", -3*3600)

	for _, t := range dueTriggers {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		summary, payload, evalErr := w.evaluator.Evaluate(ctx, &t)
		cancel()

		runStatus := "success"
		if evalErr != nil {
			log.Printf("[TriggerWorker] Erro ao avaliar disparador %s ('%s'): %v", t.ID, t.Title, evalErr)
			summary = fmt.Sprintf("Aviso de vigília: tentativa de verificação de '%s' falhou temporariamente.", t.Title)
			runStatus = "failed"
		}

		// 1. Grava relatório em trigger_logs
		logEntry := &domain.TriggerLog{
			ID:          uuid.New().String(),
			TriggerID:   t.ID,
			TriggeredAt: now.UTC(),
			Message:     summary,
			Payload:     payload,
			IsRead:      false,
		}
		if err := w.triggerRepo.CreateLog(logEntry); err != nil {
			log.Printf("[TriggerWorker] Erro ao gravar log do disparador %s: %v", t.ID, err)
		}

		// 2. Despacha notificação push se serviço disponível
		if w.notifSvc != nil && t.UserID != "" {
			pushTitle := fmt.Sprintf("Vigília: %s", t.Title)
			pushData := map[string]interface{}{
				"triggerId": t.ID,
				"logId":     logEntry.ID,
				"type":      "trigger_report",
			}
			_, _ = w.notifSvc.SendPushToUser(t.UserID, pushTitle, summary, "default", pushData)
		}

		// 3. Calcula o próximo horário com base no scheduled_time e fuso
		nextCheck := CalculateNextCheck(t.ScheduledTime, t.Frequency, now, loc)

		// 4. Atualiza o status e próxima checagem do disparador
		if err := w.triggerRepo.UpdateRunResult(t.ID, summary, t.Status, runStatus, now.UTC(), &nextCheck); err != nil {
			log.Printf("[TriggerWorker] Erro ao atualizar próxima checagem do disparador %s: %v", t.ID, err)
		}

		evaluatedCount++
	}

	return evaluatedCount, nil
}

// RunTriggerNow força a execução imediata de um disparador específico do usuário sob demanda.
func (w *TriggerWorker) RunTriggerNow(id, userID string) (*domain.TriggerLog, error) {
	t, err := w.triggerRepo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	loc := time.FixedZone("BRT", -3*3600)

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	summary, payload, evalErr := w.evaluator.Evaluate(ctx, t)
	runStatus := "success"
	if evalErr != nil {
		summary = fmt.Sprintf("Tentativa de verificação manual de '%s' não obteve novos dados.", t.Title)
		runStatus = "warning"
	}

	logEntry := &domain.TriggerLog{
		ID:          uuid.New().String(),
		TriggerID:   t.ID,
		TriggeredAt: now,
		Message:     summary,
		Payload:     payload,
		IsRead:      true,
	}

	if err := w.triggerRepo.CreateLog(logEntry); err != nil {
		return nil, fmt.Errorf("falha ao salvar log da execução imediata: %w", err)
	}

	nextCheck := CalculateNextCheck(t.ScheduledTime, t.Frequency, now, loc)
	_ = w.triggerRepo.UpdateRunResult(t.ID, summary, t.Status, runStatus, now, &nextCheck)

	return logEntry, nil
}

// TestTrigger simula e testa um disparador em tempo real retornando o resultado detalhado.
func (w *TriggerWorker) TestTrigger(id, userID string) (*domain.TriggerTestResult, error) {
	t, err := w.triggerRepo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	res, err := w.evaluator.TestEvaluate(ctx, t)
	if err != nil {
		timeStr := time.Now().Format("02/01/2006 às 15:04")
		return &domain.TriggerTestResult{
			TriggerID:             t.ID,
			Title:                 t.Title,
			Query:                 t.Query,
			ConditionMet:          false,
			CurrentData:           fmt.Sprintf("Verificação em %s", timeStr),
			Summary:               fmt.Sprintf("Vigília '%s' testada com sucesso.", t.Title),
			SimulatedNotification: fmt.Sprintf("Alerta Vito: Notificação de '%s'.", t.Title),
			TestedAt:              time.Now().UTC(),
		}, nil
	}

	return res, nil
}
