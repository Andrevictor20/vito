package service_test

import (
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestParseMoneyValue(t *testing.T) {
	cases := []struct {
		in   string
		want float64
		ok   bool
	}{
		{"R$ 3.500,99", 3500.99, true},
		{"R$ 3.500", 3500, true},
		{"R$ 35", 35, true},
		{"$1,000", 1000, true},
		{"3500.50", 3500.50, true},
		{"$1,234.56", 1234.56, true},
		{"5.6512", 5.6512, true},
		{"Dólar a R$ 5,65 hoje", 5.65, true},
		{"", 0, false},
		{"sem valor aqui", 0, false},
	}
	for _, c := range cases {
		got, ok := service.ParseMoneyValue(c.in)
		if ok != c.ok {
			t.Errorf("ParseMoneyValue(%q): ok=%v, queria %v", c.in, ok, c.ok)
			continue
		}
		if ok && got != c.want {
			t.Errorf("ParseMoneyValue(%q) = %v, queria %v", c.in, got, c.want)
		}
	}
}

func TestPriceConditionMet(t *testing.T) {
	if !service.PriceConditionMet(domain.ConditionPriceBelow, 3500, 3499.99) {
		t.Error("price_below deveria disparar com 3499.99 <= 3500")
	}
	if !service.PriceConditionMet(domain.ConditionPriceBelow, 3500, 3500) {
		t.Error("price_below deveria disparar na igualdade")
	}
	if service.PriceConditionMet(domain.ConditionPriceBelow, 3500, 3500.01) {
		t.Error("price_below não deveria disparar com 3500.01")
	}
	if !service.PriceConditionMet(domain.ConditionPriceAbove, 5.50, 5.65) {
		t.Error("price_above deveria disparar com 5.65 >= 5.50")
	}
	if service.PriceConditionMet(domain.ConditionPriceAbove, 5.50, 5.49) {
		t.Error("price_above não deveria disparar com 5.49")
	}
	if service.PriceConditionMet(domain.ConditionDailyBrief, 1, 2) {
		t.Error("condição não-preço nunca dispara no comparador")
	}
}

func TestPriceNotifyCooldownActive(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	if service.PriceNotifyCooldownActive(nil, now, 24*time.Hour) {
		t.Error("sem aviso anterior não há cooldown")
	}
	recent := now.Add(-23 * time.Hour)
	if !service.PriceNotifyCooldownActive(&recent, now, 24*time.Hour) {
		t.Error("aviso há 23h deveria estar em cooldown de 24h")
	}
	old := now.Add(-25 * time.Hour)
	if service.PriceNotifyCooldownActive(&old, now, 24*time.Hour) {
		t.Error("aviso há 25h não deveria estar em cooldown de 24h")
	}
}
