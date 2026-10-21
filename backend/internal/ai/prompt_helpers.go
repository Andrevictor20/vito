package ai

import (
	"fmt"
	"strings"
	"time"
)

// WeekdayPT retorna o nome do dia da semana em português.
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

// BuildCalendarReferenceTable gera a tabela com a relação exata de datas e dias da semana para os próximos 14 dias.
func BuildCalendarReferenceTable(nowLocal time.Time) string {
	var sb strings.Builder
	sb.WriteString("\nCALENDÁRIO OFICIAL DE REFERÊNCIA (PRÓXIMOS 14 DIAS — RELAÇÃO EXATA DATA E DIA DA SEMANA):\n")
	for i := 0; i < 14; i++ {
		d := nowLocal.AddDate(0, 0, i)
		label := fmt.Sprintf("+%d dias", i)
		switch i {
		case 0:
			label = "Hoje"
		case 1:
			label = "Amanhã"
		}
		sb.WriteString(fmt.Sprintf("- %s (%s, %s)\n", d.Format("2006-01-02"), WeekdayPT(d.Weekday()), label))
	}
	return sb.String()
}

func timeOfDayPT(hour int) string {
	switch {
	case hour >= 5 && hour < 12:
		return "Manhã"
	case hour >= 12 && hour < 18:
		return "Tarde"
	case hour >= 18 && hour < 24:
		return "Noite"
	default:
		return "Madrugada"
	}
}

// SanitizeUntrustedInput neutraliza tags de escape e encapsula dados não confiáveis em tags seguras.
func SanitizeUntrustedInput(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	// Neutraliza qualquer tentativa de fechamento precoce ou injeção de tags delimitadoras
	neutralized := strings.ReplaceAll(trimmed, "</untrusted_user_input>", "[escaped_closed_tag]")
	neutralized = strings.ReplaceAll(neutralized, "<untrusted_user_input>", "[escaped_open_tag]")

	return fmt.Sprintf("<untrusted_user_input>\n%s\n</untrusted_user_input>", neutralized)
}

// WrapUntrustedContent encapsula dados externos (web_search, vision_ocr, audio_whisper) em tags XML <untrusted_content>
// neutralizando qualquer tentativa de escape de tag (Indirect Prompt Injection Defense - Sprint 13).
func WrapUntrustedContent(source, raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if strings.TrimSpace(source) == "" {
		source = "external"
	}

	neutralized := strings.ReplaceAll(trimmed, "</untrusted_content>", "[escaped_closed_tag]")
	neutralized = strings.ReplaceAll(neutralized, "<untrusted_content", "[escaped_open_tag")

	return fmt.Sprintf("<untrusted_content source=%q>\n%s\n</untrusted_content>", source, neutralized)
}
