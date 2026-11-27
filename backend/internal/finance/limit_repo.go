package finance

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// FinanceLimitRepository gerencia limites multi-escopo, metas e eventos de alerta anti-spam.
type FinanceLimitRepository interface {
	ListLimits(ctx context.Context, userID string, scopeFilter domain.SpendingLimitScope) ([]domain.FinanceLimitRule, error)
	GetLimit(ctx context.Context, userID, limitID string) (*domain.FinanceLimitRule, error)
	UpsertLimit(ctx context.Context, rule *domain.FinanceLimitRule) error
	DeleteLimit(ctx context.Context, userID, limitID string) error
	ComputeLimitStatus(ctx context.Context, userID string, rule domain.FinanceLimitRule, now time.Time) (*domain.FinanceLimitStatus, error)
	ListLimitAlertHistory(ctx context.Context, userID, limitID string, limit int) ([]domain.FinanceLimitAlertEvent, error)
	RecordLimitAlertEvent(ctx context.Context, ev *domain.FinanceLimitAlertEvent) (bool, error)
}

type sqliteFinanceLimitRepo struct {
	db *sql.DB
}

// NewFinanceLimitRepository instancia o repositório de limites financeiros em SQLite.
func NewFinanceLimitRepository(db *sql.DB) FinanceLimitRepository {
	return &sqliteFinanceLimitRepo{db: db}
}

const limitSelectCols = `
	id, user_id, kind, COALESCE(scope_type, 'CATEGORY'), title,
	COALESCE(category_filter, ''), COALESCE(account_id, ''), COALESCE(merchant_id, ''),
	COALESCE(merchant_pattern, ''), COALESCE(period_type, 'MONTHLY'),
	target_amount, COALESCE(current_amount, 0), COALESCE(deadline_date, ''),
	COALESCE(auto_alert_threshold, 80), COALESCE(alert_thresholds_json, '[80,100]'),
	COALESCE(repeat_over_step_percent, 0), COALESCE(pace_alert_enabled, 1),
	COALESCE(notify_channels_json, '["in_app","push"]'), COALESCE(include_pending, 1),
	COALESCE(is_active, 1), muted_until, created_at, updated_at
`

func scanLimitRule(scanner interface{ Scan(dest ...any) error }) (*domain.FinanceLimitRule, error) {
	var r domain.FinanceLimitRule
	var thresholdsJSON, channelsJSON string
	var paceInt, pendingInt, activeInt int
	var mutedUntil sql.NullTime

	err := scanner.Scan(
		&r.ID, &r.UserID, &r.Kind, &r.ScopeType, &r.Title,
		&r.CategoryFilter, &r.AccountID, &r.MerchantID,
		&r.MerchantPattern, &r.PeriodType,
		&r.TargetAmount, &r.CurrentAmount, &r.DeadlineDate,
		&r.AutoAlertThreshold, &thresholdsJSON,
		&r.RepeatOverStepPct, &paceInt,
		&channelsJSON, &pendingInt,
		&activeInt, &mutedUntil, &r.CreatedAt, &r.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrFinanceInvalidPayload
	}
	if err != nil {
		return nil, err
	}

	r.PaceAlertEnabled = paceInt != 0
	r.IncludePending = pendingInt != 0
	r.IsActive = activeInt != 0
	if mutedUntil.Valid {
		t := mutedUntil.Time.UTC()
		r.MutedUntil = &t
	}
	_ = json.Unmarshal([]byte(thresholdsJSON), &r.AlertThresholds)
	if len(r.AlertThresholds) == 0 {
		r.AlertThresholds = []int{80, 100}
	}
	_ = json.Unmarshal([]byte(channelsJSON), &r.NotifyChannels)
	if len(r.NotifyChannels) == 0 {
		r.NotifyChannels = []string{"in_app", "push"}
	}
	return &r, nil
}

