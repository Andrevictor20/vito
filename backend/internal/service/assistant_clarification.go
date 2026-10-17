package service

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/assistant"
)

// clarificationResponse monta uma resposta de pergunta sem tocar no banco.
// O mobile exibe Message/Reply como bolha do Vito e o histórico mantém o contexto.
func clarificationResponse(intent *ai.ParsedIntent, question string) *AssistantResponse {
	msg := assistant.ClarificationMessage(question)
	provider := ""
	if intent != nil {
		provider = intent.ProviderUsed
	}
	return &AssistantResponse{
		Action:       ai.ActionNeedsClarification,
		Intent:       string(ai.ActionNeedsClarification),
		Message:      msg,
		Reply:        msg,
		ProviderUsed: provider,
	}
}

// defaultMessageFor evita bolhas vazias quando a IA retorna action sem message.
func defaultMessageFor(action ai.IntentAction) string {
	return assistant.DefaultMessageFor(action)
}

// isVagueBookingRequest detecta pedido de booking sem nenhum detalhe útil.
// Evita criar "Reunião de Alinhamento" silenciosamente quando o usuário só disse "crie um booking".
func isVagueBookingRequest(text string) bool { return assistant.IsVagueBookingRequest(text) }

// isBookingIntentText detecta pedido de link de agendamento por sinônimos diretos.
func isBookingIntentText(text string) bool { return assistant.IsBookingIntentText(text) }

// ExportedIsBookingIntentText expõe isBookingIntentText para testes de regressão.
func ExportedIsBookingIntentText(text string) bool { return isBookingIntentText(text) }

// ExportedInferBookingDays expõe inferBookingDaysOfWeek para testes de regressão.
func ExportedInferBookingDays(text string) string { return inferBookingDaysOfWeek(text) }

// inferBookingDaysOfWeek deriva a janela semanal; default 7 dias (inclui fds e feriados).
func inferBookingDaysOfWeek(text string) string { return assistant.InferBookingDaysOfWeek(text) }

// IsSafeMemoryContent aplica validação heurística semântica contra injeção persistente de prompt
// (Context Poisoning Defense - Sprint 13) antes de gravar fatos na tabela memories.
func IsSafeMemoryContent(content string) bool {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" || len(trimmed) > 500 {
		return false
	}
	lower := strings.ToLower(trimmed)
	poisonPatterns := []string{
		"ignore todas as instruções",
		"ignore as instruções",
		"ignore previous",
		"ignore all previous",
		"system prompt",
		"instrução de sistema",
		"instrucoes de sistema",
		"apague todos os eventos",
		"delete all events",
		"sem pedir confirmação",
		"sem confirmacao",
		"<untrusted_",
		"</untrusted_",
		"<script",
		"modo desenvolvedor",
		"jailbreak",
		"você agora é",
		"override system",
	}
	for _, pat := range poisonPatterns {
		if strings.Contains(lower, pat) {
			return false
		}
	}
	return true
}

func (s *AssistantService) persistLearnedMemory(userID, category, content string) {
	content = strings.TrimSpace(content)
	if !IsSafeMemoryContent(content) {
		return
	}
	if category == "" {
		category = "geral"
	}

	// Consolidação em tempo real (§8.4 ciclo 1): ADD | SUPERSEDE | NOOP.
	newID := uuid.New().String()
	if mems, err := s.memoryRepo.SearchRelevant(userID, content, 5); err == nil {
		contentLower := strings.ToLower(content)
		for _, m := range mems {
			existing := strings.ToLower(strings.TrimSpace(m.Content))
			if existing == contentLower {
				// NOOP: fato conhecido, só reforça a confiança.
				_ = s.memoryRepo.Reinforce(m.ID, userID)
				return
			}
			if sameTopic(existing, contentLower) {
				// UPDATE/SUPERSEDE: hábito mudou, preserva histórico sem poluir o prompt.
				_ = s.memoryRepo.Supersede(m.ID, userID, newID)
				break
			}
		}
	}

	mem := &domain.Memory{
		ID:         newID,
		UserID:     userID,
		Category:   category,
		Content:    content,
		Importance: 3,
		Confidence: 1.0,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	_ = s.memoryRepo.Create(mem)
}

// sameTopic delega ao subpacote assistant (BACK-01).
func sameTopic(a, b string) bool { return assistant.SameTopic(a, b) }

// isExplicitDeleteConfirmation verifica se o texto do usuário contém confirmação explícita para exclusão em massa.
func isExplicitDeleteConfirmation(text string) bool {
	lower := strings.ToLower(strings.TrimSpace(text))
	confirmKeywords := []string{
		"confirmar exclusão",
		"confirmar exclusao",
		"confirmo a exclusão",
		"confirmo a exclusao",
		"pode apagar tudo",
		"sim, apague",
		"sim, exclua",
		"[confirmed]",
	}
	for _, kw := range confirmKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

