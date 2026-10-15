package service

import (
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// PriceNotifyCooldown evita repetir o push de preço-alvo (Fase 1: 24h).
const PriceNotifyCooldown = 24 * time.Hour

var moneyNumberRe = regexp.MustCompile(`\d[\d.,]*\d|\d`)

// ParseMoneyValue interpreta valores em PT-BR ("R$ 3.500,99") e EN ("$1,234.56",
// "5.6512"). O último separador é tratado como decimal; o outro (se houver)
// como milhar. Retorna false quando não há número.
func ParseMoneyValue(s string) (float64, bool) {
	m := moneyNumberRe.FindString(s)
	if m == "" {
		return 0, false
	}
	lastDot := strings.LastIndex(m, ".")
	lastComma := strings.LastIndex(m, ",")
	// Dígitos após o único separador: 3 = milhar ("3.500"→3500, "1,000"→1000).
	digitsAfter := func(idx int) int { return len(m) - idx - 1 }
	decimal := -1
	thousand := -1
	switch {
	case lastDot >= 0 && lastComma >= 0:
		if lastDot > lastComma {
			decimal, thousand = lastDot, lastComma
		} else {
			decimal, thousand = lastComma, lastDot
		}
	case lastComma >= 0:
		if digitsAfter(lastComma) == 3 && len(m) > 4 {
			thousand = lastComma
		} else {
			decimal = lastComma
		}
	case lastDot >= 0:
		if digitsAfter(lastDot) == 3 && len(m) > 4 {
			thousand = lastDot
		} else {
			decimal = lastDot
		}
	}
	var b strings.Builder
	for i := 0; i < len(m); i++ {
		c := m[i]
		if c >= '0' && c <= '9' {
			b.WriteByte(c)
		} else if i == decimal {
			b.WriteByte('.')
		} else if i == thousand {
			continue
		} else {
			return 0, false
		}
	}
	v, err := strconv.ParseFloat(b.String(), 64)
	if err != nil {
		return 0, false
	}
	return v, true
}

// PriceConditionMet avalia price_above/price_below de forma determinística
// (igualdade inclusiva). Outras condições nunca disparam por este caminho.
func PriceConditionMet(cond domain.TriggerConditionType, target, current float64) bool {
	switch cond {
	case domain.ConditionPriceBelow:
		return current <= target
	case domain.ConditionPriceAbove:
		return current >= target
	default:
		return false
	}
}

// PriceNotifyCooldownActive indica se um aviso recente ainda silencia o push.
func PriceNotifyCooldownActive(lastNotified *time.Time, now time.Time, cooldown time.Duration) bool {
	if lastNotified == nil {
		return false
	}
	return now.Sub(*lastNotified) < cooldown
}
