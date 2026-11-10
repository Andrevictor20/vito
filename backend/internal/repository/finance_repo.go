package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// FinanceRepository define o contrato de persistência financeira em SQLite.
type FinanceRepository interface {
	UpsertConnection(ctx context.Context, conn *domain.FinanceConnection) error
	GetConnection(ctx context.Context, userID, connectionID string) (*domain.FinanceConnection, error)
	GetConnectionByPluggyItemID(ctx context.Context, userID, pluggyItemID string) (*domain.FinanceConnection, error)
	ListConnections(ctx context.Context, userID string) ([]domain.FinanceConnection, error)
	DeleteConnection(ctx context.Context, userID, connectionID string) error

	UpsertAccountsBatch(ctx context.Context, userID string, accounts []domain.FinanceAccount) error
	ListAccounts(ctx context.Context, userID string) ([]domain.FinanceAccount, error)
	GetAccount(ctx context.Context, userID, accountID string) (*domain.FinanceAccount, error)

	UpsertTransactionsBatch(ctx context.Context, userID string, transactions []domain.FinanceTransaction) error
	ListTransactions(ctx context.Context, userID string, limit, offset int) ([]domain.FinanceTransaction, error)
	ListTransactionsByCategory(ctx context.Context, userID, category string, limit, offset int) ([]domain.FinanceTransaction, error)

	GetFinancialSummary(ctx context.Context, userID string, now time.Time) (*domain.FinancialSummary, error)
	ListBudgetsAndGoals(ctx context.Context, userID string) ([]domain.FinanceBudgetAndGoal, error)
	UpsertBudgetOrGoal(ctx context.Context, item *domain.FinanceBudgetAndGoal) error
}

type sqliteFinanceRepo struct {
	db *sql.DB
}

// NewFinanceRepository instancia o repositório financeiro com SQLite WAL.
func NewFinanceRepository(db *sql.DB) FinanceRepository {
	return &sqliteFinanceRepo{db: db}
}

func (r *sqliteFinanceRepo) UpsertConnection(ctx context.Context, conn *domain.FinanceConnection) error {
	if conn.ID == "" {
		conn.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	if conn.CreatedAt.IsZero() {
		conn.CreatedAt = now
	}
	conn.UpdatedAt = now

	query := `
		INSERT INTO finance_connections (
			id, user_id, pluggy_item_id, connector_id, institution_name, status,
			last_sync_at, consent_expires_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(pluggy_item_id) DO UPDATE SET
			connector_id = excluded.connector_id,
			institution_name = excluded.institution_name,
			status = excluded.status,
			last_sync_at = excluded.last_sync_at,
			consent_expires_at = excluded.consent_expires_at,
			updated_at = excluded.updated_at
	`
	_, err := r.db.ExecContext(ctx, query,
		conn.ID, conn.UserID, conn.PluggyItemID, conn.ConnectorID, conn.InstitutionName,
		conn.Status, conn.LastSyncAt, conn.ConsentExpiresAt, conn.CreatedAt, conn.UpdatedAt,
	)
	return err
}

func (r *sqliteFinanceRepo) GetConnection(ctx context.Context, userID, connectionID string) (*domain.FinanceConnection, error) {
	query := `
		SELECT id, user_id, pluggy_item_id, connector_id, institution_name, status,
		       last_sync_at, consent_expires_at, created_at, updated_at
		FROM finance_connections
		WHERE user_id = ? AND id = ?
	`
	row := r.db.QueryRowContext(ctx, query, userID, connectionID)
	return scanConnection(row)
}

func (r *sqliteFinanceRepo) GetConnectionByPluggyItemID(ctx context.Context, userID, pluggyItemID string) (*domain.FinanceConnection, error) {
	query := `
		SELECT id, user_id, pluggy_item_id, connector_id, institution_name, status,
		       last_sync_at, consent_expires_at, created_at, updated_at
		FROM finance_connections
		WHERE user_id = ? AND pluggy_item_id = ?
	`
	row := r.db.QueryRowContext(ctx, query, userID, pluggyItemID)
	return scanConnection(row)
}

func scanConnection(scanner interface{ Scan(dest ...any) error }) (*domain.FinanceConnection, error) {
	var conn domain.FinanceConnection
	var lastSync, consentExp sql.NullTime
	err := scanner.Scan(
		&conn.ID, &conn.UserID, &conn.PluggyItemID, &conn.ConnectorID, &conn.InstitutionName,
		&conn.Status, &lastSync, &consentExp, &conn.CreatedAt, &conn.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrFinanceConnectionNotFound
	}
	if err != nil {
		return nil, err
	}
	if lastSync.Valid {
		t := lastSync.Time.UTC()
		conn.LastSyncAt = &t
	}
	if consentExp.Valid {
		t := consentExp.Time.UTC()
		conn.ConsentExpiresAt = &t
	}
	return &conn, nil
}

func (r *sqliteFinanceRepo) ListConnections(ctx context.Context, userID string) ([]domain.FinanceConnection, error) {
	query := `
		SELECT id, user_id, pluggy_item_id, connector_id, institution_name, status,
		       last_sync_at, consent_expires_at, created_at, updated_at
		FROM finance_connections
		WHERE user_id = ?
		ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.FinanceConnection
	for rows.Next() {
		c, err := scanConnection(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *c)
	}
	return list, rows.Err()
}

func (r *sqliteFinanceRepo) DeleteConnection(ctx context.Context, userID, connectionID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM finance_connections WHERE user_id = ? AND id = ?`, userID, connectionID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrFinanceConnectionNotFound
	}
	return nil
}

