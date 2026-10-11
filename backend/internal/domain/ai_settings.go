package domain

import (
	"errors"
	"time"
)

var (
	ErrInvalidAutonomyMode = errors.New("modo de autonomia inválido (deve ser 'assisted' ou 'proactive')")
)

// AutonomyMode define o nível de proatividade da IA ao lidar com a rotina do usuário.
type AutonomyMode string

const (
	AutonomyModeAssisted  AutonomyMode = "assisted"
	AutonomyModeProactive AutonomyMode = "proactive"
)

// AISettings define as preferências de governança e autonomia da inteligência do Vito.
type AISettings struct {
	UserID          string       `json:"user_id"`
	AutonomyMode    AutonomyMode `json:"autonomy_mode"` // "assisted" | "proactive"
	AutoFocusBlocks bool         `json:"auto_focus_blocks"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
}

// DefaultAISettings retorna os valores padrão de fábrica (Modo Assistido).
func DefaultAISettings(userID string) *AISettings {
	now := time.Now().UTC()
	return &AISettings{
		UserID:          userID,
		AutonomyMode:    AutonomyModeAssisted,
		AutoFocusBlocks: false,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}

// AISettingsRepository define o contrato de persistência para as configurações de IA do usuário.
type AISettingsRepository interface {
	GetSettings(userID string) (*AISettings, error)
	UpsertSettings(settings *AISettings) error
}
