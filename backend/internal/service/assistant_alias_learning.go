package service

import (
	"context"
	"log"
	"strings"
	"time"
)

// rememberUnknownContact guarda o nome que o Vito não conseguiu resolver.
//
// O fluxo: o usuário pergunta "o que a Isa mandou?" → o Vito não conhece "Isa"
// → pergunta "não encontrei, qual o nome?" → o usuário responde "é a Bella" → o
// Vito resolve "Bella" e, com isso, APRENDE que "Isa" é a Bella.
func (s *AssistantService) rememberUnknownContact(userID, query string) {
	if s == nil || userID == "" || strings.TrimSpace(query) == "" {
		return
	}
	s.aliasMu.Lock()
	defer s.aliasMu.Unlock()
	s.pendingAlias = &pendingContactAlias{
		userID:    userID,
		query:     strings.TrimSpace(query),
		createdAt: time.Now().UTC(),
	}
}

// clearPendingContactAlias descarta qualquer pendência de alias zumbi.
func (s *AssistantService) clearPendingContactAlias() {
	if s == nil {
		return
	}
	s.aliasMu.Lock()
	defer s.aliasMu.Unlock()
	s.pendingAlias = nil
}

// learnContactAlias grava o apelido aprendido (pending.query → chatJID).
//
// Regras de segurança estritas:
// 1. Só aprende se a mensagem atual for uma resposta DIRETA de confirmação/desambiguação.
//    Consultas normais ("o que o Pai mandou?") e outros comandos NUNCA aprendem apelido.
// 2. NUNCA grava um apelido cujo nome já coincida com o nome salvo de outro contato real.
// 3. Expira pendências antigas (> 5 minutos).
func (s *AssistantService) learnContactAlias(ctx context.Context, userID, userInput, query, chatJID string) {
	query = strings.TrimSpace(query)
	if s == nil || userID == "" || query == "" || chatJID == "" {
		return
	}
	s.aliasMu.Lock()
	pending := s.pendingAlias
	s.pendingAlias = nil
	s.aliasMu.Unlock()

	if pending == nil || pending.userID != userID || pending.query == "" {
		return
	}
	// Expira pendências com mais de 5 minutos
	if !pending.createdAt.IsZero() && time.Since(pending.createdAt) > 5*time.Minute {
		return
	}
	// Se o próprio nome resolveu, não há nada a aprender
	if strings.EqualFold(pending.query, query) {
		return
	}
	// Só aprende se o input do usuário for uma resposta direta de confirmação/desambiguação!
	if !isDirectContactClarification(userInput, query) {
		log.Printf("⚠️ [AssistantService] não aprendendo apelido: input %q não é resposta direta de confirmação para %q", userInput, pending.query)
		return
	}
	if s.waDirectory == nil {
		return
	}
	// NUNCA grava um apelido cujo nome já coincida com o nome salvo de outro contato real!
	if s.waDirectory.IsRealContactName(ctx, userID, pending.query) {
		log.Printf("⚠️ [AssistantService] recusando gravar apelido %q: coincide com contato real", pending.query)
		return
	}
	if err := s.waDirectory.SaveAlias(ctx, userID, chatJID, pending.query); err != nil {
		log.Printf("⚠️ [AssistantService] falha ao aprender o apelido %q: %v", pending.query, err)
		return
	}
	log.Printf("🏷️ [AssistantService] apelido aprendido com sucesso: %q -> %s", pending.query, chatJID)
}

// isDirectContactClarification informa se o texto do usuário é uma resposta direta
// de confirmação ou desambiguação ("é a Bella", "a Bella", "se chama Bella").
//
// Comandos normais ("o que o Pai mandou?", "leia a conversa com Pedro") e comandos
// de outros módulos devolvem false.
func isDirectContactClarification(userInput, resolvedName string) bool {
	raw := strings.TrimSpace(userInput)
	if raw == "" {
		return false
	}
	lower := strings.ToLower(raw)

	// Se contém padrões de consulta estruturada, pergunta ou verbos de comando,
	// é uma nova consulta a outro contato e NÃO uma confirmação.
	queryPrefixes := []string{
		"o que ", "oque ", "o que o ", "o que a ", "oque o ", "oque a ",
		"leia ", "ler ", "veja ", "ver ", "mostre ", "mostra ", "busca ", "buscar ", "procure ", "procurar ",
		"mensagens ", "mensagem ", "audio ", "áudio ", "conversa com ", "conversa do ", "conversa da ",
	}
	for _, p := range queryPrefixes {
		if strings.HasPrefix(lower, p) {
			return false
		}
	}
	querySuffixesOrKeywords := []string{
		" mandou", " falou", " disse", " enviou", " respondeu",
	}
	for _, k := range querySuffixesOrKeywords {
		if strings.Contains(lower, k) {
			return false
		}
	}

	// Padrões de outros comandos (tarefas, reuniões, etc.)
	commandKeywords := []string{
		"tarefa", "agenda", "reunião", "reuniao", "lembrete", "email", "e-mail",
	}
	for _, k := range commandKeywords {
		if strings.Contains(lower, k) {
			return false
		}
	}

	// Prefixos diretos de resposta de identificação/confirmação
	confirmPrefixes := []string{
		"é a ", "é o ", "é ", "e a ", "e o ", "e ",
		"se chama ", "chama-se ", "chama ",
		"o nome é ", "nome é ", "o nome dela é ", "o nome dele é ",
		"ela é a ", "ele é o ", "ela é ", "ele é ",
		"na verdade é ", "me refiro a ", "falei de ", "quis dizer ",
		"isso, ", "isso mesmo, ", "isso ", "isso mesmo ",
		"sim, ", "sim ", "exato, ", "exato ", "correto, ", "correto ",
		"pode ser a ", "pode ser o ", "pode ser ",
	}
	for _, p := range confirmPrefixes {
		if strings.HasPrefix(lower, p) {
			return true
		}
	}

	// Suporte a sentenças de equivalência com 'é' (ex: "Bella é a Isa", "a Isa é a Bella")
	if strings.Contains(lower, " é ") || strings.Contains(lower, " e ") {
		if contactNameMatches(lower, resolvedName) || strings.Contains(lower, strings.ToLower(resolvedName)) {
			return true
		}
	}

	// Resposta curta apenas com o nome da pessoa (ex: "Bella", "a Bella")
	words := strings.Fields(lower)
	if len(words) <= 3 {
		cleaned := lower
		for _, article := range []string{"a ", "o "} {
			if strings.HasPrefix(cleaned, article) {
				cleaned = strings.TrimPrefix(cleaned, article)
			}
		}
		if contactNameMatches(cleaned, resolvedName) {
			return true
		}
	}

	return false
}
