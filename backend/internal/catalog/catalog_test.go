package catalog

import (
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func TestCatalog_LoadAndValidate(t *testing.T) {
	cat, err := LoadDefaultCatalog()
	if err != nil {
		t.Fatalf("LoadDefaultCatalog falhou: %v", err)
	}
	if len(cat.Templates) != 13 {
		t.Fatalf("esperava 13 templates de bots no catálogo, obtido %d", len(cat.Templates))
	}
	if len(cat.Skills) != 9 {
		t.Fatalf("esperava 9 pacotes de habilidades no catálogo, obtido %d", len(cat.Skills))
	}

	for _, sk := range cat.Skills {
		n := SkillCharCount(sk)
		if n > MaxSkillChars {
			t.Fatalf("habilidade %q excede %d caracteres (%d)", sk.Key, MaxSkillChars, n)
		}
	}
}

func TestCatalog_ValidationErrors_AC15(t *testing.T) {
	validSkill := SkillManifest{
		Key:            "cmp",
		Version:        1,
		Name:           "Comparar preços",
		Icon:           "tag",
		Description:    "Compara preços.",
		When:           "Quando acompanha preço.",
		Steps:          []string{"Pesquisar"},
		Actions:        []string{"search", "notify"},
		OutputContract: "Listar preço.",
	}
	validBot := BotTemplate{
		Key:      "flight_hunter",
		Version:  1,
		Name:     "Caçador de voos",
		Category: "Viagens",
		Goal:     "Acompanha preço.",
		Skills:   []string{"cmp"},
	}

	// Ação inexistente
	badActionSkill := validSkill
	badActionSkill.Actions = []string{"non_existent_action"}
	if err := ValidateCatalog([]BotTemplate{validBot}, []SkillManifest{badActionSkill}); err == nil {
		t.Fatal("esperava erro para ação inexistente no ActionCatalog")
	}

	// Mais de 6 habilidades no bot
	tooManySkillsBot := validBot
	tooManySkillsBot.Skills = []string{"s1", "s2", "s3", "s4", "s5", "s6", "s7"}
	if err := ValidateCatalog([]BotTemplate{tooManySkillsBot}, []SkillManifest{validSkill}); err == nil {
		t.Fatal("esperava erro para bot com > 6 habilidades")
	}

	// Habilidade > 700 caracteres
	oversizedSkill := validSkill
	oversizedSkill.Description = strings.Repeat("a", 701)
	if err := ValidateCatalog([]BotTemplate{validBot}, []SkillManifest{oversizedSkill}); err == nil {
		t.Fatal("esperava erro para habilidade com > 700 caracteres")
	}

	// Chaves duplicadas
	if err := ValidateCatalog([]BotTemplate{validBot, validBot}, []SkillManifest{validSkill}); err == nil {
		t.Fatal("esperava erro para chaves duplicadas de bot")
	}
	if err := ValidateCatalog([]BotTemplate{validBot}, []SkillManifest{validSkill, validSkill}); err == nil {
		t.Fatal("esperava erro para chaves duplicadas de habilidade")
	}
}

func TestCatalog_FanOnDuty_Actions_AC09(t *testing.T) {
	cat, err := LoadDefaultCatalog()
	if err != nil {
		t.Fatal(err)
	}
	actions, err := cat.ActionsForTemplate("fan_on_duty")
	if err != nil {
		t.Fatalf("ActionsForTemplate(fan_on_duty) falhou: %v", err)
	}

	expected := map[string]domain.ActionPolicy{
		"search": domain.ActionPolicyAuto,
		"free":   domain.ActionPolicyAuto,
		"evt":    domain.ActionPolicyAsk,
		"route":  domain.ActionPolicyAuto,
		"leave":  domain.ActionPolicyAuto,
		"notify": domain.ActionPolicyAuto,
	}
	if len(actions) != len(expected) {
		t.Fatalf("esperava %d ações para fan_on_duty, obtido %d: %+v", len(expected), len(actions), actions)
	}
	for k, wantPol := range expected {
		gotPol, ok := actions[k]
		if !ok {
			t.Fatalf("ação %q ausente em fan_on_duty", k)
		}
		if gotPol != wantPol {
			t.Fatalf("ação %q em fan_on_duty: esperava política %q, obtido %q", k, wantPol, gotPol)
		}
	}
}

func TestCatalog_MessageFollowups_HasWaSendAlwaysAsk(t *testing.T) {
	cat, err := LoadDefaultCatalog()
	if err != nil {
		t.Fatal(err)
	}
	actions, err := cat.ActionsForTemplate("message_followups")
	if err != nil {
		t.Fatalf("ActionsForTemplate(message_followups) falhou: %v", err)
	}
	if pol, ok := actions["wasend"]; !ok || pol != domain.ActionPolicyAsk {
		t.Fatalf("message_followups deve incluir wasend=ask, obtido: %+v", actions)
	}
	if _, ok := actions["task"]; !ok {
		t.Fatalf("message_followups deve incluir task, obtido: %+v", actions)
	}
}