func (r *sqliteFinanceRepo) UpsertAccountsBatch(ctx context.Context, userID string, accounts []domain.FinanceAccount) error {
	if len(accounts) == 0 {
		return nil
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO finance_accounts (
			id, user_id, connection_id, pluggy_account_id, institution_name,
			account_type, account_subtype, name, balance, credit_limit,
			available_credit_limit, currency_code, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(pluggy_account_id) DO UPDATE SET
			institution_name = excluded.institution_name,
			account_type = excluded.account_type,
			account_subtype = excluded.account_subtype,
			name = excluded.name,
			balance = excluded.balance,
			credit_limit = excluded.credit_limit,
			available_credit_limit = excluded.available_credit_limit,
			currency_code = excluded.currency_code,
			updated_at = excluded.updated_at
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now().UTC()
	for _, a := range accounts {
		id := a.ID
		if id == "" {
			id = uuid.NewString()
		}
		currency := a.CurrencyCode
		if currency == "" {
			currency = "BRL"
		}
		var connID any = a.ConnectionID
		if a.ConnectionID == "" {
			connID = nil
		}
		_, err := stmt.ExecContext(ctx,
			id, userID, connID, a.PluggyAccountID, a.InstitutionName,
			a.AccountType, a.AccountSubtype, a.Name, a.Balance, a.CreditLimit,
			a.AvailableCreditLimit, currency, now,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *sqliteFinanceRepo) ListAccounts(ctx context.Context, userID string) ([]domain.FinanceAccount, error) {
	query := `
		SELECT id, user_id, connection_id, pluggy_account_id, institution_name,
		       account_type, account_subtype, name, balance, credit_limit,
		       available_credit_limit, currency_code, updated_at
		FROM finance_accounts
		WHERE user_id = ?
		ORDER BY institution_name ASC, name ASC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []domain.FinanceAccount
	for rows.Next() {
		var a domain.FinanceAccount
		var sub sql.NullString
		var credLimit, availLimit sql.NullFloat64
		err := rows.Scan(
			&a.ID, &a.UserID, &a.ConnectionID, &a.PluggyAccountID, &a.InstitutionName,
			&a.AccountType, &sub, &a.Name, &a.Balance, &credLimit,
			&availLimit, &a.CurrencyCode, &a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if sub.Valid {
			a.AccountSubtype = sub.String
		}
		if credLimit.Valid {
			v := credLimit.Float64
			a.CreditLimit = &v
		}
		if availLimit.Valid {
			v := availLimit.Float64
			a.AvailableCreditLimit = &v
		}
		accounts = append(accounts, a)
	}
	return accounts, rows.Err()
}

func (r *sqliteFinanceRepo) GetAccount(ctx context.Context, userID, accountID string) (*domain.FinanceAccount, error) {
	query := `
		SELECT id, user_id, connection_id, pluggy_account_id, institution_name,
		       account_type, account_subtype, name, balance, credit_limit,
		       available_credit_limit, currency_code, updated_at
		FROM finance_accounts
		WHERE user_id = ? AND id = ?
	`
	row := r.db.QueryRowContext(ctx, query, userID, accountID)
	var a domain.FinanceAccount
	var sub sql.NullString
	var credLimit, availLimit sql.NullFloat64
	err := row.Scan(
		&a.ID, &a.UserID, &a.ConnectionID, &a.PluggyAccountID, &a.InstitutionName,
		&a.AccountType, &sub, &a.Name, &a.Balance, &credLimit,
		&availLimit, &a.CurrencyCode, &a.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrFinanceAccountNotFound
	}
	if err != nil {
		return nil, err
	}
	if sub.Valid {
		a.AccountSubtype = sub.String
	}
	if credLimit.Valid {
		v := credLimit.Float64
		a.CreditLimit = &v
	}
	if availLimit.Valid {
		v := availLimit.Float64
		a.AvailableCreditLimit = &v
	}
	return &a, nil
}

func (r *sqliteFinanceRepo) ListBudgetsAndGoals(ctx context.Context, userID string) ([]domain.FinanceBudgetAndGoal, error) {
	query := `
		SELECT id, user_id, kind, title, category_filter, target_amount,
		       current_amount, deadline_date, auto_alert_threshold, created_at, updated_at
		FROM finance_budgets_and_goals
		WHERE user_id = ?
		ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.FinanceBudgetAndGoal
	for rows.Next() {
		var item domain.FinanceBudgetAndGoal
		var catFilter, deadline sql.NullString
		err := rows.Scan(
			&item.ID, &item.UserID, &item.Kind, &item.Title, &catFilter,
			&item.TargetAmount, &item.CurrentAmount, &deadline,
			&item.AutoAlertThreshold, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if catFilter.Valid {
			item.CategoryFilter = catFilter.String
		}
		if deadline.Valid {
			item.DeadlineDate = deadline.String
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r *sqliteFinanceRepo) UpsertBudgetOrGoal(ctx context.Context, item *domain.FinanceBudgetAndGoal) error {
	if item.ID == "" {
		item.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	if item.CreatedAt.IsZero() {
		item.CreatedAt = now
	}
	item.UpdatedAt = now

	query := `
		INSERT INTO finance_budgets_and_goals (
			id, user_id, kind, title, category_filter, target_amount,
			current_amount, deadline_date, auto_alert_threshold, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			category_filter = excluded.category_filter,
			target_amount = excluded.target_amount,
			current_amount = excluded.current_amount,
			deadline_date = excluded.deadline_date,
			auto_alert_threshold = excluded.auto_alert_threshold,
			updated_at = excluded.updated_at
	`
	_, err := r.db.ExecContext(ctx, query,
		item.ID, item.UserID, item.Kind, item.Title, item.CategoryFilter,
		item.TargetAmount, item.CurrentAmount, item.DeadlineDate,
		item.AutoAlertThreshold, item.CreatedAt, item.UpdatedAt,
	)
	return err
}
