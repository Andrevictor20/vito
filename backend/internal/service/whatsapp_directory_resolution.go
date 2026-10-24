package service

import (
	"sort"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// DeduplicateCandidates avalia os matches encontrados para uma busca de chat e:
// 1. Deduplica chats por JID;
// 2. Se todos os matches restantes tiverem o mesmo rótulo normalizado (ex: múltiplos
//    chats para "Bella", como @lid e @s.whatsapp.net), resolve automaticamente
//    para o chat mais apropriado sem disparar erro de ambiguidade espúria ("bella ou bella?");
// 3. Se houver nomes realmente distintos (ex: "Ana" e "Ana Souza"), retorna ErrAmbiguousChat
//    com os nomes únicos e ordenados, sem nunca duplicar opções no prompt.
func DeduplicateCandidates(
	query string,
	matches []domain.WhatsAppChatSummary,
	labelFn func(domain.WhatsAppChatSummary) string,
) (*domain.WhatsAppChatSummary, error) {
	if len(matches) == 0 {
		return nil, nil
	}
	if len(matches) == 1 {
		return &matches[0], nil
	}

	// 1) Deduplica por JID idêntico
	seenJID := make(map[string]bool, len(matches))
	uniqueJIDMatches := make([]domain.WhatsAppChatSummary, 0, len(matches))
	for _, m := range matches {
		jid := strings.TrimSpace(m.ChatJID)
		if jid == "" || seenJID[jid] {
			continue
		}
		seenJID[jid] = true
		uniqueJIDMatches = append(uniqueJIDMatches, m)
	}

	if len(uniqueJIDMatches) == 1 {
		return &uniqueJIDMatches[0], nil
	}
	if len(uniqueJIDMatches) == 0 {
		return nil, nil
	}

	// 2) Agrupa os rótulos normalizados
	labelCount := make(map[string]int)
	uniqueLabels := make([]string, 0, len(uniqueJIDMatches))
	seenLabel := make(map[string]bool)

	for _, m := range uniqueJIDMatches {
		lbl := strings.TrimSpace(labelFn(m))
		if lbl == "" {
			lbl = "Contato"
		}
		norm := normalizeContactName(lbl)
		labelCount[norm]++

		if !seenLabel[lbl] {
			seenLabel[lbl] = true
			uniqueLabels = append(uniqueLabels, lbl)
		}
	}

	// Caso A: Todos os matches compartilham o mesmo nome normalizado (ex: múltiplos chats de "Bella").
	// Não há ambiguidade conceitual de nome para o usuário. Selecionamos o melhor chat.
	if len(labelCount) == 1 {
		return pickBestChatMatch(uniqueJIDMatches), nil
	}

	// Caso B: Há mais de um nome único após deduplicação (ex: "Ana" e "Ana Souza").
	// Se apenas 1 nome único sobrou, escolhe o melhor match desse nome.
	if len(uniqueLabels) == 1 {
		return pickBestChatMatch(uniqueJIDMatches), nil
	}

	// Se houver nomes distintos, ordena e retorna ambiguidade limpa sem duplicações.
	sort.Strings(uniqueLabels)
	return nil, &ErrAmbiguousChat{
		Query:      query,
		Candidates: uniqueLabels,
	}
}

// pickBestChatMatch escolhe a conversa mais relevante dentre matches do mesmo contato:
// 1. Conversa direta (direct) tem prioridade sobre grupos/broadcasts;
// 2. Chat @s.whatsapp.net tem preferência se tiver histórico recente;
// 3. Conversa com interação mais recente (LastAt).
func pickBestChatMatch(matches []domain.WhatsAppChatSummary) *domain.WhatsAppChatSummary {
	if len(matches) == 0 {
		return nil
	}
	best := &matches[0]

	for i := 1; i < len(matches); i++ {
		candidate := &matches[i]

		// 1) Preferência por conversa direta
		if best.ChatKind != domain.WhatsAppChatKindDirect && candidate.ChatKind == domain.WhatsAppChatKindDirect {
			best = candidate
			continue
		}
		if best.ChatKind == domain.WhatsAppChatKindDirect && candidate.ChatKind != domain.WhatsAppChatKindDirect {
			continue
		}

		// 2) Preferência por @s.whatsapp.net se ambos forem diretos e próximos no tempo
		bestIsLID := strings.HasSuffix(best.ChatJID, "@lid")
		candIsLID := strings.HasSuffix(candidate.ChatJID, "@lid")
		if bestIsLID && !candIsLID {
			// Se o candidato não-LID for recente (ou a diferença for menor que 24h), prefere o padrão @s.whatsapp.net
			if best.LastAt.Sub(candidate.LastAt) < 24*time.Hour {
				best = candidate
				continue
			}
		}

		// 3) Preferência pelo mais recente
		if candidate.LastAt.After(best.LastAt) {
			best = candidate
		}
	}

	return best
}
