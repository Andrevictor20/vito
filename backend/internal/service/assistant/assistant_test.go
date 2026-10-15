package assistant

import (
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
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

func TestFormatTriggerAlertLine(t *testing.T) {
	got := FormatTriggerAlertLine("TV 55 polegadas", "Preço atingido: 3499.00", "3499.00")
	if got == "" || !strings.Contains(got, "TV 55") || !strings.Contains(got, "3499.00") {
		t.Fatalf("linha de alerta deveria citar radar e valor: %q", got)
	}
}

func TestCollectTriggerAlerts(t *testing.T) {
	trigs := []domain.Trigger{{ID: "t1", Title: "TV 55"}, {ID: "t2", Title: "Dólar"}}
	logs := map[string][]domain.TriggerLog{
		"t1": {
			{ID: "l1", TriggerID: "t1", Message: "Preço atingido", IsRead: false},
			{ID: "l2", TriggerID: "t1", Message: "Antigo lido", IsRead: true},
		},
		"t2": {{ID: "l3", TriggerID: "t2", Message: "Dólar subiu", IsRead: false}},
	}
	got := CollectTriggerAlerts(trigs, logs, 3)
	if len(got) != 2 {
		t.Fatalf("esperava 2 alertas não lidos, veio %d: %v", len(got), got)
	}
	got1 := CollectTriggerAlerts(trigs, logs, 1)
	if len(got1) != 1 {
		t.Fatalf("limite 1 deveria retornar 1, veio %d", len(got1))
	}
	if len(CollectTriggerAlerts(nil, logs, 3)) != 0 {
		t.Fatal("sem triggers não há alertas")
	}
}
