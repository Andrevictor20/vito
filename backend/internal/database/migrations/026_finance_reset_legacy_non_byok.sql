-- 026_finance_reset_legacy_non_byok.sql: Zera conexões e dados financeiros legados (pré-BYOK)
-- de usuários que ainda não possuem backup/credenciais BYOK em finance_byok_backup.
-- Usuários que já migraram para BYOK preservam integralmente suas contas e histórico.

DELETE FROM finance_transactions
WHERE user_id NOT IN (SELECT user_id FROM finance_byok_backup);

DELETE FROM finance_installment_plans
WHERE user_id NOT IN (SELECT user_id FROM finance_byok_backup);

DELETE FROM finance_credit_bills
WHERE user_id NOT IN (SELECT user_id FROM finance_byok_backup);

DELETE FROM finance_accounts
WHERE user_id NOT IN (SELECT user_id FROM finance_byok_backup);

DELETE FROM finance_connections
WHERE user_id NOT IN (SELECT user_id FROM finance_byok_backup);

DELETE FROM finance_category_rules
WHERE user_id NOT IN (SELECT user_id FROM finance_byok_backup);

DELETE FROM finance_merchants
WHERE user_id NOT IN (SELECT user_id FROM finance_byok_backup);

DELETE FROM finance_budgets_and_goals
WHERE user_id NOT IN (SELECT user_id FROM finance_byok_backup);