func (r *sqliteFinanceLimitRepo) ListLimits(ctx context.Context, userID string, scopeFilter domain.SpendingLimitScope) ([]domain.FinanceLimitRule, error) {
	query := `SELECT ` + limitSelectCols + ` FROM finance_budgets_and_goals WHERE user_id = ?`
	args := []any{userID}
	if scopeFilter != "" {
		query += ` AND scope_type = ?`
		args = append(args, string(scopeFilter))
	}
	query += ` ORDER BY is_active DESC, created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.FinanceLimitRule
	for rows.Next() {
		item, err := scanLimitRule(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

func (r *sqliteFinanceLimitRepo) GetLimit(ctx context.Context, userID, limitID string) (*domain.FinanceLimitRule, error) {
	query := `SELECT ` + limitSelectCols + ` FROM finance_budgets_and_goals WHERE user_id = ? AND id = ?`
	return scanLimitRule(r.db.QueryRowContext(ctx, query, userID, limitID))
}

func (r *sqliteFinanceLimitRepo) UpsertLimit(ctx context.Context, rule *domain.FinanceLimitRule) error {
	if rule.ID == "" {
		rule.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	if rule.CreatedAt.IsZero() {
		rule.CreatedAt = now
	}
	rule.UpdatedAt = now
	if rule.ScopeType == "" {
		rule.ScopeType = domain.LimitScopeCategory
	}
	if rule.Kind == "" {
		if rule.ScopeType == domain.LimitScopeSavingsGoal {
			rule.Kind = domain.BudgetKindSavingsGoal
		} else {
			rule.Kind = domain.BudgetKindCategoryLimit
		}
	}
	if rule.PeriodType == "" {
		rule.PeriodType = domain.LimitPeriodMonthly
	}
	if len(rule.AlertThresholds) == 0 {
		rule.AlertThresholds = []int{80, 100}
	}
	if rule.AutoAlertThreshold <= 0 {
		rule.AutoAlertThreshold = rule.AlertThresholds[0]
	}
	if len(rule.NotifyChannels) == 0 {
		rule.NotifyChannels = []string{"in_app", "push"}
	}

	thresholdsBytes, _ := json.Marshal(rule.AlertThresholds)
	channelsBytes, _ := json.Marshal(rule.NotifyChannels)

	query := `
		INSERT INTO finance_budgets_and_goals (
			id, user_id, kind, scope_type, title, category_filter,
			account_id, merchant_id, merchant_pattern, period_type,
			target_amount, current_amount, deadline_date, auto_alert_threshold,
			alert_thresholds_json, repeat_over_step_percent, pace_alert_enabled,
			notify_channels_json, include_pending, is_active, muted_until,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			kind = excluded.kind,
			scope_type = excluded.scope_type,
			title = excluded.title,
			category_filter = excluded.category_filter,
			account_id = excluded.account_id,
			merchant_id = excluded.merchant_id,
			merchant_pattern = excluded.merchant_pattern,
			period_type = excluded.period_type,
			target_amount = excluded.target_amount,
			current_amount = excluded.current_amount,
			deadline_date = excluded.deadline_date,
			auto_alert_threshold = excluded.auto_alert_threshold,
			alert_thresholds_json = excluded.alert_thresholds_json,
			repeat_over_step_percent = excluded.repeat_over_step_percent,
			pace_alert_enabled = excluded.pace_alert_enabled,
			notify_channels_json = excluded.notify_channels_json,
			include_pending = excluded.include_pending,
			is_active = excluded.is_active,
			muted_until = excluded.muted_until,
			updated_at = excluded.updated_at
		WHERE finance_budgets_and_goals.user_id = excluded.user_id
	`
	return database.ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, query,
			rule.ID, rule.UserID, rule.Kind, rule.ScopeType, rule.Title, nullIfEmpty(rule.CategoryFilter),
			nullIfEmpty(rule.AccountID), nullIfEmpty(rule.MerchantID), nullIfEmpty(rule.MerchantPattern), rule.PeriodType,
			rule.TargetAmount, rule.CurrentAmount, nullIfEmpty(rule.DeadlineDate), rule.AutoAlertThreshold,
			string(thresholdsBytes), rule.RepeatOverStepPct, boolToInt(rule.PaceAlertEnabled),
			string(channelsBytes), boolToInt(rule.IncludePending), boolToInt(rule.IsActive), rule.MutedUntil,
			rule.CreatedAt, rule.UpdatedAt,
		)
		return err
	})
}

func (r *sqliteFinanceLimitRepo) DeleteLimit(ctx context.Context, userID, limitID string) error {
	rows, err := database.ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `DELETE FROM finance_budgets_and_goals WHERE user_id = ? AND id = ?`, userID, limitID)
	})
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrFinanceInvalidPayload
	}
	return nil
}

func resolveLimitWindow(db *sql.DB, userID string, rule domain.FinanceLimitRule, now time.Time) (start, end time.Time, periodKey string) {
	loc := now.UTC()
	switch rule.PeriodType {
	case domain.LimitPeriodDaily:
		start = time.Date(loc.Year(), loc.Month(), loc.Day(), 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 0, 1)
		periodKey = start.Format("2006-01-02")
	case domain.LimitPeriodWeekly:
		weekday := int(loc.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start = time.Date(loc.Year(), loc.Month(), loc.Day()-(weekday-1), 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 0, 7)
		year, week := start.ISOWeek()
		periodKey = fmt.Sprintf("%04d-W%02d", year, week)
	case domain.LimitPeriodBillingCycle:
		closingDay := 0
		if rule.AccountID != "" {
			var cd sql.NullInt64
			_ = db.QueryRow(`SELECT closing_day FROM finance_accounts WHERE user_id = ? AND id = ?`, userID, rule.AccountID).Scan(&cd)
			if cd.Valid && cd.Int64 >= 1 && cd.Int64 <= 31 {
				closingDay = int(cd.Int64)
			}
		}
		if closingDay > 0 {
			day := closingDay
			if loc.Day() >= day {
				start = time.Date(loc.Year(), loc.Month(), minInt(day, daysInMonth(loc.Year(), loc.Month())), 0, 0, 0, 0, time.UTC)
				nextM := loc.AddDate(0, 1, 0)
				end = time.Date(nextM.Year(), nextM.Month(), minInt(day, daysInMonth(nextM.Year(), nextM.Month())), 0, 0, 0, 0, time.UTC)
			} else {
				prevM := loc.AddDate(0, -1, 0)
				start = time.Date(prevM.Year(), prevM.Month(), minInt(day, daysInMonth(prevM.Year(), prevM.Month())), 0, 0, 0, 0, time.UTC)
				end = time.Date(loc.Year(), loc.Month(), minInt(day, daysInMonth(loc.Year(), loc.Month())), 0, 0, 0, 0, time.UTC)
			}
			periodKey = fmt.Sprintf("cycle:%s:%s", rule.AccountID, end.Format("2006-01-02"))
			return start, end, periodKey
		}
		fallthrough
	default:
		start = time.Date(loc.Year(), loc.Month(), 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 1, 0)
		periodKey = start.Format("2006-01")
	}
	return start, end, periodKey
}

func (r *sqliteFinanceLimitRepo) ComputeLimitStatus(ctx context.Context, userID string, rule domain.FinanceLimitRule, now time.Time) (*domain.FinanceLimitStatus, error) {
	start, end, periodKey := resolveLimitWindow(r.db, userID, rule, now)
	status := &domain.FinanceLimitStatus{
		Rule:       rule,
		PeriodKey:  periodKey,
		CycleStart: start,
		CycleEnd:   end,
	}

	if rule.ScopeType == domain.LimitScopeSavingsGoal {
		status.SpentAmount = rule.CurrentAmount
		if rule.TargetAmount > 0 {
			status.PercentUsed = (rule.CurrentAmount / rule.TargetAmount) * 100
			status.RemainingAmount = rule.TargetAmount - rule.CurrentAmount
		}
		status.StatusLabel = "OK"
		return status, nil
	}

	where := []string{
		"t.user_id = ?",
		"t.amount < 0",
		"t.occurred_at >= ?",
		"t.occurred_at < ?",
	}
	args := []any{userID, start, end}

	if !rule.IncludePending {
		where = append(where, "COALESCE(t.tx_status, 'POSTED') <> 'PENDING'")
	}

	switch rule.ScopeType {
	case domain.LimitScopeCard:
		if rule.AccountID != "" {
			where = append(where, "t.account_id = ?")
			args = append(args, rule.AccountID)
		} else {
			where = append(where, "EXISTS (SELECT 1 FROM finance_accounts a WHERE a.id = t.account_id AND a.account_type = 'CREDIT')")
		}
	case domain.LimitScopeCategory:
		if rule.CategoryFilter != "" {
			where = append(where, "LOWER(t.category) = LOWER(?)")
			args = append(args, rule.CategoryFilter)
		}
	case domain.LimitScopeSubscriptions:
		where = append(where, "t.is_recurring = 1")
		if rule.MerchantID != "" {
			where = append(where, "t.merchant_id = ?")
			args = append(args, rule.MerchantID)
		} else if rule.MerchantPattern != "" {
			where = append(where, "(LOWER(t.description) LIKE ? OR LOWER(COALESCE(t.clean_merchant_name,'')) LIKE ?)")
			pat := "%" + strings.ToLower(strings.TrimSpace(rule.MerchantPattern)) + "%"
			args = append(args, pat, pat)
		}
	case domain.LimitScopeMerchant:
		if rule.MerchantID != "" {
			where = append(where, "t.merchant_id = ?")
			args = append(args, rule.MerchantID)
		} else if rule.MerchantPattern != "" {
			where = append(where, "(LOWER(t.description) LIKE ? OR LOWER(COALESCE(t.clean_merchant_name,'')) LIKE ?)")
			pat := "%" + strings.ToLower(strings.TrimSpace(rule.MerchantPattern)) + "%"
			args = append(args, pat, pat)
		}
	}

	sumQuery := `SELECT COALESCE(SUM(ABS(t.amount)), 0) FROM finance_transactions t WHERE ` + strings.Join(where, " AND ")
	if err := r.db.QueryRowContext(ctx, sumQuery, args...).Scan(&status.SpentAmount); err != nil {
		return nil, err
	}

	if rule.TargetAmount > 0 {
		status.PercentUsed = (status.SpentAmount / rule.TargetAmount) * 100
		status.RemainingAmount = rule.TargetAmount - status.SpentAmount
	}

	totalDays := end.Sub(start).Hours() / 24
	elapsedDays := now.UTC().Sub(start).Hours() / 24
	if elapsedDays < 1 {
		elapsedDays = 1
	}
	if totalDays > 0 && elapsedDays <= totalDays {
		status.ProjectedAmount = (status.SpentAmount / elapsedDays) * totalDays
	} else {
		status.ProjectedAmount = status.SpentAmount
	}

	status.StatusLabel = "OK"
	if status.PercentUsed >= 100 {
		status.StatusLabel = "EXCEEDED"
	} else if len(rule.AlertThresholds) > 0 && status.PercentUsed >= float64(rule.AlertThresholds[0]) {
		status.StatusLabel = "WARNING"
	} else if rule.PaceAlertEnabled && totalDays > 0 && (elapsedDays/totalDays) >= 0.25 && status.ProjectedAmount > rule.TargetAmount && rule.TargetAmount > 0 {
		status.StatusLabel = "PACE_RISK"
	}

	topQuery := `
		SELECT t.id, t.user_id, COALESCE(t.account_id,''), t.pluggy_transaction_id,
		       t.description, COALESCE(t.clean_merchant_name,''), t.amount, t.transaction_type,
		       COALESCE(t.payment_method,''), COALESCE(t.category,'Outros'), t.is_recurring,
		       t.occurred_at, t.created_at
		FROM finance_transactions t
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY ABS(t.amount) DESC
		LIMIT 3
	`
	rows, err := r.db.QueryContext(ctx, topQuery, args...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tx domain.FinanceTransaction
			var rec int
			if scanErr := rows.Scan(
				&tx.ID, &tx.UserID, &tx.AccountID, &tx.PluggyTransactionID,
				&tx.Description, &tx.CleanMerchantName, &tx.Amount, &tx.TransactionType,
				&tx.PaymentMethod, &tx.Category, &rec, &tx.OccurredAt, &tx.CreatedAt,
			); scanErr == nil {
				tx.IsRecurring = rec != 0
				status.TopContributors = append(status.TopContributors, tx)
			}
		}
	}

	return status, nil
}

func (r *sqliteFinanceLimitRepo) ListLimitAlertHistory(ctx context.Context, userID, limitID string, limit int) ([]domain.FinanceLimitAlertEvent, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, limit_id, period_key, trigger_kind, threshold_percent,
		       spent_amount, target_amount, notified_channels, COALESCE(notification_id, ''), created_at
		FROM finance_limit_alert_events
		WHERE user_id = ? AND limit_id = ?
		ORDER BY created_at DESC
		LIMIT ?
	`, userID, limitID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.FinanceLimitAlertEvent
	for rows.Next() {
		var ev domain.FinanceLimitAlertEvent
		var chJSON string
		if err := rows.Scan(
			&ev.ID, &ev.UserID, &ev.LimitID, &ev.PeriodKey, &ev.TriggerKind, &ev.ThresholdPercent,
			&ev.SpentAmount, &ev.TargetAmount, &chJSON, &ev.NotificationID, &ev.CreatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(chJSON), &ev.NotifiedChannels)
		out = append(out, ev)
	}
	return out, rows.Err()
}

func (r *sqliteFinanceLimitRepo) RecordLimitAlertEvent(ctx context.Context, ev *domain.FinanceLimitAlertEvent) (bool, error) {
	if ev.ID == "" {
		ev.ID = uuid.NewString()
	}
	if ev.CreatedAt.IsZero() {
		ev.CreatedAt = time.Now().UTC()
	}
	chBytes, _ := json.Marshal(ev.NotifiedChannels)
	rows, err := database.ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `
			INSERT OR IGNORE INTO finance_limit_alert_events (
				id, user_id, limit_id, period_key, trigger_kind, threshold_percent,
				spent_amount, target_amount, notified_channels, notification_id, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			ev.ID, ev.UserID, ev.LimitID, ev.PeriodKey, ev.TriggerKind, ev.ThresholdPercent,
			ev.SpentAmount, ev.TargetAmount, string(chBytes), nullIfEmpty(ev.NotificationID), ev.CreatedAt,
		)
	})
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func daysInMonth(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
