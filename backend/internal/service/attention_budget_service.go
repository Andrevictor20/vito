package service

import (
	"context"
	"database/sql"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// AttentionStatus define o veredito do AttentionBudgetService para uma notificação proativa.
const (
	AttentionStatusDelivered    = "DELIVERED"
	AttentionStatusDeferred     = "DEFERRED"
	AttentionStatusDeduplicated = "DEDUPLICATED"
	AttentionStatusSuppressed   = "SUPPRESSED"
)

// AttentionCandidate representa um alerta proativo candidato (BotRunner, FinanceTrigger, Reminder, Briefing).
type AttentionCandidate struct {
	UserID       string    `json:"user_id"`
	SourceWorker string    `json:"source_worker"` // 'bot_runner', 'finance_trigger', 'reminder_worker', 'behavioral_worker'
	Category     string    `json:"category"`      // 'agenda', 'tarefas', 'financas', 'bots', 'resumo', 'promo', 'critical_alarm'
	Urgency      string    `json:"urgency"`       // 'low', 'normal', 'high', 'critical'
	DedupKey     string    `json:"dedup_key"`
	Title        string    `json:"title"`
	Body         string    `json:"body"`
	Now          time.Time `json:"now"`
}

// AttentionDecision descreve o resultado da avaliação pelo AttentionBudgetService.
type AttentionDecision struct {
	ID           string     `json:"id"`
	Status       string     `json:"status"` // DELIVERED, DEFERRED, DEDUPLICATED, SUPPRESSED
	Reason       string     `json:"reason,omitempty"`
	ScheduledFor *time.Time `json:"scheduled_for,omitempty"`
}

// AttentionBudgetService governa o orçamento global de atenção e anti-fadiga (Onda 3 / COG-05):
// - Deduplicação semântica entre workers (ex.: Bot ADK + FinanceTrigger sobre a mesma cobrança/fatura);
// - Silêncio contextual por Agenda: se há evento em andamento no CalendarRepository, segura alertas leves até o término do evento;
// - Bypass imediato para alarmes críticos (category == 'critical_alarm' ou urgency == 'critical');
// - Respeito às preferências granulares por categoria e teto diário de notificações não críticas.
type AttentionBudgetService struct {
	db              *sql.DB
	eventRepo       domain.EventRepository
	dailyLimit      int
	dedupWindow     time.Duration
	mu              sync.RWMutex
	categoryEnabled map[string]map[string]bool // userID -> category -> enabled
}

// NewAttentionBudgetService instancia o controlador global de orçamento de atenção.
func NewAttentionBudgetService(db *sql.DB, eventRepo domain.EventRepository) *AttentionBudgetService {
	return &AttentionBudgetService{
		db:              db,
		eventRepo:       eventRepo,
		dailyLimit:      10,
		dedupWindow:     6 * time.Hour,
		categoryEnabled: make(map[string]map[string]bool),
	}
}

// SetCategoryPreference configura a preferência granular do usuário para uma categoria (#s-store › Notificações).
func (s *AttentionBudgetService) SetCategoryPreference(userID, category string, enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.categoryEnabled[userID] == nil {
		s.categoryEnabled[userID] = make(map[string]bool)
	}
	s.categoryEnabled[userID][strings.ToLower(strings.TrimSpace(category))] = enabled
}

// SetDailyLimit ajusta o teto diário de notificações não críticas por usuário.
func (s *AttentionBudgetService) SetDailyLimit(limit int) {
	if limit > 0 {
		s.dailyLimit = limit
	}
}

// ShouldDeliver avalia um candidato no AttentionBudgetService de forma nil-safe.
// Quando o serviço não está configurado (nil), permite o envio para preservar compatibilidade com testes legados.
func (s *AttentionBudgetService) ShouldDeliver(ctx context.Context, cand AttentionCandidate) (bool, *AttentionDecision) {
	if s == nil {
		return true, &AttentionDecision{Status: AttentionStatusDelivered, Reason: "attention_budget_unconfigured"}
	}
	if ctx == nil {
		ctx = context.Background()
	}
	dec, err := s.Evaluate(ctx, cand)
	if err != nil {
		return true, &AttentionDecision{Status: AttentionStatusDelivered, Reason: "attention_budget_error_fallback"}
	}
	return dec.Status == AttentionStatusDelivered, dec
}

// Evaluate avalia, persiste e decide se uma notificação proativa deve ser entregue agora, adiada, deduplicada ou suprimida.
func (s *AttentionBudgetService) Evaluate(ctx context.Context, cand AttentionCandidate) (*AttentionDecision, error) {
	now := cand.Now
	if now.IsZero() {
		now = time.Now().UTC()
	} else {
		now = now.UTC()
	}

	category := strings.ToLower(strings.TrimSpace(cand.Category))
	if category == "" {
		category = "geral"
	}
	urgency := strings.ToLower(strings.TrimSpace(cand.Urgency))
	if urgency == "" {
		urgency = "normal"
	}
	isCritical := urgency == "critical" || category == "critical_alarm"

	dedupKey := strings.TrimSpace(cand.DedupKey)
	if dedupKey == "" {
		dedupKey = buildSemanticDedupKey(cand.Title, cand.Body)
	}

	decision := &AttentionDecision{
		ID:     uuid.New().String(),
		Status: AttentionStatusDelivered,
	}

	// 1. Alarmes críticos furam qualquer bloqueio de agenda ou fadiga
	if isCritical {
		_ = s.persistDecision(ctx, cand, decision, dedupKey, now)
		return decision, nil
	}

	// 2. Verificação de preferência granular de categoria (#s-store › Notificações)
	if !s.isCategoryAllowed(cand.UserID, category) {
		decision.Status = AttentionStatusSuppressed
		decision.Reason = "category_disabled_by_user"
		_ = s.persistDecision(ctx, cand, decision, dedupKey, now)
		return decision, nil
	}

	// 3. Deduplicação semântica cross-worker (ex.: FinanceTriggerCollector + Bot ADK sobre mesma fatura)
	if dedupKey != "" && s.isDuplicateWithinWindow(ctx, cand.UserID, dedupKey, now) {
		decision.Status = AttentionStatusDeduplicated
		decision.Reason = "duplicate_semantic_key:" + dedupKey
		_ = s.persistDecision(ctx, cand, decision, dedupKey, now)
		return decision, nil
	}

	// 4. Teto diário anti-fadiga para notificações não críticas
	if s.countDeliveredToday(ctx, cand.UserID, now) >= s.dailyLimit {
		decision.Status = AttentionStatusSuppressed
		decision.Reason = "daily_attention_budget_exceeded"
		_ = s.persistDecision(ctx, cand, decision, dedupKey, now)
		return decision, nil
	}

	// 5. Silêncio contextual por Agenda: se há evento em andamento, adia até o término do compromisso
	if activeEnd := s.findActiveCalendarEventEnd(cand.UserID, now); activeEnd != nil {
		decision.Status = AttentionStatusDeferred
		decision.Reason = "calendar_event_in_progress"
		endUTC := activeEnd.UTC()
		decision.ScheduledFor = &endUTC
		_ = s.persistDecision(ctx, cand, decision, dedupKey, now)
		return decision, nil
	}

	_ = s.persistDecision(ctx, cand, decision, dedupKey, now)
	return decision, nil
}

func (s *AttentionBudgetService) isCategoryAllowed(userID, category string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if prefs, ok := s.categoryEnabled[userID]; ok {
		if allowed, exists := prefs[category]; exists {
			return allowed
		}
	}
	return true
}

func (s *AttentionBudgetService) isDuplicateWithinWindow(ctx context.Context, userID, dedupKey string, now time.Time) bool {
	if s.db == nil || dedupKey == "" {
		return false
	}
	cutoff := now.Add(-s.dedupWindow)
	var count int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(1)
		FROM attention_budget_logs
		WHERE user_id = ?
		  AND dedup_key = ?
		  AND status IN ('DELIVERED', 'DEFERRED')
		  AND created_at >= ?
	`, userID, dedupKey, cutoff).Scan(&count)
	return err == nil && count > 0
}

func (s *AttentionBudgetService) countDeliveredToday(ctx context.Context, userID string, now time.Time) int {
	if s.db == nil {
		return 0
	}
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	var count int
	_ = s.db.QueryRowContext(ctx, `
		SELECT COUNT(1)
		FROM attention_budget_logs
		WHERE user_id = ?
		  AND status = 'DELIVERED'
		  AND urgency != 'critical'
		  AND category != 'critical_alarm'
		  AND created_at >= ?
	`, userID, startOfDay).Scan(&count)
	return count
}

func (s *AttentionBudgetService) findActiveCalendarEventEnd(userID string, now time.Time) *time.Time {
	if s.eventRepo == nil || strings.TrimSpace(userID) == "" {
		return nil
	}
	events, err := s.eventRepo.ListByUser(userID, now.Add(-12*time.Hour), now.Add(12*time.Hour))
	if err != nil {
		return nil
	}
	var latestEnd *time.Time
	for _, ev := range events {
		startUTC := ev.StartAt.UTC()
		endUTC := ev.EndAt.UTC()
		if !now.Before(startUTC) && now.Before(endUTC) {
			if latestEnd == nil || endUTC.After(*latestEnd) {
				eCopy := endUTC
				latestEnd = &eCopy
			}
		}
	}
	return latestEnd
}

func (s *AttentionBudgetService) persistDecision(
	ctx context.Context,
	cand AttentionCandidate,
	dec *AttentionDecision,
	dedupKey string,
	now time.Time,
) error {
	if s.db == nil {
		return nil
	}
	writeOp := func() error {
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO attention_budget_logs (
				id, user_id, source_worker, category, urgency, dedup_key,
				title, body, status, defer_reason, scheduled_for, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			dec.ID, cand.UserID, cand.SourceWorker, strings.ToLower(strings.TrimSpace(cand.Category)),
			strings.ToLower(strings.TrimSpace(cand.Urgency)), dedupKey,
			strings.TrimSpace(cand.Title), strings.TrimSpace(cand.Body),
			dec.Status, dec.Reason, dec.ScheduledFor, now,
		)
		return err
	}
	if q := database.DefaultWriterQueue(); q != nil {
		return q.Execute(ctx, writeOp)
	}
	return writeOp()
}

func buildSemanticDedupKey(title, body string) string {
	combined := strings.ToLower(strings.TrimSpace(title + " " + body))
	if combined == "" {
		return ""
	}
	stop := map[string]bool{
		"alerta": true, "aviso": true, "lembrete": true, "bot": true, "finance": true,
		"financeiro": true, "agenda": true, "tarefa": true, "notificação": true,
		"vito": true, "seu": true, "sua": true, "de": true, "da": true, "do": true,
		"para": true, "com": true, "em": true, "no": true, "na": true, "que": true,
		"uma": true, "um": true, "está": true, "esta": true, "foi": true, "por": true,
	}
	tokens := strings.FieldsFunc(combined, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r >= 'à' && r <= 'ÿ')
	})
	var kept []string
	seen := make(map[string]bool)
	for _, tok := range tokens {
		if len(tok) < 3 || stop[tok] || seen[tok] {
			continue
		}
		seen[tok] = true
		kept = append(kept, tok)
		if len(kept) >= 4 {
			break
		}
	}
	sort.Strings(kept)
	return strings.Join(kept, "_")
}
