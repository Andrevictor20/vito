package timeutil

import (
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"
)

var (
	saoPauloOnce sync.Once
	saoPauloLoc  *time.Location

	naturalTimeRe = regexp.MustCompile(`(?i)\b(\d{1,2})(?:[:h](\d{2}))?\b`)
	brDateTimeRe  = regexp.MustCompile(`(?i)^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s*(?:às|as|-|,)?\s*(\d{1,2})(?:[:h](\d{2}))?)?$`)

	dbTimeFormats = []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05-07:00",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02 15:04:05 +0000 UTC",
		"2006-01-02 15:04:05 -0700 MST",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
	}
)

// SaoPauloLocation retorna o fuso horário America/Sao_Paulo carregado uma única vez
// (com fallback para BRT UTC-3 caso tzdata esteja indisponível).
func SaoPauloLocation() *time.Location {
	saoPauloOnce.Do(func() {
		loc, err := time.LoadLocation("America/Sao_Paulo")
		if err != nil {
			loc = time.FixedZone("BRT", -3*3600)
		}
		saoPauloLoc = loc
	})
	return saoPauloLoc
}

// NowSaoPaulo retorna o instante atual no fuso horário America/Sao_Paulo.
func NowSaoPaulo() time.Time {
	return time.Now().In(SaoPauloLocation())
}

// ParseDBTimeZero converte valores vindos do SQLite para time.Time em UTC,
// retornando zero time.Time{} quando nulo, vazio ou inválido (para campos nullable).
func ParseDBTimeZero(val any) time.Time {
	if val == nil {
		return time.Time{}
	}

	switch v := val.(type) {
	case time.Time:
		if v.IsZero() {
			return time.Time{}
		}
		return v.UTC()
	case *time.Time:
		if v == nil || v.IsZero() {
			return time.Time{}
		}
		return v.UTC()
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return time.Time{}
		}
		for _, format := range dbTimeFormats {
			if t, err := time.Parse(format, trimmed); err == nil {
				return t.UTC()
			}
		}
		for _, format := range dbTimeFormats {
			if t, err := time.ParseInLocation(format, trimmed, time.UTC); err == nil {
				return t.UTC()
			}
		}
		return time.Time{}
	case []byte:
		return ParseDBTimeZero(string(v))
	case int64:
		if v > 1e11 {
			return time.UnixMilli(v).UTC()
		}
		return time.Unix(v, 0).UTC()
	default:
		return time.Time{}
	}
}

// ParseDBTime converte valores vindos do SQLite para time.Time em UTC,
// usando time.Now().UTC() como fallback defensivo quando nulo, vazio ou inválido.
func ParseDBTime(val any) time.Time {
	if parsed := ParseDBTimeZero(val); !parsed.IsZero() {
		return parsed
	}
	return time.Now().UTC()
}

// TimeValUTC converte *time.Time para valor gravável em SQLite (nil quando ausente ou zero).
func TimeValUTC(t *time.Time) any {
	if t == nil || t.IsZero() {
		return nil
	}
	return t.UTC()
}

// ParseFlexibleDateTime interpreta datas/horas em múltiplos formatos no fuso America/Sao_Paulo.
func ParseFlexibleDateTime(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}
	}
	loc := SaoPauloLocation()

	// 1. Formatos com timezone explícito (RFC3339)
	for _, f := range []string{time.RFC3339, time.RFC3339Nano, "2006-01-02T15:04:05Z07:00", "2006-01-02 15:04:05 -0700"} {
		if t, err := time.Parse(f, raw); err == nil {
			return t.In(loc)
		}
	}

	// 2. Formatos locais interpretados no fuso America/Sao_Paulo
	localFormats := []string{
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"02/01/2006",
		"2006-01-02",
	}
	for _, f := range localFormats {
		if t, err := time.ParseInLocation(f, raw, loc); err == nil {
			return t
		}
	}

	// 3. Formato brasileiro com "às" ou "16h30" (ex: "05/11/2026 às 16h30")
	if m := brDateTimeRe.FindStringSubmatch(raw); len(m) > 0 {
		day, _ := strconv.Atoi(m[1])
		month, _ := strconv.Atoi(m[2])
		year, _ := strconv.Atoi(m[3])
		hour := 9
		min := 0
		if m[4] != "" {
			hour, _ = strconv.Atoi(m[4])
		}
		if m[5] != "" {
			min, _ = strconv.Atoi(m[5])
		}
		return time.Date(year, time.Month(month), day, hour, min, 0, 0, loc)
	}

	// 4. Expressões relativas em português ("hoje 18:30", "amanhã às 15:00", "depois de amanhã 10h")
	lower := strings.ToLower(raw)
	now := time.Now().In(loc)
	dayOffset := -1
	switch {
	case strings.Contains(lower, "depois de amanh"):
		dayOffset = 2
	case strings.Contains(lower, "amanh"):
		dayOffset = 1
	case strings.Contains(lower, "hoje"):
		dayOffset = 0
	}
	if dayOffset >= 0 {
		base := now.AddDate(0, 0, dayOffset)
		hour, min := 9, 0
		if tm := naturalTimeRe.FindStringSubmatch(lower); len(tm) > 1 {
			hour, _ = strconv.Atoi(tm[1])
			if len(tm) > 2 && tm[2] != "" {
				min, _ = strconv.Atoi(tm[2])
			}
		}
		return time.Date(base.Year(), base.Month(), base.Day(), hour, min, 0, 0, loc)
	}

	return time.Time{}
}

// WeekdayPT retorna o nome do dia da semana em português com inicial maiúscula.
func WeekdayPT(wd time.Weekday) string {
	switch wd {
	case time.Sunday:
		return "Domingo"
	case time.Monday:
		return "Segunda-feira"
	case time.Tuesday:
		return "Terça-feira"
	case time.Wednesday:
		return "Quarta-feira"
	case time.Thursday:
		return "Quinta-feira"
	case time.Friday:
		return "Sexta-feira"
	case time.Saturday:
		return "Sábado"
	default:
		return ""
	}
}

// WeekdayPTLower retorna o nome do dia da semana em português em minúsculas.
func WeekdayPTLower(wd time.Weekday) string {
	switch wd {
	case time.Sunday:
		return "domingo"
	case time.Monday:
		return "segunda-feira"
	case time.Tuesday:
		return "terça-feira"
	case time.Wednesday:
		return "quarta-feira"
	case time.Thursday:
		return "quinta-feira"
	case time.Friday:
		return "sexta-feira"
	case time.Saturday:
		return "sábado"
	default:
		return ""
	}
}
