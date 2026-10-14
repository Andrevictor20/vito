package domain

import "time"

// CoreProfile — §8.2 Camada 1: identidade, profissão, regras inegociáveis (UPSERT por key).
type CoreProfile struct {
	UserID    string    `json:"user_id"`
	Key       string    `json:"profile_key"`
	Value     string    `json:"profile_value"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CoreProfileRepository persiste o perfil fixo (8-10 itens, sempre no System Prompt).
type CoreProfileRepository interface {
	GetAll(userID string) ([]CoreProfile, error)
	Set(userID, key, value string) error
}
