package domain

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestAlwaysAskActions_NeverBecomesAuto(t *testing.T) {
	if !IsAlwaysAskAction("wasend") {
		t.Fatal("esperava wasend em AlwaysAskActions")
	}

	err := ValidateActionPolicy("wasend", ActionPolicyAuto)
	if !errors.Is(err, ErrAlwaysAskPolicyViolation) {
		t.Fatalf("esperava ErrAlwaysAskPolicyViolation para wasend=auto, obtido: %v", err)
	}

	if err := ValidateActionPolicy("wasend", ActionPolicyAsk); err != nil {
		t.Fatalf("wasend=ask deveria ser válido, obtido: %v", err)
	}
	if err := ValidateActionPolicy("wasend", ActionPolicyOff); err != nil {
		t.Fatalf("wasend=off deveria ser válido, obtido: %v", err)
	}
	if err := ValidateActionPolicy("search", ActionPolicyAuto); err != nil {
		t.Fatalf("search=auto deveria ser válido, obtido: %v", err)
	}
	if err := ValidateActionPolicy("acao_inexistente", ActionPolicyAuto); !errors.Is(err, ErrUnknownAction) {
		t.Fatalf("esperava ErrUnknownAction para ação inexistente, obtido: %v", err)
	}
}

func TestActionCatalog_Completeness(t *testing.T) {
	expected := []string{
		"notify", "task", "search", "spend",
		"free", "evt", "mailr", "draft",
		"waread", "wasend", "omail", "oevt",
		"route", "leave", "tcard", "tmove",
	}
	for _, key := range expected {
		spec, ok := ActionCatalog[key]
		if !ok {
			t.Fatalf("ação esperada %q ausente de ActionCatalog", key)
		}
		if spec.AppKey == "" || spec.Label == "" {
			t.Fatalf("ação %q com AppKey ou Label vazio: %+v", key, spec)
		}
		if !spec.DefaultPolicy.IsValid() {
			t.Fatalf("ação %q com DefaultPolicy inválida: %q", key, spec.DefaultPolicy)
		}
	}

	wasend := ActionCatalog["wasend"]
	if !wasend.AlwaysAsk || wasend.DefaultPolicy != ActionPolicyAsk {
		t.Fatalf("wasend deve ter AlwaysAsk=true e DefaultPolicy=ask: %+v", wasend)
	}
}

func TestBotRunReport_JSONRoundTrip(t *testing.T) {
	orig := BotRunReport{
		Summary:                "Encontrou 1 voo abaixo do alvo",
		Verified:               []string{"Google Flights", "Kayak"},
		Did:                    []string{"Avisou usuário"},
		Waiting:                []string{"Criar tarefa"},
		Cant:                   []string{},
		PendingConfirmationIDs: []string{"conf-123"},
		ModelUsed:              "gemini-2.5-flash",
		ShouldNotify:           true,
	}
	raw, err := json.Marshal(orig)
	if err != nil {
		t.Fatalf("falha ao serializar BotRunReport: %v", err)
	}
	var got BotRunReport
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("falha ao desserializar BotRunReport: %v", err)
	}
	if got.Summary != orig.Summary || got.ModelUsed != orig.ModelUsed || !got.ShouldNotify {
		t.Fatalf("round-trip divergente: %+v", got)
	}
	if len(got.Verified) != 2 || len(got.PendingConfirmationIDs) != 1 {
		t.Fatalf("slices divergentes no round-trip: %+v", got)
	}
}
