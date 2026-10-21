package domain

import (
	"errors"
	"strings"
	"time"
)

// MinTriggerConfidence é o limiar mínimo de confiança (0-100) para que uma
// avaliação de radar seja considerada relevante (Lote C §9).
const MinTriggerConfidence = 75

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
	CategoryPublicExams   TriggerCategory = "public_exams"
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
	ID             string               `json:"id"`
	UserID         string               `json:"user_id"`
	Title          string               `json:"title"`
	Category       TriggerCategory      `json:"category"`
	Query          string               `json:"query"`
	UserIntent     string               `json:"user_intent,omitempty"`
	SearchKeywords string               `json:"search_keywords,omitempty"`
	ConditionType  TriggerConditionType `json:"condition_type"`
	TargetValue    string               `json:"target_value"`
	CurrentValue   string               `json:"current_value"`
	Status         TriggerStatus        `json:"status"`
	Frequency      TriggerFrequency     `json:"frequency"`
	ScheduledTime  string               `json:"scheduled_time,omitempty"`
	DaysOfWeek     string               `json:"days_of_week,omitempty"`
	LastRunStatus  string               `json:"last_run_status,omitempty"`
	LastError      string               `json:"last_error,omitempty"`
	LastCheckedAt  *time.Time           `json:"last_checked_at,omitempty"`
	NextCheckAt    *time.Time           `json:"next_check_at,omitempty"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
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

// TriggerTestResult resultado de uma simulação ou teste sob demanda de disparador.
type TriggerTestResult struct {
	TriggerID             string   `json:"trigger_id"`
	Title                 string   `json:"title"`
	Query                 string   `json:"query"`
	ConditionMet          bool     `json:"condition_met"`
	CurrentData           string   `json:"current_data"`
	Summary               string   `json:"summary"`
	Paragraphs            []string `json:"paragraphs,omitempty"`
	SimulatedNotification string   `json:"simulated_notification"`
	Confidence            int      `json:"confidence"`
	WhyRelevant           string   `json:"why_relevant"`
	// Urgency indica breaking/imediato ("high") vs rotina ("low"/vazio) — Fase 2.
	Urgency  string    `json:"urgency,omitempty"`
	TestedAt time.Time `json:"tested_at"`
}

// EnforceConfidenceGate filtra ConditionMet=false quando a avaliação está
// abaixo do limiar de confiança ou sem justificativa (Lote C §9).
func (r *TriggerTestResult) EnforceConfidenceGate() {
	if r == nil {
		return
	}
	if r.Confidence < MinTriggerConfidence || strings.TrimSpace(r.WhyRelevant) == "" {
		r.ConditionMet = false
	}
}

// CreateTriggerInput contém os dados necessários para registrar um novo monitoramento.
type CreateTriggerInput struct {
	Title          string               `json:"title"`
	Category       TriggerCategory      `json:"category"`
	Query          string               `json:"query"`
	UserIntent     string               `json:"user_intent,omitempty"`
	SearchKeywords string               `json:"search_keywords,omitempty"`
	ConditionType  TriggerConditionType `json:"condition_type,omitempty"`
	TargetValue    string               `json:"target_value,omitempty"`
	Frequency      TriggerFrequency     `json:"frequency,omitempty"`
	ScheduledTime  string               `json:"scheduled_time,omitempty"`
	DaysOfWeek     string               `json:"days_of_week,omitempty"`
}

// UpdateTriggerInput contém campos passíveis de edição manual.
type UpdateTriggerInput struct {
	Title          *string               `json:"title,omitempty"`
	Category       *TriggerCategory      `json:"category,omitempty"`
	Query          *string               `json:"query,omitempty"`
	UserIntent     *string               `json:"user_intent,omitempty"`
	SearchKeywords *string               `json:"search_keywords,omitempty"`
	ConditionType  *TriggerConditionType `json:"condition_type,omitempty"`
	TargetValue    *string               `json:"target_value,omitempty"`
	Frequency      *TriggerFrequency     `json:"frequency,omitempty"`
	Status         *TriggerStatus        `json:"status,omitempty"`
	ScheduledTime  *string               `json:"scheduled_time,omitempty"`
	DaysOfWeek     *string               `json:"days_of_week,omitempty"`
}

// TriggerRepository define o contrato de persistência dos disparadores no banco.
type TriggerRepository interface {
	Create(trigger *Trigger) error
	GetByID(id, userID string) (*Trigger, error)
	ListByUser(userID string, category TriggerCategory, status TriggerStatus) ([]Trigger, error)
	ListActive() ([]Trigger, error)
	ListDueTriggers(now time.Time) ([]Trigger, error)
	Update(trigger *Trigger) error
	UpdateStatus(id, userID string, status TriggerStatus) error
	UpdateEvaluation(id string, currentValue string, status TriggerStatus, lastChecked time.Time, nextCheck *time.Time) error
	UpdateRunResult(id string, currentValue string, status TriggerStatus, lastRunStatus string, lastChecked time.Time, nextCheck *time.Time) error
	// UpdateLastError persiste o erro da última coleta (visível no app).
	UpdateLastError(id string, errMsg string) error
	// GetLastNotifiedAt/UpdateLastNotifiedAt sustentam o cooldown do push (Fase 1).
	GetLastNotifiedAt(id string) (*time.Time, error)
	UpdateLastNotifiedAt(id string, t time.Time) error
	// SeenHashes lê/grava os hashes do delta gate (§9.3).
	GetSeenHashes(id string) ([]string, error)
	SetSeenHashes(id string, hashes []string) error
	Delete(id, userID string) error
	CreateLog(log *TriggerLog) error
	ListLogsByTrigger(triggerID string) ([]TriggerLog, error)
	DeleteLog(logID, userID string) error
	ClearLogs(triggerID, userID string) error
}

// TriggerTemplate define um modelo pronto de vigília no catálogo "Explore por Área".
type TriggerTemplate struct {
	ID             string               `json:"id"`
	Title          string               `json:"title"`
	Description    string               `json:"description"`
	Category       TriggerCategory      `json:"category"`
	Area           string               `json:"area"`       // "carreiras", "concursos", "imoveis", "financas", "viagens", "trabalho", "estudos"
	Icon           string               `json:"icon"`       // "work", "gavel", "home", "flight", "attach-money", "school", "newspaper", etc.
	Connectors     []string             `json:"connectors"` // ["web", "gmail", "calendar", "profile"]
	Query          string               `json:"query"`
	UserIntent     string               `json:"user_intent"`
	SearchKeywords string               `json:"search_keywords,omitempty"`
	ConditionType  TriggerConditionType `json:"condition_type"`
	TargetValue    string               `json:"target_value"`
	Frequency      TriggerFrequency     `json:"frequency"`
	ScheduledTime  string               `json:"scheduled_time,omitempty"`
}

// ActivateTemplateInput permite customizações opcionais ao ativar um template em 1 toque.
type ActivateTemplateInput struct {
	Title       string `json:"title,omitempty"`
	Query       string `json:"query,omitempty"`
	TargetValue string `json:"target_value,omitempty"`
}
