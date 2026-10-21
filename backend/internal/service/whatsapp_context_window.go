package service

import (
	"context"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// sensitiveContextPattern identifica mensagens que NÃO devem entrar na janela
// de contexto: o shadow inbox arquiva TUDO que chega na instância, inclusive os
// códigos de acesso/OTP que o Vito envia no login por WhatsApp. Sem este filtro
// esses segredos iam para o prompt (e para a LLM de terceiro).
var sensitiveContextPattern = regexp.MustCompile(`(?i)(c[oó]digo\s+(de\s+acesso|de\s+verifica|otp|do\s+vito)|verification\s+code|access\s+code|senha\s*(é|:|\b)|sua\s+senha|one[-\s]?time\s+password)`)

// isSensitiveContextMessage diz se a mensagem é um segredo que não pode ir
// para a janela de contexto.
func isSensitiveContextMessage(text string) bool {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return true
	}
	if sensitiveContextPattern.MatchString(trimmed) {
		return true
	}
	// Código isolado ("216637", "ok 216637", "216 637"): a mensagem é
	// essencialmente um bloco de 4 a 8 dígitos. A regra usa o MAIOR bloco
	// CONTÍGUO de dígitos — assim "12 10 15" (data) e "ganhei 1000000"
	// (valor em reais) continuam sendo mensagens legítimas.
	if len([]rune(trimmed)) <= 24 && !strings.Contains(trimmed, "R$") {
		maxRun, letters := 0, 0
		run := 0
		for _, r := range trimmed {
			switch {
			case r >= '0' && r <= '9':
				run++
				if run > maxRun {
					maxRun = run
				}
			case (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z'):
				letters++
				run = 0
			default:
				run = 0
			}
		}
		if letters <= 3 && maxRun >= 4 && maxRun <= 8 {
			return true
		}
	}
	return false
}

// maxMessagesPerChatInWindow limita quantas mensagens de um MESMO chat entram na
// parte cross-chat da janela. Sem esse teto, uma conversa muito ativa (o chat
// "Você") expulsa as outras — e o Vito nunca via a conversa que o usuário
// estava retomando.
const maxMessagesPerChatInWindow = 3

// crossChatWindow monta a janela com diversidade: metade do chat em que o Vito
// foi acionado e metade distribuída pelos demais chats (no máximo
// maxMessagesPerChatInWindow de cada), do mais recente para o mais antigo.
func (s *WhatsAppContextService) crossChatWindow(ctx context.Context, userID, chatJID string, size int, since time.Time) []domain.WhatsAppConversationMessage {
	half := size / 2
	if half < 1 {
		half = 1
	}
	otherLimit := size - half

	selected := make([]domain.WhatsAppConversationMessage, 0, size)

	current, err := s.repo.RecentMessages(ctx, userID, chatJID, half+1, since)
	if err == nil && len(current) > half {
		current = current[len(current)-half:]
	}
	selected = append(selected, current...)

	others, err := s.repo.RecentMessagesAcrossChats(ctx, userID, size*4, since)
	if err == nil {
		perChat := make(map[string]int, 8)
		chosen := 0
		for i := len(others) - 1; i >= 0 && chosen < otherLimit; i-- {
			m := others[i]
			if m.ChatJID == chatJID {
				continue
			}
			if perChat[m.ChatJID] >= maxMessagesPerChatInWindow {
				continue
			}
			perChat[m.ChatJID]++
			selected = append(selected, m)
			chosen++
		}
	}

	sort.SliceStable(selected, func(i, j int) bool {
		return selected[i].MessageTimestamp.Before(selected[j].MessageTimestamp)
	})
	if len(selected) > size {
		selected = selected[len(selected)-size:]
	}
	return selected
}
