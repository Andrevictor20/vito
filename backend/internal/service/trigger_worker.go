package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
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

// PushDispatcher desacopla o envio de push do worker (testabilidade).
type PushDispatcher interface {
	SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error)
}

// evalSignal carrega o gate anti-spam + urgência do payload (Fases 0 e 2).
type evalSignal struct {
	hasGate    bool
	met        bool
	confidence int
	urgent     bool
}

// parseEvalSignal interpreta o payload de avaliação.
// Sem campos de gate (legado/default), met=true e o comportamento atual é mantido.
func parseEvalSignal(payload string) evalSignal {
	sig := evalSignal{met: true}
	var raw struct {
		ConditionMet *bool  `json:"condition_met"`
		Confidence   *int   `json:"confidence"`
		Urgency      string `json:"urgency"`
	}
	if err := json.Unmarshal([]byte(payload), &raw); err != nil {
		return sig
	}
	if raw.ConditionMet == nil && raw.Confidence == nil {
		return sig
	}
	sig.hasGate = true
	if raw.ConditionMet != nil {
		sig.met = *raw.ConditionMet
	}
	if raw.Confidence != nil {
		sig.confidence = *raw.Confidence
	}
	sig.urgent = strings.EqualFold(strings.TrimSpace(raw.Urgency), "high")
	return sig
}

func (s evalSignal) allowsNotify() bool {
	if !s.hasGate {
		return true
	}
	if s.urgent {
		return true
	}
	if !s.met {
		return false
	}
	return s.confidence >= domain.MinTriggerConfidence
}

// DefaultTriggerEvaluator gera relatórios informativos e executivos para vigílias ativas.
type DefaultTriggerEvaluator struct{}

