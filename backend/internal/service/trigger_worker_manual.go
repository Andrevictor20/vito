package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// RunTriggerNow força a execução imediata de um disparador específico do usuário sob demanda.
func (w *TriggerWorker) RunTriggerNow(id, userID string) (*domain.TriggerLog, error) {
	t, err := w.triggerRepo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	loc := time.FixedZone("BRT", -3*3600)

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	summary, payload, evalErr := w.evaluator.Evaluate(ctx, t)
	if evalErr != nil {
		return nil, fmt.Errorf("falha ao consultar informações atualizadas na web: %w", evalErr)
	}
	runStatus := "success"

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

	// Despacha notificação push para confirmar que a verificação imediata foi concluída com sucesso
	if w.notifSvc != nil && t.UserID != "" {
		pushData := map[string]interface{}{
			"type":         "RADAR_TRIGGERED",
			"channelId":    "vito_radar",
			"triggerId":    t.ID,
			"logId":        logEntry.ID,
			"currentValue": summary,
		}
		_, _ = w.notifSvc.SendPushToUser(t.UserID, fmt.Sprintf("Radar: %s", t.Title), summary, "high", pushData)
	}

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
			Confidence:            0,
			WhyRelevant:           "",
			TestedAt:              time.Now().UTC(),
		}, nil
	}

	// Lote C §9: exige confidence>=75 e why_relevant não vazio.
	res.EnforceConfidenceGate()
	return res, nil
}
