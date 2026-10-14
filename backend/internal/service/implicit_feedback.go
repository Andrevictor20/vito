package service

import (
	"fmt"
	"strings"
	"time"
)

// ImplicitFeedbackHook é configurado no bootstrap (main.go) com o memoryRepo.
// Permite Ciclo 2 (§8.4) sem quebrar construtores de Todo/CalendarService.
var ImplicitFeedbackHook func(userID, insight string)

// BuildCorrectionInsight compara antes/depois e gera padrão aprendido.
// Retorna "" quando não há aprendizado relevante.
func BuildCorrectionInsight(entity, before, after string, createdAt, updatedAt time.Time) string {
	if ImplicitFeedbackDisabled {
		return ""
	}
	if strings.TrimSpace(before) == "" || strings.TrimSpace(after) == "" {
		return ""
	}
	if strings.EqualFold(strings.TrimSpace(before), strings.TrimSpace(after)) {
		return ""
	}
	// Só considera correção rápida (≤15min após criação) — sinal forte de correção de IA.
	if createdAt.IsZero() || updatedAt.IsZero() {
		return ""
	}
	if updatedAt.Sub(createdAt) > 15*time.Minute {
		return ""
	}
	return fmt.Sprintf("Correção de %s: era '%s', usuário ajustou para '%s'. Prefira o padrão corrigido em criações futuras.", entity, before, after)
}

// ImplicitFeedbackDisabled permite desligar o Ciclo 2 via env/config.
var ImplicitFeedbackDisabled = false

func emitImplicitFeedback(userID, insight string) {
	if insight == "" || ImplicitFeedbackHook == nil {
		return
	}
	ImplicitFeedbackHook(userID, insight)
}
