package service_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type spyBotADKRuntime struct {
	called     bool
	lastLocked []string
}

func (s *spyBotADKRuntime) ExecuteBotTurn(_ context.Context, req service.BotRuntimeRequest) (*service.BotRuntimeResult, error) {
	s.called = true
	s.lastLocked = req.LockedActions
	return &service.BotRuntimeResult{
		Text: `{"status":"ok_silent","summary":"Nada novo"}`,
	}, nil
}

func (s *spyBotADKRuntime) EnsureBotSession(_ context.Context, _, botID, threadID string) (string, error) {
	if threadID != "" {
		return threadID, nil
	}
	return "bot_" + botID, nil
}

func TestAC06_ScheduledTriggerRunsViaADKBotRunner(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "ac06.db"))
	if err != nil {
		t.Fatalf("erro ao abrir db: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	userID := "user-ac06"
	botID := "bot-ac06"
	_ = repository.NewUserRepository(db).Create(&domain.User{
		ID: userID, Name: "AC06", Email: "ac06@vito.local", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	})

	botRepo := repository.NewBotRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	if err := botRepo.Create(ctx, &domain.Bot{
		ID: botID, UserID: userID, Title: "Bot Agendado", Goal: "Checar WhatsApp", Query: "Checar WhatsApp",
		Status: domain.TriggerStatusActive, Frequency: domain.FrequencyDailyMorning, Category: "custom",
		ConditionType: string(domain.ConditionChangeDetected),
		Actions: []domain.BotAction{
			{ID: "act-1", BotID: botID, UserID: userID, ActionKey: "waread", Policy: domain.ActionPolicyAuto},
		},
	}); err != nil {
		t.Fatalf("botRepo.Create falhou: %v", err)
	}

	rt := &spyBotADKRuntime{}
	runner := service.NewBotRunner(botRepo, triggerRepo, nil, nil, rt, nil, nil)
	runner.SetAppConnectionChecker(func(_ context.Context, _ string) map[string]bool {
		return map[string]bool{"wa": false}
	})

	worker := service.NewTriggerWorker(triggerRepo, nil, &service.DefaultTriggerEvaluator{}, time.Minute)
	worker.SetEvaluator(runner)

	summary, payload, err := runner.Evaluate(ctx, &domain.Trigger{ID: botID, UserID: userID})
	if err != nil {
		t.Fatalf("BotRunner.Evaluate falhou: %v", err)
	}
	if !rt.called || summary == "" || payload == "" {
		t.Fatalf("esperava execução via BotADKRuntime, called=%v summary=%q", rt.called, summary)
	}

	bot, _ := botRepo.GetByID(ctx, botID, userID)
	chatSvc := service.NewBotChatService(botRepo, triggerRepo, nil, nil, rt, runner)
	_, err = chatSvc.SendMessage(ctx, userID, bot.ID, "olá")
	if err != nil {
		t.Fatalf("SendMessage falhou: %v", err)
	}
	if len(rt.lastLocked) == 0 {
		t.Fatalf("esperava 'locked' populado quando whatsapp está desconectado")
	}
}
