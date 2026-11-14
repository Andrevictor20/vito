package repository

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

func (r *sqliteFinanceRepo) UpsertTransactionsBatch(ctx context.Context, userID string, transactions []domain.FinanceTransaction) error {
	if len(transactions) == 0 {
		return nil
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO finance_transactions (
			id, user_id, account_id, pluggy_transaction_id, description,
			clean_merchant_name, amount, transaction_type, payment_method,
			category, is_recurring, occurred_at, created_at,
			installment_number, total_installments, payment_type, mcc, tx_status
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(pluggy_transaction_id) DO UPDATE SET
			installment_number = excluded.installment_number,
			total_installments = excluded.total_installments,
			payment_type = excluded.payment_type,
			mcc = excluded.mcc,
			tx_status = excluded.tx_status,
			description = excluded.description,
			clean_merchant_name = excluded.clean_merchant_name,
			amount = excluded.amount,
			transaction_type = excluded.transaction_type,
			payment_method = excluded.payment_method,
			category = excluded.category,
			is_recurring = excluded.is_recurring,
			occurred_at = excluded.occurred_at
		WHERE finance_transactions.user_id = excluded.user_id
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now().UTC()
	for _, t := range transactions {
		id := t.ID
		if id == "" {
			id = uuid.NewString()
		}
		isRec := 0
		if t.IsRecurring {
			isRec = 1
		}
		cat := t.Category
		if cat == "" {
			cat = "Outros"
		}
		accountID, ok, err := resolveTxAccountID(ctx, tx, userID, t)
		if err != nil {
			return err
		}
		if !ok {
			continue // conta desconhecida: ignora a transação órfã sem derrubar o lote
		}
		status := t.Status
		if status == "" {
			status = "POSTED"
		}
		_, err = stmt.ExecContext(ctx,
			id, userID, accountID, t.PluggyTransactionID, t.Description,
			t.CleanMerchantName, t.Amount, t.TransactionType, t.PaymentMethod,
			cat, isRec, t.OccurredAt.UTC(), now,
			t.InstallmentNumber, t.TotalInstallments, nullIfEmpty(t.PaymentType), t.MCC, status,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *sqliteFinanceRepo) ListTransactions(ctx context.Context, userID string, limit, offset int) ([]domain.FinanceTransaction, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT id, user_id, account_id, pluggy_transaction_id, description,
		       clean_merchant_name, amount, transaction_type, payment_method,
		       category, is_recurring, occurred_at, created_at,
		       installment_number, total_installments, payment_type, mcc, tx_status
		FROM finance_transactions
		WHERE user_id = ?
		ORDER BY occurred_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.FinanceTransaction
	for rows.Next() {
		var t domain.FinanceTransaction
		var clean sql.NullString
		var payMethod sql.NullString
		var isRec int
		var instNum, instTotal, mcc sql.NullInt64
		var payType, status sql.NullString
		err := rows.Scan(
			&t.ID, &t.UserID, &t.AccountID, &t.PluggyTransactionID, &t.Description,
			&clean, &t.Amount, &t.TransactionType, &payMethod,
			&t.Category, &isRec, &t.OccurredAt, &t.CreatedAt,
			&instNum, &instTotal, &payType, &mcc, &status,
		)
		if err != nil {
			return nil, err
		}
		applyTxCardMeta(&t, instNum, instTotal, mcc, payType, status)
		t.IsRecurring = (isRec == 1)
		if clean.Valid {
			t.CleanMerchantName = clean.String
		}
		if payMethod.Valid {
			t.PaymentMethod = payMethod.String
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (r *sqliteFinanceRepo) ListTransactionsByCategory(ctx context.Context, userID, category string, limit, offset int) ([]domain.FinanceTransaction, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT id, user_id, account_id, pluggy_transaction_id, description,
		       clean_merchant_name, amount, transaction_type, payment_method,
		       category, is_recurring, occurred_at, created_at
		FROM finance_transactions
		WHERE user_id = ? AND category = ?
		ORDER BY occurred_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.db.QueryContext(ctx, query, userID, category, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.FinanceTransaction
	for rows.Next() {
		var t domain.FinanceTransaction
		var clean sql.NullString
		var payMethod sql.NullString
		var isRec int
		err := rows.Scan(
			&t.ID, &t.UserID, &t.AccountID, &t.PluggyTransactionID, &t.Description,
			&clean, &t.Amount, &t.TransactionType, &payMethod,
			&t.Category, &isRec, &t.OccurredAt, &t.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		t.IsRecurring = (isRec == 1)
		if clean.Valid {
			t.CleanMerchantName = clean.String
		}
		if payMethod.Valid {
			t.PaymentMethod = payMethod.String
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (r *sqliteFinanceRepo) GetFinancialSummary(ctx context.Context, userID string, now time.Time) (*domain.FinancialSummary, error) {
	if now.IsZero() {
		now = time.Now().UTC()
	}
	year, month, day := now.Date()
	startOfMonth := time.Date(year, month, 1, 0, 0, 0, 0, now.Location()).UTC()
	startOfNextMonth := startOfMonth.AddDate(0, 1, 0)
	daysInMonth := int(startOfNextMonth.Sub(startOfMonth).Hours() / 24)
	daysRemaining := daysInMonth - day + 1
	if daysRemaining <= 0 {
		daysRemaining = 1
	}
	monthPercent := (float64(day) / float64(daysInMonth)) * 100.0

	summary := &domain.FinancialSummary{
		SafeToSpendDaysRemaining: daysRemaining,
		SafeToSpendMonthPercent:  math.Round(monthPercent*10) / 10,
		DaysRemainingInMonth:     daysRemaining,
		MonthProgressPercent:     math.Round(monthPercent*10) / 10,
		CategorySpending:         []domain.CategorySpendItem{},
		Alerts:                   []domain.FinanceAlert{},
		AttentionAlerts:          []domain.FinanceAlert{},
		Subscriptions:            []domain.SubscriptionItem{},
		HeadlineStatus:           "Nenhuma conta conectada",
	}

	// 0. Quantidade de conexões
	_ = r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM finance_connections WHERE user_id = ?
	`, userID).Scan(&summary.ConnectedInstitutionsCount)

	// 1. Saldo Consolidado em Contas Bancárias (BANK)
	err := r.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(balance), 0.0)
		FROM finance_accounts
		WHERE user_id = ? AND account_type = 'BANK'
	`, userID).Scan(&summary.ConsolidatedBalance)
	if err != nil {
		return nil, err
	}

	// 2. Faturas em Aberto / Cartões de Crédito (CREDIT)
	var creditSum float64
	err = r.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(ABS(balance)), 0.0)
		FROM finance_accounts
		WHERE user_id = ? AND account_type = 'CREDIT'
	`, userID).Scan(&creditSum)
	if err != nil {
		return nil, err
	}
	summary.OpenInvoicesTotal = creditSum

	// 3. Despesas e Receitas do Mês Atual
	err = r.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(ABS(amount)), 0.0)
		FROM finance_transactions
		WHERE user_id = ? AND occurred_at >= ? AND occurred_at < ?
		  AND (amount < 0 OR transaction_type = 'DEBIT')
	`, userID, startOfMonth, startOfNextMonth).Scan(&summary.MonthExpenses)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount), 0.0)
		FROM finance_transactions
		WHERE user_id = ? AND occurred_at >= ? AND occurred_at < ?
		  AND (amount > 0 OR transaction_type = 'CREDIT')
	`, userID, startOfMonth, startOfNextMonth).Scan(&summary.MonthIncome)
	if err != nil {
		return nil, err
	}

	// 4. Safe-to-Spend Diário
	sobraPrevista := summary.ConsolidatedBalance - summary.OpenInvoicesTotal
	if sobraPrevista > 0 {
		summary.SafeToSpendDaily = math.Round((sobraPrevista/float64(daysRemaining))*100) / 100
	} else {
		summary.SafeToSpendDaily = 0.0
	}

	// 5. Gastos por Categoria no mês
	catRows, err := r.db.QueryContext(ctx, `
		SELECT category, COALESCE(SUM(ABS(amount)), 0.0) as cat_total
		FROM finance_transactions
		WHERE user_id = ? AND occurred_at >= ? AND occurred_at < ?
		  AND (amount < 0 OR transaction_type = 'DEBIT')
		GROUP BY category
		ORDER BY cat_total DESC
	`, userID, startOfMonth, startOfNextMonth)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var item domain.CategorySpendItem
			if scanErr := catRows.Scan(&item.Category, &item.TotalAmount); scanErr == nil {
				if summary.MonthExpenses > 0 {
					item.Percentage = math.Round((item.TotalAmount/summary.MonthExpenses)*1000) / 10
				}
				summary.CategorySpending = append(summary.CategorySpending, item)
			}
		}
	}

	// Preencher aliases e status reais para compatibilidade total
	summary.TotalBalance = summary.ConsolidatedBalance
	summary.OpenCreditCardBills = summary.OpenInvoicesTotal
	summary.ProjectedLeftover = sobraPrevista
	if summary.ConnectedInstitutionsCount > 0 {
		if sobraPrevista >= 0 {
			summary.HeadlineStatus = "Você está bem este mês"
		} else {
			summary.HeadlineStatus = "Atenção: faturas superam o saldo"
		}
	}
	if summary.MonthExpenses > 0 {
		denom := summary.MonthExpenses + math.Max(0, sobraPrevista)
		if denom > 0 {
			summary.PacePercent = math.Round((summary.MonthExpenses / denom) * 100)
		}
	}

	// 6. Assinaturas / Transações recorrentes reais
	subRows, err := r.db.QueryContext(ctx, `
		SELECT COALESCE(NULLIF(clean_merchant_name, ''), description) as merchant,
		       category, ABS(amount), occurred_at
		FROM finance_transactions
		WHERE user_id = ? AND is_recurring = 1
		GROUP BY merchant
		ORDER BY occurred_at DESC
		LIMIT 10
	`, userID)
	if err == nil {
		defer subRows.Close()
		for subRows.Next() {
			var sub domain.SubscriptionItem
			if sErr := subRows.Scan(&sub.MerchantName, &sub.Category, &sub.Amount, &sub.LastChargedAt); sErr == nil {
				sub.Frequency = "monthly"
				summary.Subscriptions = append(summary.Subscriptions, sub)
			}
		}
	}

	return summary, nil
}

// resolveTxAccountID resolve o account_id interno validando ownership do userID:
// valida AccountID quando presente; senão busca por PluggyAccountID.
func resolveTxAccountID(ctx context.Context, tx *sql.Tx, userID string, t domain.FinanceTransaction) (string, bool, error) {
	if t.AccountID != "" {
		var id string
		err := tx.QueryRowContext(ctx,
			`SELECT id FROM finance_accounts WHERE user_id = ? AND id = ?`,
			userID, t.AccountID).Scan(&id)
		if errors.Is(err, sql.ErrNoRows) {
			return "", false, nil
		}
		if err != nil {
			return "", false, err
		}
		return id, true, nil
	}
	if t.PluggyAccountID == "" {
		return "", false, nil
	}
	var id string
	err := tx.QueryRowContext(ctx,
		`SELECT id FROM finance_accounts WHERE user_id = ? AND pluggy_account_id = ?`,
		userID, t.PluggyAccountID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func applyTxCardMeta(t *domain.FinanceTransaction, instNum, instTotal, mcc sql.NullInt64, payType, status sql.NullString) {
	if instNum.Valid {
		v := int(instNum.Int64)
		t.InstallmentNumber = &v
	}
	if instTotal.Valid {
		v := int(instTotal.Int64)
		t.TotalInstallments = &v
	}
	if mcc.Valid {
		v := int(mcc.Int64)
		t.MCC = &v
	}
	t.PaymentType = payType.String
	t.Status = status.String
}
