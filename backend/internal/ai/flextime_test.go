package ai

import (
	"testing"
	"time"
)

func TestUnmarshalIntent_EmptyDatesDoNotFail(t *testing.T) {
	raw := `{"action":"DELETE_EVENT","message":"Removido","event":{"title":"Reunião","start_at":"","end_at":"","target_query":"Reunião"},"todo":{"title":"","priority":"","due_date":""}}`
	var intent ParsedIntent
	if err := UnmarshalIntent(raw, &intent); err != nil {
		t.Fatalf("esperava sucesso com datas vazias, obteve: %v", err)
	}
	if intent.Event == nil || intent.Event.TargetQuery != "Reunião" {
		t.Fatalf("target_query não decodificado: %+v", intent.Event)
	}
	if !intent.Event.StartAt.IsZero() || !intent.Event.EndAt.IsZero() {
		t.Fatalf("datas vazias deveriam virar zero time, obteve %v / %v", intent.Event.StartAt, intent.Event.EndAt)
	}
	if intent.Todo == nil || intent.Todo.DueDate != nil {
		t.Fatalf("due_date vazio deveria ser nil, obteve %+v", intent.Todo)
	}
}

func TestLocalizeTimes_WallClockInUserTimezone(t *testing.T) {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		t.Skipf("tzdata indisponível: %v", err)
	}
	cases := []struct {
		name  string
		value string
		want  time.Time
	}{
		{"sem offset é horário local", "2026-10-06T17:00:00", time.Date(2026, 10, 6, 17, 0, 0, 0, loc)},
		{"sufixo Z é tratado como horário local", "2026-10-06T17:00:00Z", time.Date(2026, 10, 6, 17, 0, 0, 0, loc)},
		{"offset explícito é respeitado", "2026-10-06T17:00:00-03:00", time.Date(2026, 10, 6, 20, 0, 0, 0, time.UTC)},
		{"sem segundos", "2026-10-06T17:00", time.Date(2026, 10, 6, 17, 0, 0, 0, loc)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			raw := `{"action":"CREATE_EVENT","message":"ok","event":{"title":"X","start_at":"` + tc.value + `","end_at":"` + tc.value + `"}}`
			var intent ParsedIntent
			if err := UnmarshalIntent(raw, &intent); err != nil {
				t.Fatalf("unmarshal falhou: %v", err)
			}
			intent.LocalizeTimes("America/Sao_Paulo")
			if !intent.Event.StartAt.Equal(tc.want) {
				t.Fatalf("start_at = %v, esperado %v", intent.Event.StartAt.UTC(), tc.want.UTC())
			}
			if !intent.Event.EndAt.Equal(tc.want) {
				t.Fatalf("end_at = %v, esperado %v", intent.Event.EndAt.UTC(), tc.want.UTC())
			}
		})
	}
}

func TestLocalizeTimes_TodoDueDate(t *testing.T) {
	raw := `{"action":"CREATE_TODO","message":"ok","todo":{"title":"Pagar","priority":"high","due_date":"2026-10-09T18:00:00"}}`
	var intent ParsedIntent
	if err := UnmarshalIntent(raw, &intent); err != nil {
		t.Fatalf("unmarshal falhou: %v", err)
	}
	intent.LocalizeTimes("America/Sao_Paulo")
	want := time.Date(2026, 10, 9, 21, 0, 0, 0, time.UTC)
	if intent.Todo.DueDate == nil || !intent.Todo.DueDate.Equal(want) {
		t.Fatalf("due_date = %v, esperado %v", intent.Todo.DueDate, want)
	}
}

func TestUnmarshalIntent_InvalidDateStillFails(t *testing.T) {
	raw := `{"action":"CREATE_EVENT","message":"ok","event":{"title":"X","start_at":"amanhã às 5"}}`
	var intent ParsedIntent
	if err := UnmarshalIntent(raw, &intent); err == nil {
		t.Fatal("esperava erro para data não interpretável")
	}
}
