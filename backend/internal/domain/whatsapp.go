package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrWhatsAppIntegrationNotFound = errors.New("integração do WhatsApp não encontrada")
	ErrWhatsAppInvalidPhone        = errors.New("número de telefone inválido para WhatsApp")
	ErrWhatsAppAlreadyConnecting   = errors.New("já existe uma tentativa de conexão em andamento")
)

const (
	WhatsAppStatusDisconnected = "disconnected"
	WhatsAppStatusConnecting   = "connecting"
	WhatsAppStatusConnected    = "connected"
)

// WhatsAppIntegration armazena os dados da sessão do WhatsApp via Evolution API.
type WhatsAppIntegration struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	InstanceName    string     `json:"instance_name"`
	Phone           string     `json:"phone,omitempty"`
	Status          string     `json:"status"` // "disconnected", "connecting", "connected"
	PairingCode     string     `json:"pairing_code,omitempty"`
	LastConnectedAt *time.Time `json:"last_connected_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// WhatsAppRepository define o contrato de persistência para as sessões do WhatsApp.
type WhatsAppRepository interface {
	GetByUserID(ctx context.Context, userID string) (*WhatsAppIntegration, error)
	GetByInstanceName(ctx context.Context, instanceName string) (*WhatsAppIntegration, error)
	Upsert(ctx context.Context, integration *WhatsAppIntegration) error
	UpdateStatus(ctx context.Context, id string, status string, lastConnectedAt *time.Time) error
	Delete(ctx context.Context, userID string) error
}
