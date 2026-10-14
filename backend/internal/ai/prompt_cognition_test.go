package ai

import "testing"

func TestCognitionBlocks(t *testing.T) {
	if got := BuildAppStateBlock(nil); got != "" {
		t.Fatal("bloco vazio deveria ser ''")
	}
	if got := BuildAppStateBlock([]string{"google_calendar_connected: false", "pending_approvals_count: 2"}); got == "" {
		t.Fatal("bloco deveria conter flags")
	}
	if got := ManualModuleFor("crie um booking amanhã"); got == "" {
		t.Fatal("manual booking deveria existir")
	}
	if got := ManualModuleFor("fale sobre física quântica"); got != "" {
		t.Fatal("tema geral não deveria injetar manual")
	}
	if got := CoreProfileBlock([]string{"trabalha 09-18", "prefere respostas curtas"}); got == "" {
		t.Fatal("core profile deveria gerar bloco")
	}
}

func TestValidateIntent(t *testing.T) {
	if err := ValidateIntent(nil); err == nil {
		t.Fatal("nil deveria falhar")
	}
	if err := ValidateIntent(&ParsedIntent{}); err == nil {
		t.Fatal("vazio deveria falhar")
	}
	if err := ValidateIntent(&ParsedIntent{Action: ActionGeneralChat, Message: "oi"}); err != nil {
		t.Fatalf("válido falhou: %v", err)
	}
	var target ParsedIntent
	if err := ParseAndNormalizeWithRepair(`{"action":"GENERAL_CHAT","message":"oi"}`, &target); err != nil {
		t.Fatalf("repair válido falhou: %v", err)
	}
	var emptyTarget ParsedIntent
	if err := ParseAndNormalizeWithRepair(`{"action":"GENERAL_CHAT"}`, &emptyTarget); err == nil {
		t.Fatal("repair vazio deveria falhar")
	}
}
