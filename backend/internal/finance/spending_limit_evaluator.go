package finance

import (
	"context"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/service"
	"slices"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// FinancePushNotifier envia push notifications financeiras pelo canal padrão (sem alarme crítico).
type FinancePushNotifier interface {
	SendFinanceAlert(ctx context.Context, userID, title, body, deepLink string) error
}

// FinanceWhatsAppSelfNotifier envia alertas financeiros opt-in estritamente ao chat pessoal (self) do dono.
type FinanceWhatsAppSelfNotifier interface {
	SendSelfFinanceAlert(ctx context.Context, userID, message string) error
}

// SpendingLimitEvaluator avalia limites multi-escopo em SQL/Go pós-sync com deduplicação por ciclo.
type SpendingLimitEvaluator struct {
	limitRepo FinanceLimitRepository
	attention *service.AttentionBudgetService
	push      FinancePushNotifier
	waSelf    FinanceWhatsAppSelfNotifier
}

// NewSpendingLimitEvaluator instancia o avaliador determinístico de limites.
func NewSpendingLimitEvaluator(
	limitRepo FinanceLimitRepository,
	attention *service.AttentionBudgetService,
) *SpendingLimitEvaluator {
	return &SpendingLimitEvaluator{
		limitRepo: limitRepo,
		attention: attention,
	}
}

// SetAttentionBudget injeta o controlador de orçamento de atenção após o boot.
func (e *SpendingLimitEvaluator) SetAttentionBudget(att *service.AttentionBudgetService) {
	e.attention = att
}

// SetNotifiers configura os canais opcionais de entrega Push e WhatsApp (self).
func (e *SpendingLimitEvaluator) SetNotifiers(push FinancePushNotifier, waSelf FinanceWhatsAppSelfNotifier) {
	e.push = push
	e.waSelf = waSelf
}

// EvaluateUserLimits avalia todos os limites ativos do usuário e despacha alertas inéditos no ciclo.
func (e *SpendingLimitEvaluator) EvaluateUserLimits(ctx context.Context, userID string, now time.Time) ([]domain.FinanceLimitAlertEvent, error) {
	if now.IsZero() {
		now = time.Now().UTC()
	}
	rules, err := e.limitRepo.ListLimits(ctx, userID, "")
	if err != nil {
		return nil, err
	}

	var fired []domain.FinanceLimitAlertEvent
	for _, rule := range rules {
		if !rule.IsActive || rule.ScopeType == domain.LimitScopeSavingsGoal || rule.TargetAmount <= 0 {
			continue
		}
		if rule.MutedUntil != nil && rule.MutedUntil.After(now) {
			continue
		}

		status, err := e.limitRepo.ComputeLimitStatus(ctx, userID, rule, now)
		if err != nil {
			continue
		}

		// 1. Patamares configurados (ex.: 80, 100)
		for _, thr := range rule.AlertThresholds {
			if status.PercentUsed < float64(thr) {
				continue
			}
			ev, ok := e.tryFire(ctx, userID, status, "THRESHOLD", thr, now)
			if ok {
				fired = append(fired, ev)
			}
		}

		// 2. Degrau progressivo após 100% (ex.: 110, 120)
		if rule.RepeatOverStepPct > 0 && status.PercentUsed > 100 {
			over := int(status.PercentUsed) - 100
			step := (over / rule.RepeatOverStepPct) * rule.RepeatOverStepPct
			if step > 0 {
				thr := 100 + step
				ev, ok := e.tryFire(ctx, userID, status, "OVER_STEP", thr, now)
				if ok {
					fired = append(fired, ev)
				}
			}
		}

		// 3. Alerta preditivo de ritmo acelerado
		if rule.PaceAlertEnabled && status.StatusLabel == "PACE_RISK" {
			ev, ok := e.tryFire(ctx, userID, status, "PACE_PROJECTION", 100, now)
			if ok {
				fired = append(fired, ev)
			}
		}
	}
	return fired, nil
}

func (e *SpendingLimitEvaluator) tryFire(
	ctx context.Context,
	userID string,
	status *domain.FinanceLimitStatus,
	triggerKind string,
	threshold int,
	now time.Time,
) (domain.FinanceLimitAlertEvent, bool) {
	ev := domain.FinanceLimitAlertEvent{
		UserID:           userID,
		LimitID:          status.Rule.ID,
		PeriodKey:        status.PeriodKey,
		TriggerKind:      triggerKind,
		ThresholdPercent: threshold,
		SpentAmount:      status.SpentAmount,
		TargetAmount:     status.Rule.TargetAmount,
		NotifiedChannels: status.Rule.NotifyChannels,
		CreatedAt:        now,
	}

	inserted, err := e.limitRepo.RecordLimitAlertEvent(ctx, &ev)
	if err != nil || !inserted {
		return domain.FinanceLimitAlertEvent{}, false
	}

	urgency := "high"
	if threshold >= 100 && triggerKind != "PACE_PROJECTION" {
		urgency = "critical"
	}

	title := fmt.Sprintf("Limite %s em %.0f%%", status.Rule.Title, status.PercentUsed)
	body := fmt.Sprintf(
		"Você já gastou R$ %.2f de R$ %.2f neste ciclo (restam R$ %.2f).",
		status.SpentAmount, status.Rule.TargetAmount, status.RemainingAmount,
	)
	if triggerKind == "PACE_PROJECTION" {
		title = fmt.Sprintf("Ritmo acelerado: %s", status.Rule.Title)
		body = fmt.Sprintf(
			"Nesse ritmo, você deve fechar o ciclo em R$ %.2f (teto R$ %.2f).",
			status.ProjectedAmount, status.Rule.TargetAmount,
		)
	} else if status.PercentUsed >= 100 {
		title = fmt.Sprintf("Limite ultrapassado: %s", status.Rule.Title)
	}

	dedupKey := fmt.Sprintf("limit_alert:%s:%s:%s:%d", status.Rule.ID, status.PeriodKey, triggerKind, threshold)
	deliver, _ := e.attention.ShouldDeliver(ctx, service.AttentionCandidate{
		UserID:       userID,
		SourceWorker: "finance_trigger",
		Category:     "financas",
		Urgency:      urgency,
		DedupKey:     dedupKey,
		Title:        title,
		Body:         body,
		Now:          now,
	})

	if deliver {
		if e.push != nil && slices.Contains(status.Rule.NotifyChannels, "push") {
			_ = e.push.SendFinanceAlert(ctx, userID, title, body, "vito://finance/limits/"+status.Rule.ID)
		}
		if e.waSelf != nil && slices.Contains(status.Rule.NotifyChannels, "whatsapp") {
			_ = e.waSelf.SendSelfFinanceAlert(ctx, userID, fmt.Sprintf("*%s*\n%s", title, body))
		}
	}

	return ev, true
}
