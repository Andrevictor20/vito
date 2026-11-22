package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// StoreComplianceRepositorySQLite persiste assinaturas, privacidade, LGPD e suporte no SQLite.
type StoreComplianceRepositorySQLite struct {
	db *sql.DB
}

// NewStoreComplianceRepository instancia o repositório de loja e conformidade LGPD.
func NewStoreComplianceRepository(db *sql.DB) *StoreComplianceRepositorySQLite {
	return &StoreComplianceRepositorySQLite{db: db}
}

// GetSubscription retorna a assinatura atual do usuário ou o plano gratuito padrão.
func (r *StoreComplianceRepositorySQLite) GetSubscription(ctx context.Context, userID string) (*domain.UserSubscription, error) {
	const q = `
		SELECT user_id, plan, billing_cycle, status, trial_ends_at, renews_at, store_token_hash, updated_at
		FROM user_subscriptions
		WHERE user_id = ?
	`
	var sub domain.UserSubscription
	var plan, cycle string
	var trialEnds, renewsAt sql.NullTime
	err := r.db.QueryRowContext(ctx, q, userID).Scan(
		&sub.UserID, &plan, &cycle, &sub.Status, &trialEnds, &renewsAt, &sub.StoreTokenHash, &sub.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.DefaultUserSubscription(userID), nil
	}
	if err != nil {
		return nil, err
	}
	sub.Plan = domain.SubscriptionPlan(plan)
	sub.BillingCycle = domain.BillingCycle(cycle)
	sub.HasStoreToken = sub.StoreTokenHash != ""
	if trialEnds.Valid {
		t := trialEnds.Time.UTC()
		sub.TrialEndsAt = &t
	}
	if renewsAt.Valid {
		t := renewsAt.Time.UTC()
		sub.RenewsAt = &t
	}
	return &sub, nil
}

// UpsertSubscription cria ou atualiza a assinatura do usuário via DefaultWriterQueue.
func (r *StoreComplianceRepositorySQLite) UpsertSubscription(ctx context.Context, sub *domain.UserSubscription) error {
	sub.UpdatedAt = time.Now().UTC()
	sub.HasStoreToken = sub.StoreTokenHash != ""
	const q = `
		INSERT INTO user_subscriptions (
			user_id, plan, billing_cycle, status, trial_ends_at, renews_at, store_token_hash, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			plan = excluded.plan,
			billing_cycle = excluded.billing_cycle,
			status = excluded.status,
			trial_ends_at = excluded.trial_ends_at,
			renews_at = excluded.renews_at,
			store_token_hash = CASE
				WHEN excluded.store_token_hash != '' THEN excluded.store_token_hash
				ELSE user_subscriptions.store_token_hash
			END,
			updated_at = excluded.updated_at
	`
	return ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, q,
			sub.UserID,
			string(sub.Plan),
			string(sub.BillingCycle),
			sub.Status,
			sub.TrialEndsAt,
			sub.RenewsAt,
			sub.StoreTokenHash,
			sub.UpdatedAt,
		)
		return err
	})
}

// GetPrivacySettings retorna as preferências de privacidade do usuário ou o padrão seguro.
func (r *StoreComplianceRepositorySQLite) GetPrivacySettings(ctx context.Context, userID string) (*domain.PrivacySettings, error) {
	const q = `
		SELECT user_id, ai_processing_enabled, analytics_enabled, permissions_json, updated_at
		FROM user_privacy_settings
		WHERE user_id = ?
	`
	var ps domain.PrivacySettings
	var aiInt, anInt int
	var permJSON string
	err := r.db.QueryRowContext(ctx, q, userID).Scan(
		&ps.UserID, &aiInt, &anInt, &permJSON, &ps.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.DefaultPrivacySettings(userID), nil
	}
	if err != nil {
		return nil, err
	}
	ps.AIProcessingEnabled = aiInt != 0
	ps.AnalyticsEnabled = anInt != 0
	if permJSON != "" {
		_ = json.Unmarshal([]byte(permJSON), &ps.Permissions)
	}
	return &ps, nil
}

// UpsertPrivacySettings salva as preferências de privacidade do usuário via DefaultWriterQueue.
func (r *StoreComplianceRepositorySQLite) UpsertPrivacySettings(ctx context.Context, ps *domain.PrivacySettings) error {
	ps.UpdatedAt = time.Now().UTC()
	b2i := func(b bool) int {
		if b {
			return 1
		}
		return 0
	}
	permBytes, err := json.Marshal(ps.Permissions)
	if err != nil {
		return err
	}
	const q = `
		INSERT INTO user_privacy_settings (
			user_id, ai_processing_enabled, analytics_enabled, permissions_json, updated_at
		) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			ai_processing_enabled = excluded.ai_processing_enabled,
			analytics_enabled = excluded.analytics_enabled,
			permissions_json = excluded.permissions_json,
			updated_at = excluded.updated_at
	`
	return ExecuteQueuedWrite(ctx, func() error {
		_, execErr := r.db.ExecContext(ctx, q,
			ps.UserID,
			b2i(ps.AIProcessingEnabled),
			b2i(ps.AnalyticsEnabled),
			string(permBytes),
			ps.UpdatedAt,
		)
		return execErr
	})
}

