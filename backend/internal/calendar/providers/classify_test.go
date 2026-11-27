package providers_test

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/calendar/providers"
)

func TestClassifyEvent(t *testing.T) {
	cases := []struct {
		title    string
		desc     string
		expected string
	}{
		{"Daily Scrum", "Alinhamento com o time", "work"},
		{"Consulta com Cardiologista", "Levar exames", "health"},
		{"Pagar fatura Nubank", "Vencimento hoje", "finance"},
		{"Aula de Arquitetura de Software", "Faculdade", "study"},
		{"Nossa Senhora Aparecida", "Feriado Nacional", "holiday"},
		{"Tiradentes", "Feriado", "holiday"},
		{"Natal", "Celebração", "holiday"},
		{"Churrasco de Aniversário", "Na casa do Pedro", "leisure"},
		{"Almoço com a Família", "Comprar sobremesa", "personal"},
		{"Lembrete genérico", "Sem contexto", "general"},
	}

	for _, c := range cases {
		cat, col := providers.ClassifyEvent(c.title, c.desc)
		if cat != c.expected {
			t.Errorf("ClassifyEvent(%q, %q) = %q, expected %q", c.title, c.desc, cat, c.expected)
		}
		if col == "" {
			t.Errorf("ClassifyEvent(%q, %q) returned empty color", c.title, c.desc)
		}
	}
}
