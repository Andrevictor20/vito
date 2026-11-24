package bots

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/service"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/catalog"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

const (
	botRunnerTimeout     = 45 * time.Second
	botRunnerMaxSteps    = 5
	botRunnerMaxParallel = 2
	botFatigueThreshold  = 5
	botSilentSummary     = "Ficou em silêncio: nada novo"
)

// BotRunner executa bots autônomos sobre o motor Google ADK v2 e implementa TriggerEvaluator (Plano 04 Fase 3).
type BotRunner struct {
	botRepo         *BotRepositorySQLite
	triggerRepo     domain.TriggerRepository
	convRepo        *repository.ConversationStoreRepository
	catalog         *catalog.Catalog
	runtime         BotADKRuntime
	notifSvc        PushDispatcher
	attentionBudget *service.AttentionBudgetService
	sem             chan struct{}
	deltaFetcher    func(ctx context.Context, b *domain.Bot) (fresh []string, all []string, err error)
	priceFetcher    func(ctx context.Context, b *domain.Bot) (value float64, display string, ok bool, err error)
	appChecker      func(ctx context.Context, userID string) map[string]bool
}

// NewBotRunner instancia o executor autônomo de Bots com semáforo de concorrência = 2.
func NewBotRunner(
	botRepo *BotRepositorySQLite,
	triggerRepo domain.TriggerRepository,
	convRepo *repository.ConversationStoreRepository,
	cat *catalog.Catalog,
	runtime BotADKRuntime,
	notifSvc PushDispatcher,
	attentionBudget *service.AttentionBudgetService,
) *BotRunner {
	return &BotRunner{
		botRepo:         botRepo,
		triggerRepo:     triggerRepo,
		convRepo:        convRepo,
		catalog:         cat,
		runtime:         runtime,
		notifSvc:        notifSvc,
		attentionBudget: attentionBudget,
		sem:             make(chan struct{}, botRunnerMaxParallel),
	}
}

// SetDeltaFetcher configura o portão determinístico de novidade pré-LLM (AC-06).
func (r *BotRunner) SetDeltaFetcher(fn func(ctx context.Context, b *domain.Bot) (fresh []string, all []string, err error)) {
	r.deltaFetcher = fn
}

// SetPriceFetcher configura o fast-path determinístico de preço-alvo pré-LLM.
func (r *BotRunner) SetPriceFetcher(fn func(ctx context.Context, b *domain.Bot) (value float64, display string, ok bool, err error)) {
	r.priceFetcher = fn
}

// SetAppConnectionChecker configura o verificador de apps conectados para popular `locked` (AC-07).
func (r *BotRunner) SetAppConnectionChecker(fn func(ctx context.Context, userID string) map[string]bool) {
	r.appChecker = fn
}

// Evaluate implementa TriggerEvaluator para integração transparente com TriggerWorker.
func (r *BotRunner) Evaluate(ctx context.Context, t *domain.Trigger) (string, string, error) {
	if t == nil {
		return "", "", fmt.Errorf("trigger nulo")
	}
	rep, err := r.RunBot(ctx, t.UserID, t.ID, false)
	if err != nil {
		return "", "", err
	}
	payloadBytes, _ := json.Marshal(rep)
	return rep.Summary, string(payloadBytes), nil
}

// TestEvaluate implementa TriggerEvaluator para testes síncronos sob demanda.
func (r *BotRunner) TestEvaluate(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	if t == nil {
		return nil, fmt.Errorf("trigger nulo")
	}
	rep, err := r.RunBot(ctx, t.UserID, t.ID, true)
	if err != nil {
		return nil, err
	}
	return &domain.TriggerTestResult{
		TriggerID:    t.ID,
		Title:        t.Title,
		Query:        t.Query,
		ConditionMet: rep.ShouldNotify,
		Summary:      rep.Summary,
		Confidence:   90,
		WhyRelevant:  rep.Summary,
		TestedAt:     time.Now().UTC(),
	}, nil
}