// CreateComplianceRequest registra solicitação LGPD (export_json ou delete_account) via DefaultWriterQueue.
func (r *StoreComplianceRepositorySQLite) CreateComplianceRequest(ctx context.Context, req *domain.AccountComplianceRequest) error {
	if req.ID == "" {
		req.ID = uuid.NewString()
	}
	if req.RequestedAt.IsZero() {
		req.RequestedAt = time.Now().UTC()
	}
	const q = `
		INSERT INTO account_compliance_requests (id, user_id, kind, status, requested_at, scheduled_for)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	return ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, q,
			req.ID, req.UserID, string(req.Kind), req.Status, req.RequestedAt, req.ScheduledFor,
		)
		return err
	})
}

// ListComplianceRequests lista histórico de solicitações LGPD do usuário.
func (r *StoreComplianceRepositorySQLite) ListComplianceRequests(ctx context.Context, userID string) ([]domain.AccountComplianceRequest, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, kind, status, requested_at, scheduled_for
		FROM account_compliance_requests
		WHERE user_id = ?
		ORDER BY requested_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AccountComplianceRequest, 0)
	for rows.Next() {
		var item domain.AccountComplianceRequest
		var kind string
		var sched sql.NullTime
		if scanErr := rows.Scan(&item.ID, &item.UserID, &kind, &item.Status, &item.RequestedAt, &sched); scanErr != nil {
			return nil, scanErr
		}
		item.Kind = domain.ComplianceRequestKind(kind)
		if sched.Valid {
			t := sched.Time.UTC()
			item.ScheduledFor = &t
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

// CreateAIReport registra denúncia de conteúdo de IA via DefaultWriterQueue.
func (r *StoreComplianceRepositorySQLite) CreateAIReport(ctx context.Context, rep *domain.AIContentReport) error {
	if rep.ID == "" {
		rep.ID = uuid.NewString()
	}
	if rep.CreatedAt.IsZero() {
		rep.CreatedAt = time.Now().UTC()
	}
	const q = `
		INSERT INTO ai_content_reports (id, user_id, thread_id, reason, created_at)
		VALUES (?, ?, ?, ?, ?)
	`
	return ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, q, rep.ID, rep.UserID, rep.ThreadID, rep.Reason, rep.CreatedAt)
		return err
	})
}

// CreateSupportRequest registra chamado de suporte do usuário via DefaultWriterQueue.
func (r *StoreComplianceRepositorySQLite) CreateSupportRequest(ctx context.Context, req *domain.SupportRequest) error {
	if req.ID == "" {
		req.ID = uuid.NewString()
	}
	if req.CreatedAt.IsZero() {
		req.CreatedAt = time.Now().UTC()
	}
	if req.Status == "" {
		req.Status = "received"
	}
	const q = `
		INSERT INTO support_requests (id, user_id, subject, message, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	return ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, q, req.ID, req.UserID, req.Subject, req.Message, req.Status, req.CreatedAt)
		return err
	})
}

// CollectLGPDExportData reúne todos os dados portáveis do usuário autenticado sem segredos.
func (r *StoreComplianceRepositorySQLite) CollectLGPDExportData(ctx context.Context, userID string) (*domain.LGPDExportData, error) {
	data := &domain.LGPDExportData{
		Events:        []domain.Event{},
		Todos:         []domain.Todo{},
		Memories:      []domain.Memory{},
		Bots:          []domain.Bot{},
		Notifications: []domain.UserNotification{},
	}

	userRepo := NewUserRepository(r.db)
	if u, err := userRepo.GetByID(userID); err == nil && u != nil {
		u.PasswordHash = ""
		data.User = u
	}

	eventRepo := NewEventRepository(r.db)
	from := time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC)
	if evs, err := eventRepo.ListByUser(userID, from, to); err == nil && evs != nil {
		data.Events = evs
	}

	todoRepo := NewTodoRepository(r.db)
	if tds, err := todoRepo.ListByUser(userID, ""); err == nil && tds != nil {
		data.Todos = tds
	}

	memRepo := NewMemoryRepository(r.db)
	if mems, err := memRepo.ListByUser(userID, 1000); err == nil && mems != nil {
		data.Memories = mems
	}

	botRepo := NewBotRepository(r.db)
	if bots, err := botRepo.ListByUser(ctx, userID); err == nil && bots != nil {
		data.Bots = bots
	}

	inboxRepo := NewNotificationsInboxRepository(r.db)
	if notifs, _, err := inboxRepo.ListByUser(ctx, userID, domain.NotificationInboxFilter{
		IncludeDismissed: true,
		Limit:            200,
	}); err == nil && notifs != nil {
		data.Notifications = notifs
	}
	if prefs, err := inboxRepo.GetPreferences(ctx, userID); err == nil {
		data.NotificationPreferences = prefs
	}
	if priv, err := r.GetPrivacySettings(ctx, userID); err == nil {
		data.PrivacySettings = priv
	}
	if sub, err := r.GetSubscription(ctx, userID); err == nil {
		data.Subscription = sub
	}

	return data, nil
}
