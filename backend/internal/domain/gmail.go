package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrGmailNotConnected       = errors.New("integração com Gmail não está conectada")
	ErrGmailAuthFailed         = errors.New("falha de autenticação com a API do Gmail")
	ErrGmailInvalidCredentials = errors.New("credenciais do Gmail inválidas ou expiradas")
)

const (
	GmailStatusActive         = "active"
	GmailStatusReauthRequired = "reauth_required"
	GmailStatusDisconnected   = "disconnected"
	GmailStatusError          = "error"
)

// GmailIntegration armazena os tokens criptografados e metadados de sincronização do Gmail.
type GmailIntegration struct {
	ID                   string     `json:"id"`
	UserID               string     `json:"user_id"`
	AccountEmail         string     `json:"account_email"`
	EncryptedCredentials string     `json:"-"`
	Status               string     `json:"status"`
	HistoryID            string     `json:"history_id,omitempty"`
	LastScannedAt        *time.Time `json:"last_scanned_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// ScannedBill representa uma fatura ou boleto bancário identificado no Gmail.
type ScannedBill struct {
	Beneficiary string     `json:"beneficiary"`
	AmountBRL   float64    `json:"amount_brl"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	Barcode     string     `json:"barcode,omitempty"`
	MessageID   string     `json:"message_id"`
	Subject     string     `json:"subject"`
}

// ScannedFlight representa uma confirmação de voo identificada no Gmail.
type ScannedFlight struct {
	Airline     string     `json:"airline"`
	BookingCode string     `json:"booking_code"` // Localizador
	FlightNum   string     `json:"flight_number,omitempty"`
	Origin      string     `json:"origin"`
	Destination string     `json:"destination"`
	DepartureAt *time.Time `json:"departure_at,omitempty"`
	MessageID   string     `json:"message_id"`
	Subject     string     `json:"subject"`
}

// UrgentEmail representa uma mensagem de e-mail importante que aguarda resposta.
type UrgentEmail struct {
	MessageID string    `json:"message_id"`
	From      string    `json:"from"`
	Subject   string    `json:"subject"`
	Snippet   string    `json:"snippet"`
	Date      time.Time `json:"date"`
}

// GmailScanResult consolida a triagem inteligente de e-mails.
type GmailScanResult struct {
	ScannedAt     time.Time       `json:"scanned_at"`
	MessagesRead  int             `json:"messages_read"`
	Bills         []ScannedBill   `json:"bills"`
	Flights       []ScannedFlight `json:"flights"`
	UrgentEmails  []UrgentEmail   `json:"urgent_emails"`
	TasksCreated  int             `json:"tasks_created"`
	EventsCreated int             `json:"events_created"`
}

// GmailRepository abstrai a persistência da integração Gmail no SQLite.
type GmailRepository interface {
	GetByUserID(ctx context.Context, userID string) (*GmailIntegration, error)
	Upsert(ctx context.Context, integration *GmailIntegration) error
	UpdateStatus(ctx context.Context, userID, status string) error
	UpdateLastScanned(ctx context.Context, userID, historyID string, scannedAt time.Time) error
	DeleteByUserID(ctx context.Context, userID string) error
}