// RunBot executa um Bot (manual = "Executar agora" ou agendado) respeitando semáforo, timeout 45s,
// portão determinístico (AC-06), Firing Frame, ok_silent, service.AttentionBudgetService e fadiga de 5 falhas (AC-08).
func (r *BotRunner) RunBot(ctx context.Context, userID, botID string, manual bool) (*domain.BotRunReport, error) {
	bot, err := r.botRepo.GetByID(ctx, botID, userID)
	if err != nil {
		return nil, err
	}

	// Portão determinístico pré-LLM (0 tokens) quando execução é agendada
	if !manual {
		if handled, rep := r.runDeterministicGates(ctx, bot); handled {
			r.recordRunOutcome(ctx, bot, rep, manual)
			return rep, nil
		}
	}

	select {
	case r.sem <- struct{}{}:
		defer func() { <-r.sem }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	runCtx, cancel := context.WithTimeout(ctx, botRunnerTimeout)
	defer cancel()

	if r.runtime == nil {
		return nil, fmt.Errorf("BotADKRuntime não configurado no BotRunner")
	}

	threadID := strings.TrimSpace(bot.ThreadID)
	if threadID == "" {
		threadID = "bot_" + bot.ID
	}
	_, _ = r.runtime.EnsureBotSession(runCtx, userID, bot.ID, threadID)

	skillsMD, allowedKeys, policies, connected, locked := r.buildExecutionInputs(bot)
	firingFrame := "EXECUÇÃO DE ROTINA AGENDADA: este bot está disparando agora. Execute as ações permitidas para cumprir sua função. NÃO crie, pause ou edite a configuração do bot nesta execução."
	if manual {
		firingFrame = "EXECUÇÃO MANUAL SOB DEMANDA: execute as ações permitidas para cumprir sua função agora. Ações que alteram algo continuam pedindo aprovação."
	}

	res, runErr := r.runtime.ExecuteBotTurn(runCtx, BotRuntimeRequest{
		UserID:            userID,
		Bot:               bot,
		ThreadID:          threadID,
		Channel:           "bot",
		Prompt:            fmt.Sprintf("Execute sua função agora: %s", bot.Goal),
		FiringFrame:       firingFrame,
		SkillsMarkdown:    skillsMD,
		ConnectedActions:  connected,
		LockedActions:     locked,
		AllowedActionKeys: allowedKeys,
		ActionPolicies:    policies,
		MaxLLMCalls:       botRunnerMaxSteps,
	})
	if runErr != nil {
		r.handleRunFailure(ctx, bot, runErr)
		return nil, runErr
	}

	report := parseBotRunReport(res)
	if bot.ConsecutiveFailures > 0 {
		bot.ConsecutiveFailures = 0
		_ = r.botRepo.Update(ctx, bot)
	}

	r.recordRunOutcome(ctx, bot, report, manual)
	return report, nil
}

func (r *BotRunner) runDeterministicGates(ctx context.Context, bot *domain.Bot) (bool, *domain.BotRunReport) {
	if r.priceFetcher != nil && (bot.ConditionType == string(domain.ConditionPriceAbove) || bot.ConditionType == string(domain.ConditionPriceBelow)) {
		target, ok := ParseMoneyValue(bot.TargetValue)
		if ok {
			val, display, fetchedOK, err := r.priceFetcher(ctx, bot)
			if err == nil && fetchedOK {
				met := PriceConditionMet(domain.TriggerConditionType(bot.ConditionType), target, val)
				if !met && bot.QuietOnlyOnChange {
					return true, &domain.BotRunReport{
						Summary:      botSilentSummary,
						Verified:     []string{fmt.Sprintf("Preço verificado: %s (alvo: %s)", display, bot.TargetValue)},
						ShouldNotify: false,
					}
				}
				if met {
					return true, &domain.BotRunReport{
						Summary:      fmt.Sprintf("Preço atingido: %s (alvo: %s)", display, bot.TargetValue),
						Verified:     []string{fmt.Sprintf("Preço atual: %s", display)},
						ShouldNotify: true,
					}
				}
			}
		}
	}

	if r.deltaFetcher != nil && bot.QuietOnlyOnChange {
		fresh, all, err := r.deltaFetcher(ctx, bot)
		if err == nil && len(fresh) == 0 {
			if r.triggerRepo != nil && len(all) > 0 {
				_ = r.triggerRepo.SetSeenHashes(bot.ID, all)
			}
			return true, &domain.BotRunReport{
				Summary:      botSilentSummary,
				Verified:     []string{"Nenhuma novidade desde a última checagem"},
				ShouldNotify: false,
			}
		}
	}
	return false, nil
}

func (r *BotRunner) handleRunFailure(ctx context.Context, bot *domain.Bot, runErr error) {
	bot.ConsecutiveFailures++
	bot.LastError = runErr.Error()
	bot.LastRunStatus = "failed"
	if bot.ConsecutiveFailures >= botFatigueThreshold {
		bot.Status = domain.TriggerStatusPaused
		if r.notifSvc != nil && bot.UserID != "" {
			_, _ = r.notifSvc.SendPushToUser(
				bot.UserID,
				fmt.Sprintf("Bot pausado: %s", bot.Title),
				fmt.Sprintf("O bot '%s' falhou %d vezes seguidas e foi pausado automaticamente.", bot.Title, bot.ConsecutiveFailures),
				"normal",
				map[string]any{"type": "BOT_PAUSED", "bot_id": bot.ID},
			)
		}
	}
	_ = r.botRepo.Update(ctx, bot)
}

func (r *BotRunner) recordRunOutcome(ctx context.Context, bot *domain.Bot, rep *domain.BotRunReport, manual bool) {
	now := time.Now().UTC()
	isSilent := bot.QuietOnlyOnChange && !rep.ShouldNotify && len(rep.Waiting) == 0 && !manual
	if isSilent {
		rep.Summary = botSilentSummary
	}

	payloadBytes, _ := json.Marshal(rep)
	if r.triggerRepo != nil {
		_ = r.triggerRepo.CreateLog(&domain.TriggerLog{
			ID:          uuid.NewString(),
			TriggerID:   bot.ID,
			TriggeredAt: now,
			Message:     rep.Summary,
			Payload:     string(payloadBytes),
			IsRead:      isSilent,
		})
	}
	if isSilent {
		return
	}

	threadID := strings.TrimSpace(bot.ThreadID)
	if threadID == "" {
		threadID = "bot_" + bot.ID
	}
	if r.convRepo != nil {
		_, _ = r.convRepo.GetOrCreateThread(ctx, bot.UserID, "bot", threadID)
		_ = r.convRepo.AddTurn(ctx, repository.ConversationTurn{
			ID:         uuid.NewString(),
			ThreadID:   threadID,
			UserID:     bot.UserID,
			Channel:    "bot",
			Role:       "assistant",
			Origin:     "proactive_worker",
			WorkerType: "bot_routine",
			Content:    rep.Summary,
			ModelUsed:  rep.ModelUsed,
			CreatedAt:  now,
		})
	}

	if r.notifSvc != nil && bot.UserID != "" {
		deliver := true
		if r.attentionBudget != nil {
			deliver, _ = r.attentionBudget.ShouldDeliver(ctx, service.AttentionCandidate{
				UserID:       bot.UserID,
				SourceWorker: "bot_runner",
				Category:     "bots",
				Urgency:      "normal",
				DedupKey:     "bot:" + bot.ID + ":" + now.Format("2006-01-02-15"),
				Title:        bot.Title,
				Body:         rep.Summary,
				Now:          now,
			})
		}
		if deliver {
			_, _ = r.notifSvc.SendPushToUser(
				bot.UserID,
				bot.Title,
				rep.Summary,
				"default",
				map[string]any{
					"type":      "BOT_RUN",
					"bot_id":    bot.ID,
					"deep_link": "/bots/" + bot.ID + "/chat",
				},
			)
		}
	}
}

func (r *BotRunner) buildExecutionInputs(bot *domain.Bot) (
	skillsMD []string,
	allowedKeys []string,
	policies map[string]domain.ActionPolicy,
	connected []string,
	locked []string,
) {
	var connApps map[string]bool
	if r.appChecker != nil && bot != nil {
		connApps = r.appChecker(context.Background(), bot.UserID)
	}
	policies = make(map[string]domain.ActionPolicy, len(bot.Actions))
	for _, a := range bot.Actions {
		policies[a.ActionKey] = a.Policy
		if a.Policy == domain.ActionPolicyOff {
			continue
		}
		if spec, ok := domain.ActionCatalog[a.ActionKey]; ok && spec.AppKey != "" && connApps != nil {
			if isConnected, known := connApps[spec.AppKey]; known && !isConnected {
				locked = append(locked, fmt.Sprintf("%s (app '%s' desconectado)", a.ActionKey, spec.AppKey))
				continue
			}
		}
		allowedKeys = append(allowedKeys, a.ActionKey)
		connected = append(connected, fmt.Sprintf("%s (%s)", a.ActionKey, a.Policy))
	}
	if r.catalog != nil {
		for _, bs := range bot.Skills {
			if sk, ok := r.catalog.Skill(bs.SkillKey); ok {
				skillsMD = append(skillsMD, fmt.Sprintf("### %s\nQuando usar: %s\nPassos:\n- %s\nContrato: %s",
					sk.Name, sk.When, strings.Join(sk.Steps, "\n- "), sk.OutputContract))
			}
		}
	}
	return
}

func parseBotRunReport(res *BotRuntimeResult) *domain.BotRunReport {
	rep := &domain.BotRunReport{
		Verified: []string{},
		Did:      []string{},
		Waiting:  []string{},
		Cant:     []string{},
	}
	if res == nil {
		return rep
	}
	rep.ModelUsed = res.ModelUsed
	rep.PendingConfirmationIDs = res.PendingIDs
	if res.RequiresConfirmation && res.Text != "" {
		rep.Waiting = append(rep.Waiting, res.Text)
	}

	raw := strings.TrimSpace(res.Text)
	if strings.HasPrefix(raw, "{") {
		if err := json.Unmarshal([]byte(raw), rep); err == nil {
			rep.ModelUsed = res.ModelUsed
			if len(res.PendingIDs) > 0 && len(rep.PendingConfirmationIDs) == 0 {
				rep.PendingConfirmationIDs = res.PendingIDs
			}
			return rep
		}
	}
	rep.Summary = raw
	if rep.Summary == "" {
		rep.Summary = "Execução concluída."
	}
	rep.ShouldNotify = len(rep.Waiting) > 0 || raw != ""
	return rep
}
