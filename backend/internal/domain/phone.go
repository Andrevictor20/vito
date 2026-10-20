package domain

import (
	"strings"
	"unicode"
)

// NormalizePhone converte um telefone brasileiro para o formato E.164 (+55DDDNNNNNNNNN).
// Formatos aceitos: com/sem '+', com ou sem DDI 55, com DDD, com o 9º dígito brasileiro
// e com pontuação. Retorna string vazia quando o número não é válido.
func NormalizePhone(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	hasPlus := strings.HasPrefix(trimmed, "+")

	var b strings.Builder
	for _, r := range trimmed {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	if digits == "" {
		return ""
	}

	if hasPlus {
		if len(digits) >= 8 && len(digits) <= 15 {
			return "+" + digits
		}
		return ""
	}

	// Remove zero à esquerda em DDD nacional (ex: 011987654321 -> 11987654321)
	if strings.HasPrefix(digits, "0") && (len(digits) == 11 || len(digits) == 12) {
		digits = digits[1:]
	}

	// Já contém DDI 55 (12 ou 13 dígitos)
	if strings.HasPrefix(digits, "55") && (len(digits) == 12 || len(digits) == 13) {
		return "+" + digits
	}

	// Nacional BR com DDD (10 ou 11 dígitos)
	if len(digits) == 10 || len(digits) == 11 {
		return "+55" + digits
	}

	return ""
}

// PhoneDigits retorna apenas os dígitos de um telefone.
func PhoneDigits(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// localPartBR retorna DDD e os últimos 8 dígitos do número local brasileiro.
func localPartBR(digits string) (ddd string, last8 string, ok bool) {
	if !strings.HasPrefix(digits, "55") || len(digits) < 12 {
		return "", "", false
	}
	ddd = digits[2:4]
	local := digits[4:]
	if len(local) < 8 {
		return "", "", false
	}
	return ddd, local[len(local)-8:], true
}

// PhonesMatch compara dois telefones tolerando '+', pontuação, DDI ausente e a
// variação do 9º dígito brasileiro (ex.: 559884417165 <-> 5598984417165).
func PhonesMatch(a, b string) bool {
	// Forma canônica (E.164): cobre DDI ausente, pontuação e o prefixo '+'.
	na := NormalizePhone(a)
	nb := NormalizePhone(b)
	if na != "" && na == nb {
		return true
	}

	da := PhoneDigits(a)
	db := PhoneDigits(b)
	if da == "" || db == "" {
		return false
	}
	if da == db {
		return true
	}

	dddA, lastA, okA := localPartBR(da)
	dddB, lastB, okB := localPartBR(db)
	if okA && okB && dddA == dddB && lastA == lastB {
		return true
	}

	return false
}

// PhoneVariants retorna as formas equivalentes de um telefone para busca: E.164,
// apenas dígitos e a variante brasileira de 8 dígitos (sem o 9º dígito).
func PhoneVariants(raw string) []string {
	variants := []string{}
	seen := map[string]bool{}

	add := func(v string) {
		if v == "" || seen[v] {
			return
		}
		seen[v] = true
		variants = append(variants, v)
	}

	trimmed := strings.TrimSpace(raw)
	add(trimmed)

	digits := PhoneDigits(trimmed)
	add(digits)

	// Variante de 8 dígitos (relação BR 9º dígito): +55 + DDD + local sem o primeiro dígito
	if strings.HasPrefix(digits, "55") && len(digits) == 13 {
		ddd := digits[2:4]
		local := digits[4:]
		if len(local) == 9 {
			eight := "55" + ddd + local[1:]
			add("+" + eight)
			add(eight)
		}
	}

	return variants
}
