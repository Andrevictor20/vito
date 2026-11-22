package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotificationNotFound      = errors.New("notificação não encontrada")
	ErrInvalidNotificationAction = errors.New("ação de notificação inválida")
	ErrInvalidNotificationType   = errors.New("tipo de notificação inválido")
)

// NotificationType classifica o card na Central de Notificações (#s-notifs).
type NotificationType string

const (
	NotificationTypeApprove NotificationType = "aprovar"
	NotificationTypeAlert   NotificationType = "alerta"
	NotificationTypeInfo    NotificationType = "info"
)

// NotificationAction descreve um botão de ação inline exibido no card da central.
type NotificationAction struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Style string `json:"style,omitempty"` // "primary" | "secondary" | "danger"
}

// UserNotification representa uma notificação persistida na caixa do usuário.
type UserNotification struct {
	ID           string               `json:"id"`
	UserID       string               `json:"user_id"`
	GroupKey     string               `json:"group_key"`     // "Agora", "Hoje", "Ontem"
	Type         NotificationType     `json:"type"`          // "aprovar", "alerta", "info"
	SourceDomain string               `json:"source_domain"` // "bots", "tarefas", "financas", "booking", "agenda", "resumo", "sistema"
	SourceID     string               `json:"source_id,omitempty"`
	BotID        string               `json:"bot_id,omitempty"`
	Title        string               `json:"title"`
	Body         string               `json:"body"`
	ActionsJSON  string               `json:"-"`
	Actions      []NotificationAction `json:"actions"`
	IsUnread     bool                 `json:"is_unread"`
	IsDismissed  bool                 `json:"is_dismissed"`
	CreatedAt    time.Time            `json:"created_at"`
}

// NotificationInboxFilter filtra a listagem da caixa de notificações.
type NotificationInboxFilter struct {
	Type             string
	UnreadOnly       bool
	IncludeDismissed bool
	Limit            int
}

// NotificationInboxCounts resume os contadores da central de notificações.
type NotificationInboxCounts struct {
	All     int `json:"all"`
	Approve int `json:"aprovar"`
	Alert   int `json:"alerta"`
	Info    int `json:"info"`
	Unread  int `json:"unread"`
}

// NotificationPreferences armazena as preferências por categoria (#s-store › Notificações).
type NotificationPreferences struct {
	UserID    string    `json:"user_id"`
	Agenda    bool      `json:"agenda"`
	Tarefas   bool      `json:"tarefas"`
	Financas  bool      `json:"financas"`
	Bots      bool      `json:"bots"`
	Resumo    bool      `json:"resumo"`
	Promo     bool      `json:"promo"`
	UpdatedAt time.Time `json:"updated_at"`
}

// DefaultNotificationPreferences retorna os padrões iniciais de notificação.
func DefaultNotificationPreferences(userID string) *NotificationPreferences {
	return &NotificationPreferences{
		UserID:    userID,
		Agenda:    true,
		Tarefas:   true,
		Financas:  true,
		Bots:      true,
		Resumo:    true,
		Promo:     false,
		UpdatedAt: time.Now().UTC(),
	}
}

// NotificationPreferencesUpdate representa atualização parcial ou total de preferências.
type NotificationPreferencesUpdate struct {
	Agenda   *bool `json:"agenda,omitempty"`
	Tarefas  *bool `json:"tarefas,omitempty"`
	Financas *bool `json:"financas,omitempty"`
	Bots     *bool `json:"bots,omitempty"`
	Resumo   *bool `json:"resumo,omitempty"`
	Promo    *bool `json:"promo,omitempty"`
}

// NotificationsInboxRepository define o contrato de persistência da caixa de notificações.
type NotificationsInboxRepository interface {
	Create(ctx context.Context, n *UserNotification) error
	UpsertBySource(ctx context.Context, n *UserNotification) error
	GetByID(ctx context.Context, id, userID string) (*UserNotification, error)
	ListByUser(ctx context.Context, userID string, filter NotificationInboxFilter) ([]UserNotification, NotificationInboxCounts, error)
	MarkRead(ctx context.Context, id, userID string) error
	Dismiss(ctx context.Context, id, userID string) error
	MarkAllRead(ctx context.Context, userID string) (int64, error)
	GetPreferences(ctx context.Context, userID string) (*NotificationPreferences, error)
	UpsertPreferences(ctx context.Context, prefs *NotificationPreferences) error
	SyncBotPendingNotifications(ctx context.Context, userID string) error
	SyncOverdueTodoNotifications(ctx context.Context, userID string, now time.Time) error
}
