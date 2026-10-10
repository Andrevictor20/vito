package domain

import (
	"errors"
	"time"
)

var (
	ErrTriggerNotFound = errors.New("disparador não encontrado")
)

type TriggerCategory string

const (
	CategoryFinance       TriggerCategory = "finance"
	CategoryTaxesDocs     TriggerCategory = "taxes_docs"
	CategoryRealEstate    TriggerCategory = "real_estate"
	CategoryAutomotive    TriggerCategory = "automotive"
	CategoryCareer        TriggerCategory = "career"
	CategoryNews          TriggerCategory = "news"
	CategoryTech          TriggerCategory = "tech"
	CategoryTravel        TriggerCategory = "travel"
	CategoryShopping      TriggerCategory = "shopping"
	CategoryEventsSports  TriggerCategory = "events_sports"
	CategoryEntertainment TriggerCategory = "entertainment"
	CategoryWeather       TriggerCategory = "weather"
	CategoryCustom        TriggerCategory = "custom"
)

type TriggerStatus string

const (
	TriggerStatusActive    TriggerStatus = "active"
	TriggerStatusPaused    TriggerStatus = "paused"
	TriggerStatusTriggered TriggerStatus = "triggered"
)

type TriggerConditionType string

const (
	ConditionPriceAbove     TriggerConditionType = "price_above"
	ConditionPriceBelow     TriggerConditionType = "price_below"
	ConditionEventUpcoming  TriggerConditionType = "event_upcoming"
	ConditionDailyBrief     TriggerConditionType = "daily_brief"
	ConditionChangeDetected TriggerConditionType = "change_detected"
)

type TriggerFrequency string

const (
	FrequencyDailyMorning TriggerFrequency = "daily_morning"
	FrequencyDailyEvening TriggerFrequency = "daily_evening"
	FrequencyHourly       TriggerFrequency = "hourly"
	FrequencyImmediate    TriggerFrequency = "immediate"
)

// Trigger representa uma regra de vigília/monitoramento autônomo cadastrada pelo usuário.
type Trigger struct {
	ID            string               `json:"id"`
	UserID        string               `json:"user_id"`
	Title         string               `json:"title"`
	Category      TriggerCategory      `json:"category"`
	Query         string               `json:"query"`
	ConditionType TriggerConditionType `json:"condition_type"`
	TargetValue   string               `json:"target_value"`
	CurrentValue  string               `json:"current_value"`
	Status        TriggerStatus        `json:"status"`
	Frequency     TriggerFrequency     `json:"frequency"`
	LastCheckedAt *time.Time           `json:"last_checked_at,omitempty"`
	NextCheckAt   *time.Time           `json:"next_check_at,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
}

// TriggerLog registra cada disparo/alerta acionado pelo monitoramento.
type TriggerLog struct {
	ID          string    `json:"id"`
	TriggerID   string    `json:"trigger_id"`
	TriggeredAt time.Time `json:"triggered_at"`
	Message     string    `json:"message"`
	Payload     string    `json:"payload,omitempty"`
	IsRead      bool      `json:"is_read"`
}

// CreateTriggerInput contém os dados necessários para registrar um novo monitoramento.
type CreateTriggerInput struct {
	Title         string               `json:"title"`
	Category      TriggerCategory      `json:"category"`
	Query         string               `json:"query"`
	ConditionType TriggerConditionType `json:"condition_type,omitempty"`
	TargetValue   string               `json:"target_value,omitempty"`
	Frequency     TriggerFrequency     `json:"frequency,omitempty"`
}

// UpdateTriggerInput contém campos passíveis de edição manual.
type UpdateTriggerInput struct {
	Title         *string               `json:"title,omitempty"`
	Category      *TriggerCategory      `json:"category,omitempty"`
	Query         *string               `json:"query,omitempty"`
	ConditionType *TriggerConditionType `json:"condition_type,omitempty"`
	TargetValue   *string               `json:"target_value,omitempty"`
	Frequency     *TriggerFrequency     `json:"frequency,omitempty"`
	Status        *TriggerStatus        `json:"status,omitempty"`
}

// TriggerRepository define o contrato de persistência dos disparadores no banco.
type TriggerRepository interface {
	Create(trigger *Trigger) error
	GetByID(id, userID string) (*Trigger, error)
	ListByUser(userID string, category TriggerCategory, status TriggerStatus) ([]Trigger, error)
	ListActive() ([]Trigger, error)
	Update(trigger *Trigger) error
	UpdateStatus(id, userID string, status TriggerStatus) error
	UpdateEvaluation(id string, currentValue string, status TriggerStatus, lastChecked time.Time, nextCheck *time.Time) error
	Delete(id, userID string) error
	CreateLog(log *TriggerLog) error
	ListLogsByTrigger(triggerID string) ([]TriggerLog, error)
}
