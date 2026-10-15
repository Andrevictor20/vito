package ai

import "strings"

// AIErrorClass classifica falhas de provedor sem vazar segredos ao cliente.
type AIErrorClass string

const (
	AIErrorQuota   AIErrorClass = "quota"
	AIErrorAuth    AIErrorClass = "auth"
	AIErrorTimeout AIErrorClass = "timeout"
	AIErrorParse   AIErrorClass = "parse"
	AIErrorUnknown AIErrorClass = "unknown"
)

// ClassifyAIError mapeia o erro (em geral embrulhado como
// "falha ao interpretar comando com IA: todos os provedores falharam (...)")
// para a classe tratável. Ordem importa: quota antes de genéricos.
func ClassifyAIError(err error) AIErrorClass {
	if err == nil {
		return AIErrorUnknown
	}
	msg := strings.ToLower(err.Error())
	containsAny := func(subs ...string) bool {
		for _, s := range subs {
			if strings.Contains(msg, s) {
				return true
			}
		}
		return false
	}
	switch {
	case containsAny("429", "quota", "rate limit", "rate_limit", "resource_exhausted", "too many requests"):
		return AIErrorQuota
	case containsAny("401", "403", "unauthorized", "forbidden", "invalid_request", "model_not_found", "does not exist", "api key", "chave de api", "invalid api key", "incorrect api key"):
		return AIErrorAuth
	case containsAny("deadline exceeded", "timeout", "timed out", "temporarily", "dial tcp", "connection refused", "connection reset", "no such host", "tls", "eof", "context canceled", "client timeout"):
		return AIErrorTimeout
	case containsAny("invalid character", "unexpected end", "cannot unmarshal", "json", "resposta vazia", "nenhuma resposta", "empty response", "sintaxe"):
		return AIErrorParse
	default:
		return AIErrorUnknown
	}
}

// FriendlyAIMessage devolve a mensagem honesta ao usuário (sem segredos,
// sempre com a garantia de nada-criado).
func FriendlyAIMessage(class AIErrorClass) string {
	const guarantee = "Nada foi criado ou apagado."
	switch class {
	case AIErrorQuota:
		return "A IA está sobrecarregada agora (limite de uso atingido). Tente de novo em instantes. " + guarantee
	case AIErrorTimeout:
		return "A IA demorou além do limite para responder. Tente de novo. " + guarantee
	case AIErrorAuth:
		return "Não consegui processar agora por instabilidade na IA. " + guarantee + " Tente de novo em instantes."
	default:
		return "Não consegui processar agora por instabilidade na IA ou na rede. " + guarantee + " Tente de novo em instantes com mais detalhes (ex: 'Criar evento Dentista amanhã às 14h')."
	}
}
