package ai

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func TestRouteTriggerSource(t *testing.T) {
	fin := &domain.Trigger{Category: domain.CategoryFinance, Query: "dólar hoje", Title: "Câmbio"}
	if got := RouteTriggerSource(fin).Name(); got != "finance" {
		t.Errorf("finance esperado, veio %s", got)
	}
	w := &domain.Trigger{Category: domain.CategoryWeather, Query: "clima em Recife", Title: "Tempo"}
	if got := RouteTriggerSource(w).Name(); got != "weather" {
		t.Errorf("weather esperado, veio %s", got)
	}
	n := &domain.Trigger{Category: domain.CategoryTech, Query: "IA", Title: "Tech"}
	if got := RouteTriggerSource(n).Name(); got != "google_news" {
		t.Errorf("google_news esperado, veio %s", got)
	}
}

func TestNewsQueryFor(t *testing.T) {
	imm := &domain.Trigger{Query: "concurso", Frequency: domain.FrequencyImmediate}
	if q := NewsQueryFor(imm); q != "concurso when:1h" {
		t.Errorf("when:1h esperado, veio %q", q)
	}
	daily := &domain.Trigger{Query: "concurso", Frequency: domain.FrequencyDailyMorning}
	if q := NewsQueryFor(daily); q != "concurso" {
		t.Errorf("query intacta esperada, veio %q", q)
	}
}

func TestWeatherCity(t *testing.T) {
	tr := &domain.Trigger{Query: "vai chover em Recife amanhã?", Title: "Clima"}
	if c := weatherCity(tr); c != "Recife" {
		t.Errorf("Recife esperado, veio %q", c)
	}
	def := &domain.Trigger{Query: "clima", Title: "Tempo"}
	if c := weatherCity(def); c != "São Paulo" {
		t.Errorf("fallback São Paulo esperado, veio %q", c)
	}
}

func TestHashDataPoint_Stable(t *testing.T) {
	p := TriggerDataPoint{Title: "A", Link: "http://x", Value: "1"}
	if HashDataPoint(p) != HashDataPoint(p) {
		t.Error("hash deveria ser estável")
	}
	q := TriggerDataPoint{Title: "B", Link: "http://x", Value: "1"}
	if HashDataPoint(p) == HashDataPoint(q) {
		t.Error("títulos distintos deveriam gerar hashes distintos")
	}
}
