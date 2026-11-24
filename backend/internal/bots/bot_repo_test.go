package bots

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/catalog"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
)

func setupBotTestDB(t *testing.T) (*BotRepositorySQLite, string) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "bots_repo.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })

	now := time.Now().UTC()
	userID := "user-bot-1"
	if _, err := db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, 'Teste', 'teste@vito.app', 'hash', ?, ?)`, userID, now, now); err != nil {
		t.Fatal(err)
	}
	return NewBotRepository(db), userID
}

func TestBotRepo_AlwaysAskNeverBecomesAuto_AC03(t *testing.T) {
	repo, userID := setupBotTestDB(t)
	ctx := context.Background()

	bot := &domain.Bot{
		ID:       "bot-1",
		UserID:   userID,
		Title:    "Mensagens",
		Goal:     "Acompanhar pendências",
		Category: "Comunicação",
		Status:   domain.TriggerStatusActive,
	}
	if err := repo.Create(ctx, bot); err != nil {
		t.Fatal(err)
	}

	err := repo.UpsertAction(ctx, &domain.BotAction{
		ID:        "act-wasend",
		BotID:     bot.ID,
		UserID:    userID,
		ActionKey: "wasend",
		Policy:    domain.ActionPolicyAuto,
	})
	if !errors.Is(err, domain.ErrAlwaysAskPolicyViolation) {
		t.Fatalf("esperava ErrAlwaysAskPolicyViolation, obtido: %v", err)
	}

	if err := repo.UpsertAction(ctx, &domain.BotAction{
		ID:        "act-wasend",
		BotID:     bot.ID,
		UserID:    userID,
		ActionKey: "wasend",
		Policy:    domain.ActionPolicyAsk,
	}); err != nil {
		t.Fatalf("wasend=ask deveria persistir: %v", err)
	}

	err = repo.UpdateActionPolicy(ctx, bot.ID, userID, "wasend", domain.ActionPolicyAuto)
	if !errors.Is(err, domain.ErrAlwaysAskPolicyViolation) {
		t.Fatalf("UpdateActionPolicy para wasend=auto deveria falhar com ErrAlwaysAskPolicyViolation, obtido: %v", err)
	}
}

func TestBotRepo_AttachAndRemoveSkill_AC10(t *testing.T) {
	repo, userID := setupBotTestDB(t)
	ctx := context.Background()
	cat, err := catalog.LoadDefaultCatalog()
	if err != nil {
		t.Fatal(err)
	}

	bot := &domain.Bot{
		ID:       "bot-2",
		UserID:   userID,
		Title:    "Contas",
		Goal:     "Organizar faturas",
		Category: "Contas",
		Status:   domain.TriggerStatusActive,
	}
	if err := repo.Create(ctx, bot); err != nil {
		t.Fatal(err)
	}

	inv, ok := cat.Skill("inv")
	if !ok {
		t.Fatal("habilidade inv não encontrada")
	}
	if err := repo.AttachSkill(ctx, bot.ID, userID, inv); err != nil {
		t.Fatalf("AttachSkill(inv) falhou: %v", err)
	}

	actions, err := repo.ListActions(ctx, bot.ID, userID)
	if err != nil {
		t.Fatal(err)
	}
	gotPol := map[string]domain.ActionPolicy{}
	for _, a := range actions {
		gotPol[a.ActionKey] = a.Policy
	}
	if gotPol["mailr"] != domain.ActionPolicyAuto || gotPol["task"] != domain.ActionPolicyAsk {
		t.Fatalf("esperava mailr=auto e task=ask após anexar inv, obtido: %+v", gotPol)
	}

	// Usuário promove task para auto; anexar outra habilidade com task NÃO deve sobrescrever
	if err := repo.UpdateActionPolicy(ctx, bot.ID, userID, "task", domain.ActionPolicyAuto); err != nil {
		t.Fatal(err)
	}
	tri, ok := cat.Skill("tri")
	if !ok {
		t.Fatal("habilidade tri não encontrada")
	}
	if err := repo.AttachSkill(ctx, bot.ID, userID, tri); err != nil {
		t.Fatalf("AttachSkill(tri) falhou: %v", err)
	}
	actions, err = repo.ListActions(ctx, bot.ID, userID)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range actions {
		if a.ActionKey == "task" && a.Policy != domain.ActionPolicyAuto {
			t.Fatalf("task deveria permanecer auto ao anexar nova habilidade, obtido: %s", a.Policy)
		}
	}

	// Remover habilidade inv preserva bot_actions
	if err := repo.RemoveSkill(ctx, bot.ID, userID, "inv"); err != nil {
		t.Fatalf("RemoveSkill(inv) falhou: %v", err)
	}
	skills, err := repo.ListSkills(ctx, bot.ID, userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(skills) != 1 || skills[0].SkillKey != "tri" {
		t.Fatalf("esperava apenas tri em bot_skills após remover inv, obtido: %+v", skills)
	}
	actionsAfter, err := repo.ListActions(ctx, bot.ID, userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(actionsAfter) != 3 { // mailr, task, omail
		t.Fatalf("esperava 3 ações preservadas após remover inv, obtido: %+v", actionsAfter)
	}
}

func TestBotRepo_SkillUpgradeCheck_AC11(t *testing.T) {
	repo, userID := setupBotTestDB(t)
	ctx := context.Background()

	bot := &domain.Bot{
		ID:       "bot-3",
		UserID:   userID,
		Title:    "Voos",
		Goal:     "Acompanhar voos",
		Category: "Viagens",
		Status:   domain.TriggerStatusActive,
	}
	if err := repo.Create(ctx, bot); err != nil {
		t.Fatal(err)
	}

	v1 := catalog.SkillManifest{
		Key:     "cmp",
		Version: 1,
		Name:    "Comparar preços",
		Actions: []string{"search", "notify"},
	}
	if err := repo.AttachSkill(ctx, bot.ID, userID, v1); err != nil {
		t.Fatal(err)
	}

	v2 := catalog.SkillManifest{
		Key:     "cmp",
		Version: 2,
		Name:    "Comparar preços",
		Actions: []string{"search", "notify", "evt"},
	}

	missing, err := repo.PendingSkillUpgradeActions(ctx, bot.ID, userID, v2)
	if err != nil {
		t.Fatal(err)
	}
	if len(missing) != 1 || missing[0] != "evt" {
		t.Fatalf("esperava [evt] como ação pendente de aprovação na v2, obtido: %+v", missing)
	}

	// Nenhuma ação nova pode ter sido concedida automaticamente
	actions, err := repo.ListActions(ctx, bot.ID, userID)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range actions {
		if a.ActionKey == "evt" {
			t.Fatal("evt não deveria ser concedida sem toque do usuário")
		}
	}
}

func TestBotRepo_MemoriesAndCascadeDelete(t *testing.T) {
	repo, userID := setupBotTestDB(t)
	ctx := context.Background()

	bot := &domain.Bot{
		ID:       "bot-4",
		UserID:   userID,
		Title:    "Voo Rio",
		Goal:     "Monitorar voo",
		Category: "Viagens",
		Status:   domain.TriggerStatusActive,
	}
	if err := repo.Create(ctx, bot); err != nil {
		t.Fatal(err)
	}

	mem := &domain.BotMemory{
		ID:       "mem-1",
		BotID:    bot.ID,
		UserID:   userID,
		Content:  "prefiro voos diretos pela manhã",
		Source:   "chat",
		IsActive: true,
	}
	if err := repo.AddMemory(ctx, mem); err != nil {
		t.Fatal(err)
	}
	mems, err := repo.ListMemories(ctx, bot.ID, userID)
	if err != nil || len(mems) != 1 {
		t.Fatalf("esperava 1 memória ativa, obtido: %d, err: %v", len(mems), err)
	}
	if err := repo.Delete(ctx, bot.ID, userID); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.GetByID(ctx, bot.ID, userID); !errors.Is(err, domain.ErrBotNotFound) {
		t.Fatalf("esperava ErrBotNotFound após Delete, obtido: %v", err)
	}
}
