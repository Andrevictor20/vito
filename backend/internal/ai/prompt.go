package ai

import (
	"fmt"
	"strings"
	"time"
	_ "time/tzdata"
)

// BuildSystemPrompt gera as instruções de sistema para a IA operar como o secretário executivo Vito.
func BuildSystemPrompt(now time.Time, timezone string, memories ...string) string {
	return BuildSystemPromptWithFullContext(now, timezone, memories, nil, nil, nil, nil, "")
}

// BuildSystemPromptFromInput gera o prompt enriquecido com todas as camadas de contexto a partir de UserInput.
func BuildSystemPromptFromInput(input UserInput) string {
	base := BuildSystemPromptWithBookingContext(
		input.Now,
		input.Timezone,
		input.ContextMemories,
		input.ActiveSchedule,
		input.PendingTodos,
		input.ActiveTriggers,
		input.ActiveBookings,
		input.UpcomingAppointments,
		input.ConversationHistory,
		input.UserName,
		input.AutonomyMode,
	)
	// §8.5–8.6: blocos cognitivos opcionais (retrocompatível: vazios = sem bloco).
	extra := CoreProfileBlock(input.CoreProfile) + BuildAppStateBlock(input.AppStateFlags) + ManualModuleFor(input.Text) + TriggerAlertsBlock(input.ActiveTriggerAlerts) + RecentEmailsBlock(input.RecentEmails) + GmailAssistantDirectives(input.AppStateFlags, input.RecentEmails) + FocusModeBlock(input.FocusMode) + CoTInstruction()
	extra += QuotedContextBlock(input.QuotedContext) + ConversationWindowBlock(input.ConversationWindow) + WhatsAppContextDirectives(input.QuotedContext, input.ConversationWindow)
	extra += ContactDirectoryBlock(input.ContactDirectory) + PendingConversationsBlock(input.PendingConversations) + WhatsAppAssistantDirectives(input.ContactDirectory, input.PendingConversations)
	if extra == CoTInstruction() {
		return base + extra
	}
	return base + extra
}

// FocusModeBlock injeta diretriz prioritária de foco cognitivo quando selecionado pelo usuário.
func FocusModeBlock(focusMode string) string {
	switch strings.ToLower(strings.TrimSpace(focusMode)) {
	case "calendar":
		return "\n🎯 MODO DE FOCO ATIVO: AGENDA & EVENTOS\nPriorize estritamente compromissos, checagem de horários, conflitos de agenda, buffers e organização temporal. Suas respostas e ações devem girar em torno da agenda do usuário.\n"
	case "tasks":
		return "\n🎯 MODO DE FOCO ATIVO: TAREFAS & PRIORIDADES\nPriorize estritamente afazeres, prazos, prioridades (alta/média/baixa) e desdobramento em subtarefas acionáveis. Suas respostas e ações devem focar na produtividade e execução de tarefas.\n"
	case "triggers":
		return "\n🎯 MODO DE FOCO ATIVO: VIGÍLIAS & RADARES\nPriorize monitoramento contínuo, faturas, editais, concursos, passagens, oportunidades e alertas automatizados em tempo real.\n"
	case "meetings":
		return "\n🎯 MODO DE FOCO ATIVO: BOOKING & REUNIÕES\nPriorize links de agendamento público 1-on-1, pesquisas de consenso de horários de grupo e gestão de reuniões recebidas.\n"
	case "briefing":
		return "\n🎯 MODO DE FOCO ATIVO: BRIEFING EXECUTIVO\nForneça uma síntese panorâmica ultra-executiva, direta ao ponto, correlacionando agenda do dia, tarefas prioritárias, vigílias ativas e recomendações imediatas de ação.\n"
	case "memory":
		return "\n🎯 MODO DE FOCO ATIVO: MEMÓRIA & ROTINAS\nPriorize preferências pessoais, hábitos duradouros, histórico de decisões, contexto pessoal e rotinas comportamentais do usuário.\n"
	default:
		return ""
	}
}

// RecentEmailsBlock injeta resumos de e-mails, boletos e voos do Gmail.
func RecentEmailsBlock(emails []string) string {
	var lines []string
	for _, e := range emails {
		if strings.TrimSpace(e) != "" {
			lines = append(lines, e)
		}
	}
	if len(lines) == 0 {
		return ""
	}
	out := "\nE-MAILS RECENTES ENCONTRADOS NO GMAIL DO USUÁRIO (base para responder sobre faturas, boletos, viagens e mensagens recentes):\n"
	for _, l := range lines {
		out += fmt.Sprintf("- %s\n", l)
	}
	return out
}

// TriggerAlertsBlock injeta os alertas não lidos dos radares (Fase 3).
func TriggerAlertsBlock(alerts []string) string {
	var lines []string
	for _, a := range alerts {
		if strings.TrimSpace(a) != "" {
			lines = append(lines, a)
		}
	}
	if len(lines) == 0 {
		return ""
	}
	out := "\nALERTAS RECENTES DOS RADARES (base para conversar, propor eventos e checar conflitos):\n"
	for _, l := range lines {
		out += fmt.Sprintf("- %s\n", l)
	}
	return out
}

// BuildSystemPromptWithContext constrói o prompt mantendo compatibilidade com assinaturas anteriores.
func BuildSystemPromptWithContext(now time.Time, timezone string, memories []string, activeSchedule []string, pendingTodos []string) string {
	return BuildSystemPromptWithFullContext(now, timezone, memories, activeSchedule, pendingTodos, nil, nil, "")
}

// BuildSystemPromptWithFullContext constrói o prompt completo injetando tempo, memórias, agenda, tarefas, disparadores e histórico recente.
func BuildSystemPromptWithFullContext(
	now time.Time,
	timezone string,
	memories []string,
	activeSchedule []string,
	pendingTodos []string,
	activeTriggers []string,
	history []ChatMessageContext,
	userName string,
	autonomyMode ...string,
) string {
	mode := ""
	if len(autonomyMode) > 0 {
		mode = autonomyMode[0]
	}
	return BuildSystemPromptWithBookingContext(
		now,
		timezone,
		memories,
		activeSchedule,
		pendingTodos,
		activeTriggers,
		nil,
		nil,
		history,
		userName,
		mode,
	)
}