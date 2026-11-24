package bots_test

import (
	"context"
	"database/sql"
	"errors"
	"github.com/andrevmp/vito/backend/internal/bots"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/catalog"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type fakeBotRuntime struct {
	calls []bots.BotRuntimeRequest
	res   *bots.BotRuntimeResult
	err   error
}

func (f *fakeBotRuntime) EnsureBotSession(ctx context.Context, userID, botID, threadID string) (string, error) {
	if threadID != "" {
		return threadID, nil
	}
	return "bot_" + botID, nil
}

func (f *fakeBotRuntime) ExecuteBotTurn(ctx context.Context, req bots.BotRuntimeRequest) (*bots.BotRuntimeResult, error) {
	f.calls = append(f.calls, req)
	if f.err != nil {
		return nil, f.err
	}
	if f.res != nil {
		return f.res, nil
	}
	return &bots.BotRuntimeResult{
		Text:      `{"summary":"Tudo certo","should_notify":true,"verified":["fonte 1"],"did":[],"waiting":[],"cant":[]}`,
		ModelUsed: "gemini-2.5-flash",
	}, nil
}

type fakeBotPush struct {
	sent []string
}

func (p *fakeBotPush) SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error) {
	p.sent = append(p.sent, title+": "+body)
	return 1, nil
}

func openBotTestDB(t *testing.T) (*sql.DB, *bots.BotRepositorySQLite, *repository.ConversationStoreRepository, *catalog.Catalog) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "bots_service.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	now := time.Now().UTC()
	if _, err := db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('u1', 'Teste', 'u1@vito.app', 'hash', ?, ?)`, now, now); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	cat, err := catalog.LoadDefaultCatalog()
	if err != nil {
		t.Fatalf("LoadDefaultCatalog: %v", err)
	}
	return db, bots.NewBotRepository(db), repository.NewConversationStoreRepository(db), cat
}

func TestBotChatService_SeedAndMemoryIsolation_AC05(t *testing.T) {
	_, botRepo, convRepo, cat := openBotTestDB(t)
	ctx := context.Background()

	bot := &domain.Bot{
		ID:     "bot-voo-1",
		UserID: "u1",
		Title:  "Voo para o Rio",
		Goal:   "Acompanhar voos para o Rio",
		Status: domain.TriggerStatusActive,
		Actions: []domain.BotAction{
			{ActionKey: "search", Policy: domain.ActionPolicyAuto},
		},
		Skills: []domain.BotSkill{
			{SkillKey: "cmp", Version: 1},
		},
	}
	if err := botRepo.Create(ctx, bot); err != nil {
		t.Fatalf("botRepo.Create: %v", err)
	}

	rt := &fakeBotRuntime{
		res: &bots.BotRuntimeResult{
			Text:      "Anotado! Vou priorizar voos diretos pela manhã.",
			ModelUsed: "gemini-2.5-flash",
		},
	}
	chatSvc := bots.NewBotChatService(botRepo, nil, convRepo, cat, rt, nil)

	hist, err := chatSvc.GetHistory(ctx, "u1", bot.ID)
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if len(hist.Turns) == 0 || !strings.Contains(hist.Turns[0].Content, "Oi! Eu cuido de uma coisa só:") {
		t.Fatalf("esperava mensagem inicial semeada, obteve %+v", hist.Turns)
	}
	if len(hist.SuggestedChips) < 4 {
		t.Fatalf("esperava chips contextuais, obteve %+v", hist.SuggestedChips)
	}

	resp, err := chatSvc.SendMessage(ctx, "u1", bot.ID, "prefiro voos diretos pela manhã")
	if err != nil {
		t.Fatalf("SendMessage: %v", err)
	}
	if resp.Reply == "" || len(rt.calls) != 1 {
		t.Fatalf("esperava 1 chamada ao runtime e reply preenchido")
	}
	if len(rt.calls[0].ExtraTools) != 8 {
		t.Errorf("esperava 8 tools de auto-configuração no chat do bot, obteve %d", len(rt.calls[0].ExtraTools))
	}

	mems, err := botRepo.ListMemories(ctx, bot.ID, "u1")
	if err != nil {
		t.Fatalf("ListMemories: %v", err)
	}
	if len(mems) != 1 || !strings.Contains(mems[0].Content, "voos diretos") {
		t.Fatalf("AC-05: esperava memória isolada salva para o bot, obteve %+v", mems)
	}
}

func TestBotRunner_QuietSilent_AC06_And_Fatigue_AC08(t *testing.T) {
	db, botRepo, convRepo, cat := openBotTestDB(t)
	ctx := context.Background()
	push := &fakeBotPush{}
	rt := &fakeBotRuntime{}
	att := service.NewAttentionBudgetService(db, nil)

	bot := &domain.Bot{
		ID:                "bot-quiet-1",
		UserID:            "u1",
		Title:             "Monitor Silencioso",
		Goal:              "Checar novidades",
		Status:            domain.TriggerStatusActive,
		QuietOnlyOnChange: true,
		Actions: []domain.BotAction{
			{ActionKey: "search", Policy: domain.ActionPolicyAuto},
		},
	}
	if err := botRepo.Create(ctx, bot); err != nil {
		t.Fatalf("botRepo.Create: %v", err)
	}

	runner := bots.NewBotRunner(botRepo, nil, convRepo, cat, rt, push, att)
	runner.SetDeltaFetcher(func(ctx context.Context, b *domain.Bot) ([]string, []string, error) {
		return nil, []string{"h1"}, nil // sem novidade
	})

	// AC-06: quiet=1 + delta sem novidade -> 0 chamadas LLM, ok_silent, 0 push
	rep, err := runner.RunBot(ctx, "u1", bot.ID, false)
	if err != nil {
		t.Fatalf("RunBot quiet: %v", err)
	}
	if len(rt.calls) != 0 {
		t.Fatalf("AC-06 violado: esperava 0 chamadas LLM, obteve %d", len(rt.calls))
	}
	if rep.Summary != "Ficou em silêncio: nada novo" {
		t.Errorf("esperava resumo ok_silent, obteve %q", rep.Summary)
	}
	if len(push.sent) != 0 {
		t.Errorf("esperava 0 push em ok_silent, obteve %d", len(push.sent))
	}

	// AC-08: 5 falhas seguidas -> pausa automática + 1 alerta
	runner.SetDeltaFetcher(nil)
	rt.err = errors.New("timeout na fonte")
	for i := 0; i < 5; i++ {
		_, _ = runner.RunBot(ctx, "u1", bot.ID, true)
	}
	updated, err := botRepo.GetByID(ctx, bot.ID, "u1")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if updated.Status != domain.TriggerStatusPaused {
		t.Errorf("AC-08: esperava bot pausado após 5 falhas, obteve %s", updated.Status)
	}
	if len(push.sent) != 1 {
		t.Errorf("AC-08: esperava exatamente 1 notificação de fadiga, obteve %d", len(push.sent))
	}
}
