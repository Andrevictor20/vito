package ai

import (
	"fmt"
	"strings"
)

// Cognition helpers §8.5–8.6: telemetria compacta + manual RAG modular + CoT.

// BuildAppStateBlock injeta 4-5 flags/contadores (§8.5 Snapshot Compacto).
func BuildAppStateBlock(flags []string) string {
	clean := []string{}
	for _, f := range flags {
		if s := strings.TrimSpace(f); s != "" {
			clean = append(clean, s)
		}
	}
	if len(clean) == 0 {
		return ""
	}
	return "\nESTADO ATUAL DA CONTA NO APP (telemetria):\n- " + strings.Join(clean, "\n- ") + "\n"
}

// ManualModuleFor injeta só o módulo relevante (§8.5 App Manual RAG).
func ManualModuleFor(text string) string {
	t := strings.ToLower(text)
	switch {
	case strings.Contains(t, "booking") || strings.Contains(t, "agendamento") || strings.Contains(t, "link"):
		return "\nMANUAL VITO BOOKING: tipos têm duration 15/30/45/60, buffer, janela start_hour/end_hour, days [1..7]; rota pública /book/{username}/{slug}; cancele por nome/e-mail do convidado.\n"
	case strings.Contains(t, "radar") || strings.Contains(t, "vigília") || strings.Contains(t, "vigilia") || strings.Contains(t, "trigger"):
		return "\nMANUAL RADARES: 12 categorias canônicas; condition daily_brief/price_above/price_below/event_upcoming/change_detected; frequency immediate/hourly/daily_morning/daily_evening; confidence>=75 exige why_relevant.\n" +
			"ALERTAS COMO BASE (Fase 3): o bloco ALERTAS RECENTES DOS RADARES traz os disparos não lidos (título + valor atual). " +
			"Quando o usuário pedir para marcar/agendar algo sobre um alerta (ex: 'marque reunião sobre o que meu radar achou'), monte uma PROPOSTA de evento (título, data, horário) citando o alerta e PERGUNTE antes de criar — nunca crie direto sem dia e hora confirmados (vale a regra de coleta progressiva). " +
			"Quando perguntar 'isso conflita?' ou 'posso nesse horário?', confira contra COMPROMISSOS PRÓXIMOS NA AGENDA, cite o evento concorrente pelo nome e ofereça 2 horários livres próximos.\n"
	case strings.Contains(t, "resumo") || strings.Contains(t, "raio-x") || strings.Contains(t, "raio x") || strings.Contains(t, "semana"):
		return "\nMANUAL RESUMOS: Diário/Semanal/Mensal + Raio-X; ignore all_day/feriado/24h nas horas; use eventos reais e tarefas concluídas.\n"
	case strings.Contains(t, "lembrete") || strings.Contains(t, "tarefa") || strings.Contains(t, "pendência") || strings.Contains(t, "pendencia"):
		return "\nMANUAL TAREFAS: priority low/medium/high; due_date/remind_at em hora local; converta pendência em evento com data+hora.\n"
	default:
		return ""
	}
}

// CoreProfileBlock formata a Camada 1 (sempre presente, 8-10 itens).
func CoreProfileBlock(profiles []string) string {
	clean := []string{}
	for _, p := range profiles {
		if s := strings.TrimSpace(p); s != "" {
			clean = append(clean, s)
		}
	}
	if len(clean) == 0 {
		return ""
	}
	if len(clean) > 10 {
		clean = clean[:10]
	}
	return "\nPERFIL FIXO DO USUÁRIO (regras inegociáveis):\n- " + strings.Join(clean, "\n- ") + "\n"
}

// CoTInstruction é anexada ao schema para raciocínio guiado obrigatório.
func CoTInstruction() string {
	return "\nRACIOCÍNIO GUIADO (obrigatório): preencha primeiro \"thought\" com 2-4 passos (1. fuso/data atual; 2. memórias relevantes; 3. conflitos agenda; 4. ação) e \"context_used\" com os IDs/trechos usados. Só então defina action/message.\n"
}

var _ = fmt.Sprintf
