package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrInvalidPlan          = errors.New("plano inválido (deve ser 'free', 'pro' ou 'ultra')")
	ErrInvalidBillingCycle  = errors.New("ciclo de cobrança inválido (deve ser 'month' ou 'year')")
	ErrInvalidDeleteConfirm = errors.New("confirmação inválida: digite EXCLUIR para confirmar")
	ErrInvalidReportReason  = errors.New("motivo da denúncia é obrigatório")
	ErrInvalidSupportMsg    = errors.New("mensagem de suporte é obrigatória")
)

// SubscriptionPlan define os planos disponíveis na loja (#s-store › pro).
type SubscriptionPlan string

const (
	PlanFree  SubscriptionPlan = "free"
	PlanPro   SubscriptionPlan = "pro"
	PlanUltra SubscriptionPlan = "ultra"
)

// BillingCycle define o ciclo de cobrança da assinatura.
type BillingCycle string

const (
	BillingCycleMonth BillingCycle = "month"
	BillingCycleYear  BillingCycle = "year"
)

// UserSubscription representa o estado da assinatura do usuário.
type UserSubscription struct {
	UserID         string           `json:"user_id"`
	Plan           SubscriptionPlan `json:"plan"`
	BillingCycle   BillingCycle     `json:"billing_cycle"`
	Status         string           `json:"status"` // "inactive", "trialing", "active", "cancelled"
	TrialEndsAt    *time.Time       `json:"trial_ends_at,omitempty"`
	RenewsAt       *time.Time       `json:"renews_at,omitempty"`
	StoreTokenHash string           `json:"-"`
	HasStoreToken  bool             `json:"has_store_token"`
	UpdatedAt      time.Time        `json:"updated_at"`
}

// DefaultUserSubscription retorna a assinatura gratuita padrão.
func DefaultUserSubscription(userID string) *UserSubscription {
	return &UserSubscription{
		UserID:       userID,
		Plan:         PlanFree,
		BillingCycle: BillingCycleMonth,
		Status:       "inactive",
		UpdatedAt:    time.Now().UTC(),
	}
}

// DevicePermissions reflete o estado das permissões sincronizadas pelo app.
type DevicePermissions struct {
	Notifications bool `json:"notifications"`
	Calendar      bool `json:"calendar"`
	Microphone    bool `json:"microphone"`
	Contacts      bool `json:"contacts"`
	Location      bool `json:"location"`
}

// PrivacySettings armazena preferências de privacidade e compartilhamento (#s-store › priv).
type PrivacySettings struct {
	UserID              string            `json:"user_id"`
	AIProcessingEnabled bool              `json:"ai_processing_enabled"`
	AnalyticsEnabled    bool              `json:"analytics_enabled"`
	Permissions         DevicePermissions `json:"permissions"`
	UpdatedAt           time.Time         `json:"updated_at"`
}

// DefaultPrivacySettings retorna os valores padrão de privacidade.
func DefaultPrivacySettings(userID string) *PrivacySettings {
	return &PrivacySettings{
		UserID:              userID,
		AIProcessingEnabled: true,
		AnalyticsEnabled:    true,
		Permissions: DevicePermissions{
			Notifications: true,
			Calendar:      true,
		},
		UpdatedAt: time.Now().UTC(),
	}
}

// PrivacySettingsUpdate representa atualização parcial de privacidade.
type PrivacySettingsUpdate struct {
	AIProcessingEnabled *bool              `json:"ai_processing_enabled,omitempty"`
	AnalyticsEnabled    *bool              `json:"analytics_enabled,omitempty"`
	Permissions         *DevicePermissions `json:"permissions,omitempty"`
}

// ComplianceRequestKind identifica solicitações LGPD.
type ComplianceRequestKind string

const (
	ComplianceKindExportJSON    ComplianceRequestKind = "export_json"
	ComplianceKindDeleteAccount ComplianceRequestKind = "delete_account"
)

// AccountComplianceRequest registra pedidos de exportação ou exclusão LGPD.
type AccountComplianceRequest struct {
	ID           string                `json:"id"`
	UserID       string                `json:"user_id"`
	Kind         ComplianceRequestKind `json:"kind"`
	Status       string                `json:"status"`
	RequestedAt  time.Time             `json:"requested_at"`
	ScheduledFor *time.Time            `json:"scheduled_for,omitempty"`
}

// AIContentReport registra denúncias de respostas da IA (#s-store › help).
type AIContentReport struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ThreadID  string    `json:"thread_id,omitempty"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

// SupportRequest registra mensagens enviadas ao suporte (#s-store › help).
type SupportRequest struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Subject   string    `json:"subject"`
	Message   string    `json:"message"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// LGPDExportBundle agrupa os dados portáveis do usuário autenticado.
type LGPDExportBundle struct {
	RequestID  string                `json:"request_id"`
	Kind       ComplianceRequestKind `json:"kind"`
	Status     string                `json:"status"`
	ExportedAt time.Time             `json:"exported_at"`
	Data       LGPDExportData        `json:"data"`
}

// LGPDExportData contém todas as coleções do usuário sem campos sensíveis (ex.: password_hash).
type LGPDExportData struct {
	User                    *User                    `json:"user,omitempty"`
	Events                  []Event                  `json:"events"`
	Todos                   []Todo                   `json:"todos"`
	Memories                []Memory                 `json:"memories"`
	Bots                    []Bot                    `json:"bots"`
	Notifications           []UserNotification       `json:"notifications"`
	NotificationPreferences *NotificationPreferences `json:"notification_preferences,omitempty"`
	PrivacySettings         *PrivacySettings         `json:"privacy_settings,omitempty"`
	Subscription            *UserSubscription        `json:"subscription,omitempty"`
}

// StoreComplianceRepository define o contrato de persistência de assinaturas, privacidade e conformidade.
type StoreComplianceRepository interface {
	GetSubscription(ctx context.Context, userID string) (*UserSubscription, error)
	UpsertSubscription(ctx context.Context, sub *UserSubscription) error
	GetPrivacySettings(ctx context.Context, userID string) (*PrivacySettings, error)
	UpsertPrivacySettings(ctx context.Context, settings *PrivacySettings) error
	CreateComplianceRequest(ctx context.Context, req *AccountComplianceRequest) error
	ListComplianceRequests(ctx context.Context, userID string) ([]AccountComplianceRequest, error)
	CreateAIReport(ctx context.Context, rep *AIContentReport) error
	CreateSupportRequest(ctx context.Context, req *SupportRequest) error
	CollectLGPDExportData(ctx context.Context, userID string) (*LGPDExportData, error)
}
