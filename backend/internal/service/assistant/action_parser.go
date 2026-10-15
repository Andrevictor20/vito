package assistant

import (
	"regexp"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
)

// ActionParser: validação e coerção de intenções (BACK-01: extraído de assistant_service.go).
// Funções puras, sem acesso a banco — testáveis isoladamente.

func DefaultMessageFor(action ai.IntentAction) string {
	switch action {
	case ai.ActionCreateEvent:
		return "Para agendar, me diga o nome do evento, o dia e o horário (ex: 'Dentista amanhã às 14h'). Se não souber o horário, sugiro 09:00, 14:00 ou 19:00."
	case ai.ActionCreateTodo:
		return "O que devo lembrar para você? Me diga a tarefa e o prazo (ex: 'Comprar café até sexta')."
	case ai.ActionCreateTrigger:
		return "Sobre o que quer criar a vigília? Me diga o tema e o horário (ex: 'PETR3 todo dia às 08:30')."
	case ai.ActionCreateBookingLink:
		return "Para gerar seu link de agendamento, me diga o nome, a duração e a janela de atendimento (ex: 'Café rápido, 30 min, 09:00 às 18:00')."
	case ai.ActionCreatePending:
		return "O que devo guardar nas Pendências? Me diga o título e, se quiser, uma data futura."
	case ai.ActionDeleteEvent:
		return "Qual compromisso devo excluir? Me diga o nome (ex: 'exclua a aula de inglês')."
	case ai.ActionUpdateEvent:
		return "Qual compromisso devo reagendar e para quando? Ex: 'mude a aula de inglês para as 9h'."
	case ai.ActionQuerySchedule:
		return "Sobre qual dia quer saber? Ex: 'o que tenho hoje?', 'eventos no sábado?' ou 'agenda do dia 20'."
	case ai.ActionQueryTodos:
		return "Claro! Já listo suas tarefas pendentes para você."
	default:
		return "Pode me dar mais detalhes para eu ajudar? Ex: 'Criar evento Dentista amanhã às 14h'."
	}
}

func ClarificationMessage(question string) string {
	if msg := strings.TrimSpace(question); msg != "" {
		return msg
	}
	return "Pode me dar mais detalhes? Ex: nome, data e horário."
}

func IsVagueBookingRequest(text string) bool {
	t := strings.ToLower(strings.TrimSpace(text))
	if t == "" {
		return true
	}
	detailHints := []string{
		"19h", "20h", "09:00", "09h", "14h", "15h", "18h", ":", "30 min", "30min",
		"15 min", "45 min", "60 min", "min", "segunda", "terça", "quarta", "quinta",
		"sexta", "sábado", "sabado", "domingo", "amanhã", "amanha", "hoje",
		"dias úteis", "dias uteis", "fim de semana", "reunião de", "reuniao de",
		"café", "cafe", "alinhamento", "consulta", "aula", "treino", "dentista",
		"19", "20", "09", "14", "15", "18", "/", "-",
	}
	for _, h := range detailHints {
		if strings.Contains(t, h) {
			letters := 0
			for _, r := range t {
				if (r >= 'a' && r <= 'z') || (r >= 'à' && r <= 'ÿ') {
					letters++
				}
			}
			if letters > 25 {
				return false
			}
		}
	}
	vaguePhrases := []string{
		"crie um booking", "criar booking", "quero criar um booking", "quero um booking",
		"crie um link", "criar link", "link de agendamento", "crie booking",
		"quero criar", "crie um evento", "quero criar um evento",
	}
	for _, p := range vaguePhrases {
		if strings.Contains(t, p) && len(t) < 60 {
			return true
		}
	}
	return len(t) < 20
}

func IsBookingIntentText(text string) bool {
	t := strings.ToLower(text)
	syns := []string{
		"booking", "link de agendamento", "link para agendar", "link de marcacao",
		"link de marcação", "disponibilizar horário", "disponibilizar horario",
		"disponibilize horário", "disponibilize horario", "agenda aberta",
		"marquem comigo", "marque comigo", "deixe marcarem", "horário comercial",
		"horario comercial", "janela de atendimento", "criar agenda de",
	}
	for _, s := range syns {
		if strings.Contains(t, s) {
			return true
		}
	}
	return false
}

var slugCleaner = regexp.MustCompile(`[^a-z0-9\-]`)

func SlugifyBookingTitle(title string) string {
	slug := strings.ToLower(strings.ReplaceAll(title, " ", "-"))
	slug = slugCleaner.ReplaceAllString(slug, "")
	if len(slug) > 30 {
		slug = slug[:30]
	}
	return strings.Trim(slug, "-")
}

func InferBookingDaysOfWeek(text string) string {
	t := strings.ToLower(text)
	if strings.Contains(t, "só fim de semana") || strings.Contains(t, "so fim de semana") ||
		strings.Contains(t, "apenas fim de semana") || strings.Contains(t, "somente fim de semana") {
		return "[6,7]"
	}
	if strings.Contains(t, "só dias úteis") || strings.Contains(t, "so dias uteis") ||
		strings.Contains(t, "apenas dias úteis") || strings.Contains(t, "dias uteis") ||
		strings.Contains(t, "segunda a sexta") || strings.Contains(t, "seg a sex") {
		return "[1,2,3,4,5]"
	}
	return "[1,2,3,4,5,6,7]"
}

// SameTopic detecta contradição/atualização sobre o mesmo hábito (§8.4 ciclo 1).
func SameTopic(a, b string) bool {
	words := func(s string) map[string]bool {
		out := map[string]bool{}
		for _, w := range strings.Fields(s) {
			w = strings.ToLower(strings.Trim(w, ".,;:!?\"'()"))
			if len(w) >= 4 {
				out[w] = true
			}
		}
		return out
	}
	wa, wb := words(a), words(b)
	if len(wa) == 0 || len(wb) == 0 {
		return false
	}
	shared := 0
	for w := range wa {
		if wb[w] {
			shared++
		}
	}
	minLen := len(wa)
	if len(wb) < minLen {
		minLen = len(wb)
	}
	return shared*2 >= minLen && shared >= 2
}