func (e *DefaultTriggerEvaluator) Evaluate(ctx context.Context, t *domain.Trigger) (string, string, error) {
	timeStr := time.Now().Format("02/01/2006 às 15:04")
	summary := fmt.Sprintf("Pesquisa inicial agendada para '%s' em %s.", t.Title, timeStr)
	payload := fmt.Sprintf(`{"status":"pending","query":"%s","data":"Aguardando sincronização de notícias em tempo real.","checked_at":"%s"}`, t.Query, time.Now().UTC().Format(time.RFC3339))
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
		Confidence:            90,
		WhyRelevant:           "Avaliação padrão sem IA: monitoramento ativo e fontes disponíveis; nenhuma condição relevante detectada no momento.",
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
		if err != nil {
			return "", "", err
		}
		if res != nil {
			payloadObj := map[string]interface{}{
				"status":                 "evaluated",
				"condition_met":          res.ConditionMet,
				"data":                   res.CurrentData,
				"paragraphs":             res.Paragraphs,
				"simulated_notification": res.SimulatedNotification,
				"confidence":             res.Confidence,
				"why_relevant":           res.WhyRelevant,
				"urgency":                res.Urgency,
				"tested_at":              res.TestedAt.Format(time.RFC3339),
			}
			payloadBytes, errMarshal := json.Marshal(payloadObj)
			if errMarshal == nil {
				return res.Summary, string(payloadBytes), nil
			}
			return res.Summary, `{"status":"evaluated"}`, nil
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
	notifSvc      PushDispatcher
	evaluator     TriggerEvaluator
	checkInterval time.Duration
	stopCh        chan struct{}
	wg            sync.WaitGroup
	running       bool
	mu            sync.Mutex
	// deltaFetcher retorna os hashes dos fatos atuais; nil desliga o delta gate.
	// Na volta: (hashesNovos, todosHashes, erro).
	deltaFetcher func(ctx context.Context, t *domain.Trigger) (fresh []string, all []string, err error)
	// priceFetcher retorna o valor numérico atual da fonte (ex: bid AwesomeAPI);
	// nil desliga o fast-path determinístico de preço-alvo (Fase 1).
	// Na volta: (valor, exibição, ok, erro). ok=false cai no fluxo IA.
	priceFetcher func(ctx context.Context, t *domain.Trigger) (value float64, display string, ok bool, err error)
}

// SetPriceFetcher instala o fast-path determinístico de preço-alvo (Fase 1).
func (w *TriggerWorker) SetPriceFetcher(fn func(ctx context.Context, t *domain.Trigger) (float64, string, bool, error)) {
	w.priceFetcher = fn
}

// SetDeltaFetcher instala o portão de deduplicação pré-IA (§9.3).
func (w *TriggerWorker) SetDeltaFetcher(fn func(ctx context.Context, t *domain.Trigger) (fresh []string, all []string, err error)) {
	w.deltaFetcher = fn
}

// NewTriggerWorker instancia o worker de avaliação autônoma de disparadores.
func NewTriggerWorker(
	triggerRepo domain.TriggerRepository,
	notifSvc PushDispatcher,
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

// checkPriceFastPath avalia price_above/price_below de forma determinística
// contra o valor numérico da fonte (Fase 1). Retorna (handled, notified):
// handled=true dispensa o fluxo IA; notified=true conta como avaliado.
// Sem número no alvo ou na fonte, devolve handled=false (cai na IA).
func (w *TriggerWorker) checkPriceFastPath(ctx context.Context, now time.Time, t *domain.Trigger, loc *time.Location) (bool, bool) {
	if w.priceFetcher == nil {
		return false, false
	}
	if t.ConditionType != domain.ConditionPriceAbove && t.ConditionType != domain.ConditionPriceBelow {
		return false, false
	}
	target, ok := ParseMoneyValue(t.TargetValue)
	if !ok {
		return false, false
	}
	current, display, ok, err := w.priceFetcher(ctx, t)
	if err != nil || !ok {
		return false, false
	}
	nextCheck := CalculateNextCheck(t.ScheduledTime, t.Frequency, now, loc)
	advanceSilent := func() {
		_ = w.triggerRepo.UpdateRunResult(t.ID, t.CurrentValue, t.Status, "skipped", now.UTC(), &nextCheck)
	}
	if !PriceConditionMet(t.ConditionType, target, current) {
		advanceSilent()
		return true, false
	}
	last, err := w.triggerRepo.GetLastNotifiedAt(t.ID)
	if err != nil {
		log.Printf("[TriggerWorker] Aviso ao ler cooldown do disparador %s: %v", t.ID, err)
	}
	if PriceNotifyCooldownActive(last, now, PriceNotifyCooldown) {
		advanceSilent()
		return true, false
	}
	direction := "atingiu ou ficou abaixo de"
	if t.ConditionType == domain.ConditionPriceAbove {
		direction = "atingiu ou superou"
	}
	summary := fmt.Sprintf("Preço atingido: %s %s o alvo %s.", display, direction, t.TargetValue)
	logEntry := &domain.TriggerLog{
		ID:          uuid.New().String(),
		TriggerID:   t.ID,
		TriggeredAt: now.UTC(),
		Message:     summary,
		Payload:     fmt.Sprintf(`{"status":"price_hit","condition_met":true,"confidence":100,"target":"%s","current":"%s"}`, t.TargetValue, display),
		IsRead:      false,
	}
	if err := w.triggerRepo.CreateLog(logEntry); err != nil {
		log.Printf("[TriggerWorker] Erro ao gravar log de preço do disparador %s: %v", t.ID, err)
	}
	if w.notifSvc != nil && t.UserID != "" {
		pushData := map[string]interface{}{
			"type":         "RADAR_TRIGGERED",
			"triggerId":    t.ID,
			"logId":        logEntry.ID,
			"currentValue": summary,
			"urgency":      "price_target",
		}
		_, _ = w.notifSvc.SendPushToUser(t.UserID, fmt.Sprintf("Preço atingido: %s", t.Title), summary, "urgent", pushData)
	}
	_ = w.triggerRepo.UpdateLastNotifiedAt(t.ID, now.UTC())
	_ = w.triggerRepo.UpdateRunResult(t.ID, summary, t.Status, "success", now.UTC(), &nextCheck)
	return true, true
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
		// Fast-path determinístico de preço-alvo (Fase 1): sem custo de IA.
		if handled, notified := w.checkPriceFastPath(ctx, now, &t, loc); handled {
			cancel()
			if notified {
				evaluatedCount++
			}
			continue
		}
		// Portão de deduplicação pré-IA: sem fatos novos, só atualiza a
		// próxima checagem — economiza a chamada de IA (§9.3).
		if w.deltaFetcher != nil {
			fetchCtx, fetchCancel := context.WithTimeout(context.Background(), 15*time.Second)
			fresh, all, fetchErr := w.deltaFetcher(fetchCtx, &t)
			fetchCancel()
			if fetchErr == nil {
				if len(fresh) == 0 {
					nextCheck := CalculateNextCheck(t.ScheduledTime, t.Frequency, now, loc)
					_ = w.triggerRepo.UpdateRunResult(t.ID, t.CurrentValue, t.Status, "skipped", now.UTC(), &nextCheck)
					cancel()
					continue
				}
				_ = w.triggerRepo.SetSeenHashes(t.ID, all)
			}
		}
		summary, payload, evalErr := w.evaluator.Evaluate(ctx, &t)
		cancel()

		runStatus := "success"
		if evalErr != nil {
			log.Printf("[TriggerWorker] Erro ao avaliar disparador %s ('%s'): %v", t.ID, t.Title, evalErr)
			summary = fmt.Sprintf("Aviso: Não foi possível obter novas notícias para '%s' no momento devido a uma oscilação na busca.", t.Title)
			payload = fmt.Sprintf(`{"status":"failed","query":"%s","data":"Oscilação temporária ao coletar notícias da web.","checked_at":"%s"}`, t.Query, time.Now().UTC().Format(time.RFC3339))
			runStatus = "failed"
			// Persiste o erro para visibilidade honesta no app (bug §8.7/11).
			_ = w.triggerRepo.UpdateLastError(t.ID, evalErr.Error())
		} else {
			_ = w.triggerRepo.UpdateLastError(t.ID, "")
		}

		// Portão anti-spam (Fase 0): condição falsa ou confiança baixa não
		// geram log visível nem push — só avançam a próxima checagem.
		sig := parseEvalSignal(payload)
		if evalErr == nil && !sig.allowsNotify() {
			nextCheck := CalculateNextCheck(t.ScheduledTime, t.Frequency, now, loc)
			_ = w.triggerRepo.UpdateRunResult(t.ID, t.CurrentValue, t.Status, "skipped", now.UTC(), &nextCheck)
			continue
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

		// 2. Despacha notificação push se serviço disponível.
		// Falhas de avaliação geram log + badge, mas nunca push (anti-spam).
		// Urgência alta (Fase 2) usa o canal urgente com som.
		if evalErr == nil && w.notifSvc != nil && t.UserID != "" {
			pushTitle := fmt.Sprintf("Radar: %s", t.Title)
			pushData := map[string]interface{}{
				"type":         "RADAR_TRIGGERED",
				"channelId":    "vito_radar",
				"triggerId":    t.ID,
				"logId":        logEntry.ID,
				"currentValue": summary,
			}
			priority := "default"
			if sig.urgent {
				priority = "urgent"
			}
			_, _ = w.notifSvc.SendPushToUser(t.UserID, pushTitle, summary, priority, pushData)
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
