package adkengine_test

import (
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
)

// TestAC02_FormatSuspendedActionTodoAndEvent valida copy humanizada em PT-BR e card confirm.
func TestAC02_FormatSuspendedActionTodoAndEvent(t *testing.T) {
	answer, card, wa, gm := adkengine.FormatSuspendedAction(
		"create_todo",
		"pend-todo-1",
		"Modo assistido ativo",
		map[string]any{
			"title":    "Pagar boleto",
			"due_date": "2026-11-25 14:00",
			"category": "finanças",
		},
	)
	if wa != nil || gm != nil {
		t.Fatalf("create_todo não deveria gerar card de WhatsApp/Gmail")
	}
	if strings.Contains(answer, "'create_todo'") || strings.Contains(strings.ToLower(answer), "confirma o envio") {
		t.Errorf("AC-02 copy técnica/genérica proibida em create_todo: %q", answer)
	}
	if !strings.Contains(answer, "Pagar boleto") {
		t.Errorf("AC-02 copy deveria incluir título da tarefa: %q", answer)
	}
	if card.Type != "confirm" || card.ID != "pend-todo-1" || !card.Confirm || !card.Dismiss {
		t.Errorf("AC-02 card inválido: %+v", card)
	}

	evAnswer, evCard, _, _ := adkengine.FormatSuspendedAction(
		"create_event",
		"pend-ev-1",
		"Modo assistido ativo",
		map[string]any{
			"title":      "Alinhamento",
			"start_time": "2026-11-25 10:00",
		},
	)
	if strings.Contains(evAnswer, "'create_event'") || strings.Contains(strings.ToLower(evAnswer), "confirma o envio") {
		t.Errorf("AC-02 copy técnica proibida em create_event: %q", evAnswer)
	}
	if !strings.Contains(evAnswer, "Alinhamento") || evCard.Type != "confirm" {
		t.Errorf("AC-02 evento mal formatado: answer=%q card=%+v", evAnswer, evCard)
	}

	for _, op := range []string{"delete_todo", "delete_event", "create_booking_link", "create_bot", "unknown_op"} {
		msg, c, _, _ := adkengine.FormatSuspendedAction(op, "pend-x", "Confirmação necessária", map[string]any{"title": "Item"})
		if strings.Contains(strings.ToLower(msg), "confirma o envio") {
			t.Errorf("AC-02 op %s não pode dizer 'confirma o envio': %q", op, msg)
		}
		if c.Type != "confirm" || !c.Confirm || !c.Dismiss {
			t.Errorf("AC-02 op %s gerou card inválido: %+v", op, c)
		}
	}
}
