package database

import "database/sql"

// applyFinanceCardsMigration aplica a 024 de forma idempotente: cada coluna nova
// tem guarda individual (hasColumn) e só depois roda o script de tabelas/índices.
func applyFinanceCardsMigration(db *sql.DB, scriptPath string) error {
	// Tabelas referenciadas pelas colunas novas precisam existir antes dos ALTERs.
	content, err := migrationFS.ReadFile(scriptPath)
	if err != nil {
		return err
	}
	if _, err := db.Exec(string(content)); err != nil {
		return err
	}
	cols := []struct{ table, name, ddl string }{
		{"finance_transactions", "installment_number", "ALTER TABLE finance_transactions ADD COLUMN installment_number INTEGER"},
		{"finance_transactions", "total_installments", "ALTER TABLE finance_transactions ADD COLUMN total_installments INTEGER"},
		{"finance_transactions", "installment_plan_id", "ALTER TABLE finance_transactions ADD COLUMN installment_plan_id TEXT REFERENCES finance_installment_plans(id) ON DELETE SET NULL"},
		{"finance_transactions", "bill_id", "ALTER TABLE finance_transactions ADD COLUMN bill_id TEXT REFERENCES finance_credit_bills(id) ON DELETE SET NULL"},
		{"finance_transactions", "merchant_id", "ALTER TABLE finance_transactions ADD COLUMN merchant_id TEXT REFERENCES finance_merchants(id) ON DELETE SET NULL"},
		{"finance_transactions", "payment_type", "ALTER TABLE finance_transactions ADD COLUMN payment_type TEXT"},
		{"finance_transactions", "mcc", "ALTER TABLE finance_transactions ADD COLUMN mcc INTEGER"},
		{"finance_transactions", "tx_status", "ALTER TABLE finance_transactions ADD COLUMN tx_status TEXT NOT NULL DEFAULT 'POSTED'"},
		{"finance_accounts", "closing_day", "ALTER TABLE finance_accounts ADD COLUMN closing_day INTEGER"},
		{"finance_accounts", "due_day", "ALTER TABLE finance_accounts ADD COLUMN due_day INTEGER"},
		{"finance_accounts", "minimum_payment", "ALTER TABLE finance_accounts ADD COLUMN minimum_payment REAL"},
	}
	for _, c := range cols {
		if !hasColumn(db, c.table, c.name) {
			if _, err := db.Exec(c.ddl); err != nil {
				return err
			}
		}
	}
	// Índices dependentes das colunas novas (criados após os ALTERs).
	idx := []string{
		`CREATE INDEX IF NOT EXISTS idx_fin_tx_bill ON finance_transactions(user_id, bill_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fin_tx_plan ON finance_transactions(user_id, installment_plan_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fin_tx_merchant ON finance_transactions(user_id, merchant_id, occurred_at DESC)`,
	}
	for _, q := range idx {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}
