package assistant

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestDecideMemoryOp(t *testing.T) {
	if op, _ := DecideMemoryOp([]string{"academia às 07h"}, "academia às 07h"); op != OpNoop {
		t.Fatalf("esperava NOOP, obteve %s", op)
	}
	if op, idx := DecideMemoryOp([]string{"faço academia às 07h de manhã"}, "agora faço academia às 19h de noite"); op != OpSupersede || idx != 0 {
		t.Fatalf("esperava SUPERSEDE, obteve %s/%d", op, idx)
	}
	if op, _ := DecideMemoryOp([]string{"gosta de café"}, "prefere chá verde"); op != OpAdd {
		t.Fatalf("esperava ADD, obteve %s", op)
	}
}

func TestBookingHelpers(t *testing.T) {
	if !IsBookingIntentText("crie um booking para mim") {
		t.Fatal("IsBookingIntentText deveria detectar booking")
	}
	if !IsVagueBookingRequest("crie um booking") {
		t.Fatal("IsVagueBookingRequest deveria detectar vago")
	}
	if IsVagueBookingRequest("Café rápido 30 min 09:00 às 18:00 todos os dias úteis com João") {
		t.Fatal("não deveria ser vago com detalhes")
	}
	if got := InferBookingDaysOfWeek("só dias úteis"); got != "[1,2,3,4,5]" {
		t.Fatalf("dias úteis: %s", got)
	}
	if msg := DefaultMessageFor(ai.ActionCreateEvent); msg == "" {
		t.Fatal("DefaultMessageFor vazio")
	}
	if msg := ClarificationMessage(""); msg == "" {
		t.Fatal("ClarificationMessage vazio")
	}
}
