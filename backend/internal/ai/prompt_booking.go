package ai

import (
	"fmt"
	"strings"
	"time"
	_ "time/tzdata"
)

// BuildSystemPromptWithBookingContext constrói o prompt com todas as camadas incluindo Vito Booking.
func BuildSystemPromptWithBookingContext(
	now time.Time,
	timezone string,
	memories []string,
	activeSchedule []string,
	pendingTodos []string,
	activeTriggers []string,
	activeBookings []string,
	upcomingAppointments []string,
	history []ChatMessageContext,
	userName string,
	autonomyMode string,
) string {
	if timezone == "" {
		timezone = "America/Sao_Paulo"
	}

	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}
	nowLocal := now.In(loc)
	_, offsetSec := nowLocal.Zone()
	offsetHours := offsetSec / 3600
	offsetMins := (offsetSec % 3600) / 60
	if offsetMins < 0 {
		offsetMins = -offsetMins
	}
	offsetStr := fmt.Sprintf("%+03d:%02d", offsetHours, offsetMins)

	localDateStr := nowLocal.Format("2006-01-02")
	localTimeStr := nowLocal.Format("15:04:05")
	localWeekday := WeekdayPT(nowLocal.Weekday())
	localPeriod := timeOfDayPT(nowLocal.Hour())

	tomorrowLocal := nowLocal.AddDate(0, 0, 1)
	tomorrowDateStr := tomorrowLocal.Format("2006-01-02")
	tomorrowWeekday := WeekdayPT(tomorrowLocal.Weekday())
	calRef := BuildCalendarReferenceTable(nowLocal)

	userSection := ""
	if strings.TrimSpace(userName) != "" {
		userSection = fmt.Sprintf("\nUSUÁRIO ATIVO: %s\n", strings.TrimSpace(userName))
	}

	memorySection := ""
	if len(memories) > 0 {
		memorySection = "\nMEMÓRIAS E APRENDIZADOS DE LONGO PRAZO DO USUÁRIO:\n"
		for _, m := range memories {
			if strings.TrimSpace(m) != "" {
				memorySection += fmt.Sprintf("- %s\n", m)
			}
		}
	}

	scheduleSection := ""
	if len(activeSchedule) > 0 {
		scheduleSection = "\nCOMPROMISSOS PRÓXIMOS NA AGENDA:\n"
		for _, s := range activeSchedule {
			if strings.TrimSpace(s) != "" {
				scheduleSection += fmt.Sprintf("- %s\n", s)
			}
		}
	}

	todoSection := ""
	if len(pendingTodos) > 0 {
		todoSection = "\nTAREFAS PENDENTES PRIORITÁRIAS:\n"
		for _, t := range pendingTodos {
			if strings.TrimSpace(t) != "" {
				todoSection += fmt.Sprintf("- %s\n", t)
			}
		}
	}

	triggerSection := ""
	if len(activeTriggers) > 0 {
		triggerSection = "\nDISPARADORES E VIGÍLIAS ATIVAS NO APP:\n"
		for _, tr := range activeTriggers {
			if strings.TrimSpace(tr) != "" {
				triggerSection += fmt.Sprintf("- %s\n", tr)
			}
		}
	}

	bookingSection := ""
	if len(activeBookings) > 0 {
		bookingSection = "\nSEUS LINKS DE AGENDAMENTO ATIVOS (VITO BOOKING):\n"
		for _, b := range activeBookings {
			if strings.TrimSpace(b) != "" {
				bookingSection += fmt.Sprintf("- %s\n", b)
			}
		}
	}

	apptsSection := ""
	if len(upcomingAppointments) > 0 {
		apptsSection = "\nAGENDAMENTOS RECEBIDOS DE CONVIDADOS:\n"
		for _, a := range upcomingAppointments {
			if strings.TrimSpace(a) != "" {
				apptsSection += fmt.Sprintf("- %s\n", a)
			}
		}
	}

	historySection := ""
	if len(history) > 0 {
		historySection = "\nHISTÓRICO RECENTE DA CONVERSA (Contexto Imediato de Continuidade):\n"
		for _, h := range history {
			if strings.TrimSpace(h.Text) != "" {
				senderLabel := "Usuário"
				if strings.ToLower(h.Sender) == "vito" || strings.ToLower(h.Sender) == "assistant" {
					senderLabel = "Vito"
				}
				historySection += fmt.Sprintf("- %s: %s\n", senderLabel, strings.TrimSpace(h.Text))
			}
		}
		historySection += "(Utilize este histórico para manter a continuidade do diálogo, resolver pronomes como 'ele', 'isso', 'o mesmo', entender confirmações 'sim', 'agende para amanhã', e conectar ideias anteriores com naturalidade.)\n"
	}

	mode := "assisted"
	if strings.TrimSpace(autonomyMode) != "" {
		mode = strings.ToLower(strings.TrimSpace(autonomyMode))
	}

	autonomySection := ""
	if mode == "proactive" {
		autonomySection = `
DIRETRIZ DE NÍVEL DE AUTONOMIA — PROATIVO (SECRETÁRIO EXECUTIVO AUTÔNOMO):
- O usuário concedeu a você total autonomia para organizar e gerenciar a rotina proativamente!
- Você tem autorização para tomar a iniciativa! Ao receber pedidos de organização de rotina, blocos de foco ou resolução de conflitos:
  1. Tome a iniciativa direta: execute os agendamentos, blocos de foco e encaixes na agenda sem hesitar e sem pedir confirmação a cada passo.
  2. Resolva conflitos menores escolhendo o horário livre mais lógico com inteligência executiva.
  3. Relate sucintamente as ações realizadas ao final da resposta com segurança e clareza.
`
	} else {
		autonomySection = `
DIRETRIZ DE NÍVEL DE AUTONOMIA — ASSISTIDO (SECRETÁRIO CONSERVADOR):
- O usuário prefere validação cuidadosa antes de alterações na rotina!
- Sempre que houver necessidade de reorganizar a agenda, reagendar eventos ou criar múltiplos blocos:
  1. Apresente propostas claras e aguarde a confirmação explícita do usuário antes de efetivar mudanças amplas na agenda.
  2. Nunca assuma decisões sem consentimento prévio quando houver impacto ou dúvida no horário.
`
	}

	// Build the system prompt using string concatenation to avoid fmt.Sprintf parsing issues
	var sb strings.Builder
	sb.WriteString("Você é o Vito, secretário executivo pessoal: organiza agenda, tarefas, radares, bookings e memória do usuário com calor executivo.\n")
	sb.WriteString("Capacidades: (1) agenda e recorrências com horário local e conflitos; (2) tarefas/prioridades/prazos; (3) radares nas 12 categorias; (4) memória contínua de hábitos e preferências; (5) voz e leitura de imagens.\n\n")
	sb.WriteString("DATA E HORA ATUAIS DE REFERÊNCIA (Horário Local do Usuário):\n")
	sb.WriteString(fmt.Sprintf("- Data e Hora Atual: %s %s (%s)\n", localDateStr, localTimeStr, localWeekday))
	sb.WriteString(fmt.Sprintf("- Fuso Horário do Usuário: %s (Offset: %s)\n", timezone, offsetStr))
	sb.WriteString(fmt.Sprintf("- Período do Dia: %s\n", localPeriod))
	sb.WriteString(fmt.Sprintf("- Hoje é: %s (%s)\n", localDateStr, localWeekday))
	sb.WriteString(fmt.Sprintf("- Amanhã é: %s (%s)\n", tomorrowDateStr, tomorrowWeekday))
	sb.WriteString(fmt.Sprintf("- UTC de Referência: %s\n", now.UTC().Format(time.RFC3339)))
	sb.WriteString(calRef)
	sb.WriteString(userSection)
	sb.WriteString(memorySection)
	sb.WriteString(scheduleSection)
	sb.WriteString(todoSection)
	sb.WriteString(triggerSection)
	sb.WriteString(bookingSection)
	sb.WriteString(apptsSection)
	sb.WriteString(historySection)
	sb.WriteString(autonomySection)
	sb.WriteString("REGRAS DE RESPOSTA OBRIGATÓRIAS:\n")
	sb.WriteString("Responda EXCLUSIVAMENTE com um objeto JSON válido, sem backticks markdown ou texto extra, no seguinte schema:\n\n")
	sb.WriteString(buildBookingSchemaBlock(timezone))
	sb.WriteString(buildBookingDirectivesBlock(timezone, offsetStr, localDateStr, tomorrowDateStr))

	return sb.String()
}
