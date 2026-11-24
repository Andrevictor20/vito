package repository

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// FinanceAnalyticsRepository provê consultas analíticas, extrato filtrado, cartões e recategorização.
type FinanceAnalyticsRepository interface {
	SearchTransactions(ctx context.Context, userID string, filter domain.FinanceTransactionFilter) ([]domain.FinanceTransaction, error)
	RecategorizeTransaction(ctx context.Context, userID, txID, category string, applyToMerchant bool) (int64, error)
	GetCashFlowAnalytics(ctx context.Context, userID string, months int, now time.Time) ([]domain.FinanceCashFlowPoint, error)
	GetCardsOverview(ctx context.Context, userID string, now time.Time) ([]domain.FinanceCardOverview, error)
	GetCardBills(ctx context.Context, userID, accountID string) ([]domain.FinanceCreditBill, error)
	GetInstallmentPlans(ctx context.Context, userID string) ([]domain.FinanceInstallmentPlan, error)
	GetFinanceCalendar(ctx context.Context, userID string, from, to time.Time) ([]domain.FinanceCalendarEvent, error)
}

type sqliteFinanceAnalyticsRepo struct {
	db *sql.DB
}

// NewFinanceAnalyticsRepository instancia o repositório analítico financeiro em SQLite.
func NewFinanceAnalyticsRepository(db *sql.DB) FinanceAnalyticsRepository {
	return &sqliteFinanceAnalyticsRepo{db: db}
}

func (r *sqliteFinanceAnalyticsRepo) SearchTransactions(ctx context.Context, userID string, filter domain.FinanceTransactionFilter) ([]domain.FinanceTransaction, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	where := []string{"user_id = ?"}
	args := []any{userID}

	if q := strings.TrimSpace(filter.Query); q != "" {
		pat := "%" + strings.ToLower(q) + "%"
		where = append(where, "(LOWER(description) LIKE ? OR LOWER(COALESCE(clean_merchant_name,'')) LIKE ? OR LOWER(COALESCE(category,'')) LIKE ?)")
		args = append(args, pat, pat, pat)
	}
	if filter.AccountID != "" {
		where = append(where, "account_id = ?")
		args = append(args, filter.AccountID)
	}
	if filter.Category != "" {
		where = append(where, "LOWER(category) = LOWER(?)")
		args = append(args, filter.Category)
	}
	if filter.TxType != "" {
		where = append(where, "UPPER(transaction_type) = UPPER(?)")
		args = append(args, filter.TxType)
	}
	if filter.From != nil {
		where = append(where, "occurred_at >= ?")
		args = append(args, filter.From.UTC())
	}
	if filter.To != nil {
		where = append(where, "occurred_at <= ?")
		args = append(args, filter.To.UTC())
	}

	args = append(args, limit, offset)
	query := `
		SELECT id, user_id, COALESCE(account_id,''), pluggy_transaction_id, description,
		       COALESCE(clean_merchant_name,''), amount, transaction_type,
		       COALESCE(payment_method,''), COALESCE(category,'Outros'), is_recurring,
		       installment_number, total_installments, COALESCE(payment_type,''), mcc,
		       COALESCE(tx_status,'POSTED'), occurred_at, created_at
		FROM finance_transactions
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY occurred_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.FinanceTransaction
	for rows.Next() {
		var tx domain.FinanceTransaction
		var rec int
		var instNum, totInst, mcc sql.NullInt64
		if err := rows.Scan(
			&tx.ID, &tx.UserID, &tx.AccountID, &tx.PluggyTransactionID, &tx.Description,
			&tx.CleanMerchantName, &tx.Amount, &tx.TransactionType,
			&tx.PaymentMethod, &tx.Category, &rec,
			&instNum, &totInst, &tx.PaymentType, &mcc,
			&tx.Status, &tx.OccurredAt, &tx.CreatedAt,
		); err != nil {
			return nil, err
		}
		tx.IsRecurring = rec != 0
		if instNum.Valid {
			v := int(instNum.Int64)
			tx.InstallmentNumber = &v
		}
		if totInst.Valid {
			v := int(totInst.Int64)
			tx.TotalInstallments = &v
		}
		if mcc.Valid {
			v := int(mcc.Int64)
			tx.MCC = &v
		}
		out = append(out, tx)
	}
	return out, rows.Err()
}

func (r *sqliteFinanceAnalyticsRepo) RecategorizeTransaction(ctx context.Context, userID, txID, category string, applyToMerchant bool) (int64, error) {
	category = strings.TrimSpace(category)
	if category == "" {
		return 0, domain.ErrFinanceInvalidPayload
	}

	var merchantID, merchantName sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT merchant_id, COALESCE(NULLIF(clean_merchant_name,''), description)
		FROM finance_transactions
		WHERE user_id = ? AND id = ?
	`, userID, txID).Scan(&merchantID, &merchantName)
	if errorsIsNoRows(err) {
		return 0, domain.ErrFinanceInvalidPayload
	}
	if err != nil {
		return 0, err
	}

	var totalUpdated int64
	err = ExecuteQueuedWrite(ctx, func() error {
		res, execErr := r.db.ExecContext(ctx, `
			UPDATE finance_transactions SET category = ? WHERE user_id = ? AND id = ?
		`, category, userID, txID)
		if execErr != nil {
			return execErr
		}
		n, _ := res.RowsAffected()
		totalUpdated += n

		if applyToMerchant {
			if merchantID.Valid && merchantID.String != "" {
				_, _ = r.db.ExecContext(ctx, `
					INSERT INTO finance_category_rules (id, user_id, merchant_id, category, created_at)
					VALUES (?, ?, ?, ?, ?)
					ON CONFLICT(user_id, merchant_id) DO UPDATE SET category = excluded.category
				`, uuid.NewString(), userID, merchantID.String, category, time.Now().UTC())
				res2, _ := r.db.ExecContext(ctx, `
					UPDATE finance_transactions SET category = ? WHERE user_id = ? AND merchant_id = ? AND id <> ?
				`, category, userID, merchantID.String, txID)
				if res2 != nil {
					n2, _ := res2.RowsAffected()
					totalUpdated += n2
				}
			} else if merchantName.Valid && strings.TrimSpace(merchantName.String) != "" {
				res2, _ := r.db.ExecContext(ctx, `
					UPDATE finance_transactions
					SET category = ?
					WHERE user_id = ? AND id <> ?
					  AND LOWER(COALESCE(NULLIF(clean_merchant_name,''), description)) = LOWER(?)
				`, category, userID, txID, merchantName.String)
				if res2 != nil {
					n2, _ := res2.RowsAffected()
					totalUpdated += n2
				}
			}
		}
		return nil
	})
	return totalUpdated, err
}

