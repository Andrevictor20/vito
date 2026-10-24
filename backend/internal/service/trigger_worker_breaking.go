package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// BreakingNewsCooldown define o intervalo mínimo entre alertas breaking consecutivos de um mesmo radar.
const BreakingNewsCooldown = 30 * time.Minute

// CheckBreakingTriggers vigia fatos urgentes/breaking fora do horário regular agendado (Ponto 5).
// Avalia disparadores ativos cuja checagem diária ainda não venceu; se houver novos fatos com
// urgência "breaking" ou "high", dispara alerta imediato sem esperar o próximo horário da grade.
func (w *TriggerWorker) CheckBreakingTriggers(now time.Time) (int, error) {
	if w.deltaFetcher == nil {
		return 0, nil
	}

	activeTriggers, err := w.triggerRepo.ListActive()
	if err != nil {
		return 0, fmt.Errorf("falha ao listar vigílias ativas para checagem breaking: %w", err)
	}

	breakingCount := 0

	for _, t := range activeTriggers {
		// Se a próxima checagem regular já está próxima (menos de 2 minutos) ou vencida,
		// deixa o fluxo regular do CheckAndEvaluateTriggers processar.
		if t.NextCheckAt == nil || t.NextCheckAt.Before(now.Add(2*time.Minute)) {
			continue
		}

		// Checa cooldown para não disparar push em rajada se houver múltiplos fatos novos no mesmo evento
		lastNotified, errNotif := w.triggerRepo.GetLastNotifiedAt(t.ID)
		if errNotif == nil && PriceNotifyCooldownActive(lastNotified, now, BreakingNewsCooldown) {
			continue
		}

		fetchCtx, fetchCancel := context.WithTimeout(context.Background(), 12*time.Second)
		fresh, all, fetchErr := w.deltaFetcher(fetchCtx, &t)
		fetchCancel()

		if fetchErr != nil || len(fresh) == 0 {
			continue
		}

		// Novos fatos detectados fora do horário agendado: avalia se há urgência
		evalCtx, evalCancel := context.WithTimeout(context.Background(), 20*time.Second)
		summary, payload, evalErr := w.evaluator.Evaluate(evalCtx, &t)
		evalCancel()

		if evalErr != nil {
			continue
		}

		sig := parseEvalSignal(payload)

		// Se o evento for urgente/breaking, aciona o push imediato fora do horário regular
		if sig.urgent {
			logEntry := &domain.TriggerLog{
				ID:          uuid.New().String(),
				TriggerID:   t.ID,
				TriggeredAt: now.UTC(),
				Message:     summary,
				Payload:     payload,
				IsRead:      false,
			}
			if err := w.triggerRepo.CreateLog(logEntry); err != nil {
				log.Printf("[TriggerWorker] Erro ao gravar log breaking do disparador %s: %v", t.ID, err)
			}

			if w.notifSvc != nil && t.UserID != "" {
				pushTitle := fmt.Sprintf("🚨 URGENTE: %s", t.Title)
				pushData := map[string]interface{}{
					"type":         "RADAR_TRIGGERED",
					"channelId":    "vito_radar",
					"triggerId":    t.ID,
					"logId":        logEntry.ID,
					"currentValue": summary,
					"urgency":      "breaking",
					"is_breaking":  true,
				}
				_, _ = w.notifSvc.SendPushToUser(t.UserID, pushTitle, summary, "urgent", pushData)
			}

			_ = w.triggerRepo.UpdateLastNotifiedAt(t.ID, now.UTC())
			_ = w.triggerRepo.SetSeenHashes(t.ID, all)
			breakingCount++
		} else {
			// Fato novo comum/rotineiro: marca hashes como vistos para não repetir na próxima checagem rápida,
			// deixando o resumo formal para o horário regular agendado pelo usuário.
			_ = w.triggerRepo.SetSeenHashes(t.ID, all)
		}
	}

	return breakingCount, nil
}
