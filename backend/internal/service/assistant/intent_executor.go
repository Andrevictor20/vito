package assistant

import "strings"

// IntentExecutor: decisão de consolidação de memória (§8.4 ciclo 1).
// Puro e testável: ADD | SUPERSEDE | NOOP.

type MemoryOp string

const (
	OpAdd       MemoryOp = "ADD"
	OpSupersede MemoryOp = "SUPERSEDE"
	OpNoop      MemoryOp = "NOOP"
)

// DecideMemoryOp compara o novo fato com os 5 mais similares.
// Retorna a operação e o índice do candidato (ou -1).
func DecideMemoryOp(existing []string, content string) (MemoryOp, int) {
	contentLower := strings.ToLower(strings.TrimSpace(content))
	if contentLower == "" {
		return OpNoop, -1
	}
	for i, e := range existing {
		if strings.ToLower(strings.TrimSpace(e)) == contentLower {
			return OpNoop, i
		}
	}
	for i, e := range existing {
		if SameTopic(strings.ToLower(strings.TrimSpace(e)), contentLower) {
			return OpSupersede, i
		}
	}
	return OpAdd, -1
}