func (r *sqliteFinanceAnalyticsRepo) GetCashFlowAnalytics(ctx context.Context, userID string, months int, now time.Time) ([]domain.FinanceCashFlowPoint, error) {
	if months <= 0 || months > 24 {
		months = 6
	}
	start := time.Date(now.UTC().Year(), now.UTC().Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -(months - 1), 0)
	rows, err := r.db.QueryContext(ctx, `
		SELECT strftime('%Y-%m', occurred_at) AS ym,
		       COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS inc,
		       COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS exp
		FROM finance_transactions
		WHERE user_id = ? AND occurred_at >= ?
		GROUP BY ym
		ORDER BY ym ASC
	`, userID, start)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.FinanceCashFlowPoint
	for rows.Next() {
		var p domain.FinanceCashFlowPoint
		if err := rows.Scan(&p.Month, &p.Income, &p.Expense); err != nil {
			return nil, err
		}
		p.Net = p.Income - p.Expense
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *sqliteFinanceAnalyticsRepo) GetCardsOverview(ctx context.Context, userID string, now time.Time) ([]domain.FinanceCardOverview, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, COALESCE(connection_id,''), pluggy_account_id, institution_name,
		       account_type, COALESCE(account_subtype,''), name, balance,
		       credit_limit, available_credit_limit, currency_code,
		       closing_day, due_day, minimum_payment, updated_at
		FROM finance_accounts
		WHERE user_id = ? AND account_type = 'CREDIT'
		ORDER BY institution_name ASC, name ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cards []domain.FinanceCardOverview
	for rows.Next() {
		var acc domain.FinanceAccount
		var cl, acl, minPay sql.NullFloat64
		var cd, dd sql.NullInt64
		if err := rows.Scan(
			&acc.ID, &acc.UserID, &acc.ConnectionID, &acc.PluggyAccountID, &acc.InstitutionName,
			&acc.AccountType, &acc.AccountSubtype, &acc.Name, &acc.Balance,
			&cl, &acl, &acc.CurrencyCode, &cd, &dd, &minPay, &acc.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if cl.Valid {
			acc.CreditLimit = &cl.Float64
		}
		if acl.Valid {
			acc.AvailableCreditLimit = &acl.Float64
		}
		if cd.Valid {
			v := int(cd.Int64)
			acc.ClosingDay = &v
		}
		if dd.Valid {
			v := int(dd.Int64)
			acc.DueDay = &v
		}
		if minPay.Valid {
			acc.MinimumPayment = &minPay.Float64
		}

		billTotal := acc.Balance
		if billTotal < 0 {
			billTotal = -billTotal
		}
		usagePct := 0.0
		if acc.CreditLimit != nil && *acc.CreditLimit > 0 {
			usagePct = (billTotal / *acc.CreditLimit) * 100
		}
		nextDue := ""
		if acc.DueDay != nil && *acc.DueDay >= 1 {
			d := time.Date(now.UTC().Year(), now.UTC().Month(), minInt(*acc.DueDay, daysInMonth(now.UTC().Year(), now.UTC().Month())), 0, 0, 0, 0, time.UTC)
			if d.Before(now.UTC().Truncate(24 * time.Hour)) {
				n := d.AddDate(0, 1, 0)
				d = time.Date(n.Year(), n.Month(), minInt(*acc.DueDay, daysInMonth(n.Year(), n.Month())), 0, 0, 0, 0, time.UTC)
			}
			nextDue = d.Format("2006-01-02")
		}

		cards = append(cards, domain.FinanceCardOverview{
			Account:          acc,
			CurrentBillTotal: billTotal,
			IsEstimated:      true,
			NextDueDate:      nextDue,
			UsagePercent:     usagePct,
		})
	}
	return cards, rows.Err()
}

func (r *sqliteFinanceAnalyticsRepo) GetCardBills(ctx context.Context, userID, accountID string) ([]domain.FinanceCreditBill, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, account_id, COALESCE(pluggy_bill_id,''), COALESCE(closing_date,''),
		       due_date, total_amount, minimum_payment, finance_charges, status, is_estimated
		FROM finance_credit_bills
		WHERE user_id = ? AND account_id = ?
		ORDER BY due_date DESC
		LIMIT 12
	`, userID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.FinanceCreditBill
	for rows.Next() {
		var b domain.FinanceCreditBill
		var minPay, charges sql.NullFloat64
		var isEst int
		if err := rows.Scan(
			&b.ID, &b.UserID, &b.AccountID, &b.PluggyBillID, &b.ClosingDate,
			&b.DueDate, &b.TotalAmount, &minPay, &charges, &b.Status, &isEst,
		); err != nil {
			return nil, err
		}
		b.IsEstimated = isEst != 0
		if minPay.Valid {
			b.MinimumPayment = &minPay.Float64
		}
		if charges.Valid {
			b.FinanceCharges = &charges.Float64
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (r *sqliteFinanceAnalyticsRepo) GetInstallmentPlans(ctx context.Context, userID string) ([]domain.FinanceInstallmentPlan, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, account_id, COALESCE(merchant_id,''), plan_key, merchant_name,
		       installment_count, installment_amount, COALESCE(total_amount, 0),
		       COALESCE(first_due_date, ''), source
		FROM finance_installment_plans
		WHERE user_id = ?
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.FinanceInstallmentPlan
	for rows.Next() {
		var p domain.FinanceInstallmentPlan
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.AccountID, &p.MerchantID, &p.PlanKey, &p.MerchantName,
			&p.InstallmentCount, &p.InstallmentAmount, &p.TotalAmount,
			&p.FirstDueDate, &p.Source,
		); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *sqliteFinanceAnalyticsRepo) GetFinanceCalendar(ctx context.Context, userID string, from, to time.Time) ([]domain.FinanceCalendarEvent, error) {
	var events []domain.FinanceCalendarEvent
	cards, err := r.GetCardsOverview(ctx, userID, from)
	if err == nil {
		for _, c := range cards {
			if c.NextDueDate != "" && c.CurrentBillTotal > 0 {
				events = append(events, domain.FinanceCalendarEvent{
					ID:          "bill:" + c.Account.ID + ":" + c.NextDueDate,
					Kind:        "BILL_DUE",
					Title:       "Fatura " + c.Account.Name,
					Date:        c.NextDueDate,
					Amount:      c.CurrentBillTotal,
					AccountName: c.Account.InstitutionName,
				})
			}
		}
	}
	return events, nil
}

func errorsIsNoRows(err error) bool {
	return err == sql.ErrNoRows
}
