package domain

import (
	"time"
)

// BriefingSettings define as preferências do usuário para o resumo matinal proativo.
type BriefingSettings struct {
	UserID           string    `json:"user_id"`
	Enabled          bool      `json:"enabled"`
	ScheduledTime    string    `json:"scheduled_time"` // formato HH:MM (ex: "07:30")
	WakeupAlarmEarly bool      `json:"wakeup_alarm_early"`
	LastSentDate     string    `json:"last_sent_date"` // formato YYYY-MM-DD
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// DefaultBriefingSettings retorna os valores padrão recomendados de fábrica.
func DefaultBriefingSettings(userID string) *BriefingSettings {
	now := time.Now().UTC()
	return &BriefingSettings{
		UserID:           userID,
		Enabled:          true,
		ScheduledTime:    "07:30",
		WakeupAlarmEarly: true,
		LastSentDate:     "",
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

// BriefingRepository define o contrato de persistência para as preferências de briefing.
type BriefingRepository interface {
	GetSettings(userID string) (*BriefingSettings, error)
	UpsertSettings(settings *BriefingSettings) error
	ListActiveSettings() ([]BriefingSettings, error)
	MarkSent(userID, dateStr string) error
}
