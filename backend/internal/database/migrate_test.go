package database

import (
	"path/filepath"
	"testing"
)

func TestVersionedMigrations_FreshDB(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "fresh.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if want := len(orderedMigrations()); count != want {
		t.Fatalf("esperava %d migração(ões) registrada(s), vieram %d", want, count)
	}
	if !hasTable(db, "user_ai_providers") ||
		!hasColumn(db, "user_ai_settings", "default_model") ||
		!hasColumn(db, "user_ai_settings", "default_effort") ||
		!hasColumn(db, "conversation_threads", "model_pref") ||
		!hasColumn(db, "conversation_threads", "effort_pref") ||
		!hasColumn(db, "ai_traces", "agent_name") ||
		!hasColumn(db, "ai_traces", "credential_source") ||
		!hasColumn(db, "ai_traces", "provider_key") ||
		!hasColumn(db, "ai_traces", "effort") ||
		!hasColumn(db, "triggers", "model_pref") ||
		!hasColumn(db, "triggers", "effort_pref") {
		t.Fatal("001 deveria criar user_ai_providers e colunas de modelo/esforço em user_ai_settings, conversation_threads, ai_traces e triggers")
	}
	if !hasTable(db, "memory_embeddings") ||
		!hasTable(db, "entity_links") ||
		!hasTable(db, "attention_budget_logs") ||
		!hasTable(db, "ai_eval_runs") {
		t.Fatal("001 deveria criar memory_embeddings, entity_links, attention_budget_logs e ai_eval_runs")
	}
	if !hasTable(db, "finance_byok_backup") ||
		!hasColumn(db, "finance_byok_backup", "user_id") ||
		!hasColumn(db, "finance_byok_backup", "ciphertext") ||
		!hasColumn(db, "finance_byok_backup", "nonce") ||
		!hasColumn(db, "finance_byok_backup", "key_version") ||
		!hasColumn(db, "finance_byok_backup", "updated_at") {
		t.Fatal("001 deveria criar finance_byok_backup com todas as colunas esperadas")
	}
	if !hasTable(db, "finance_connections") ||
		!hasTable(db, "finance_accounts") ||
		!hasTable(db, "finance_transactions") ||
		!hasTable(db, "finance_budgets_and_goals") {
		t.Fatal("001 deveria criar tabelas de conexões, contas, transações e orçamentos financeiros")
	}
	if !hasTable(db, "finance_credit_bills") ||
		!hasTable(db, "finance_installment_plans") ||
		!hasTable(db, "finance_merchants") ||
		!hasTable(db, "finance_category_rules") {
		t.Fatal("001 deveria criar faturas, planos de parcelamento, comerciantes e regras de categoria")
	}
	if !hasColumn(db, "finance_transactions", "installment_number") ||
		!hasColumn(db, "finance_transactions", "total_installments") ||
		!hasColumn(db, "finance_transactions", "bill_id") ||
		!hasColumn(db, "finance_transactions", "merchant_id") ||
		!hasColumn(db, "finance_accounts", "closing_day") ||
		!hasColumn(db, "finance_accounts", "due_day") {
		t.Fatal("001 deveria incluir colunas de parcelas, fatura, comerciante e ciclo do cartão")
	}
	if !hasColumn(db, "user_ai_settings", "persona_style") ||
		!hasColumn(db, "user_ai_settings", "preferred_voice") {
		t.Fatal("001 deveria incluir persona_style e preferred_voice em user_ai_settings")
	}
	if !hasTable(db, "conversation_threads") ||
		!hasTable(db, "conversation_turns") ||
		!hasTable(db, "pending_confirmations") ||
		!hasTable(db, "memory_episodes") ||
		!hasTable(db, "memory_thematic_summaries") ||
		!hasTable(db, "ai_traces") {
		t.Fatal("001 deveria criar tabelas de conversation store, pending_confirmations, memória hierárquica e ai_traces")
	}
	if !hasColumn(db, "triggers", "search_config_json") ||
		!hasColumn(db, "triggers", "seen_fingerprints_json") ||
		!hasColumn(db, "triggers", "last_metric_value") ||
		!hasColumn(db, "triggers", "last_notified_at") ||
		!hasColumn(db, "triggers", "user_intent") ||
		!hasColumn(db, "triggers", "search_keywords") {
		t.Fatal("001 deveria incluir colunas de busca, notificação e intenção em triggers")
	}
	if !hasTable(db, "synced_contacts") ||
		!hasTable(db, "whatsapp_contact_aliases") ||
		!hasTable(db, "whatsapp_pending_state") ||
		!hasTable(db, "whatsapp_conversation_messages") ||
		!hasTable(db, "whatsapp_context_settings") ||
		!hasTable(db, "whatsapp_auth_otps") ||
		!hasTable(db, "gmail_integrations") ||
		!hasTable(db, "whatsapp_integrations") {
		t.Fatal("001 deveria criar tabelas de WhatsApp, Gmail e contatos sincronizados")
	}
	if !hasColumn(db, "whatsapp_conversation_messages", "media_kind") ||
		!hasColumn(db, "whatsapp_conversation_messages", "media_payload") ||
		!hasColumn(db, "whatsapp_conversation_messages", "quoted_id") {
		t.Fatal("001 deveria incluir colunas de mídia e quoted_id em whatsapp_conversation_messages")
	}
	if !hasTable(db, "refresh_tokens") ||
		!hasTable(db, "meetings") ||
		!hasTable(db, "meeting_slots") ||
		!hasColumn(db, "users", "phone") ||
		!hasTable(db, "p2p_meeting_invites") ||
		!hasColumn(db, "booking_types", "valid_from") ||
		!hasColumn(db, "booking_types", "valid_until") ||
		!hasColumn(db, "booking_types", "allowed_dates") ||
		!hasColumn(db, "todos", "category") ||
		!hasColumn(db, "todos", "remind_at") ||
		!hasColumn(db, "events", "recurrence") ||
		!hasColumn(db, "triggers", "days_of_week") ||
		!hasTable(db, "user_core_profile") {
		t.Fatal("001 deveria incluir todas as tabelas e colunas consolidadas de agenda, reuniões, todos e perfil")
	}
}

func TestVersionedMigrations_IdempotentReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reopen.db")
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('u1', 'Test', 't@test.com', 'h', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	db.Close()

	db2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db2.Close()

	var count int
	if err := db2.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if want := len(orderedMigrations()); count != want {
		t.Fatalf("esperava %d migração(ões) registrada(s) ao reabrir, veio %d", want, count)
	}
}

func TestVersionedMigrations_UserAIProvidersConstraintsAndCascade(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "ai_providers.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := db.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('u-ai', 'AI User', 'ai@test.com', 'h', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO user_ai_providers (id, user_id, provider_key, base_url, key_ciphertext, key_last4, status, created_at, updated_at) VALUES ('p-1', 'u-ai', 'anthropic', '', 'cipher', '1234', 'ok', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
	if err != nil {
		t.Fatal(err)
	}

	// Reexecutar runVersionedMigrations deve ser idempotente e preservar os dados.
	if err := runVersionedMigrations(db); err != nil {
		t.Fatalf("reexecução idempotente falhou: %v", err)
	}
	var last4 string
	if err := db.QueryRow(`SELECT key_last4 FROM user_ai_providers WHERE id = 'p-1'`).Scan(&last4); err != nil {
		t.Fatalf("registro existente deveria ser preservado: %v", err)
	}
	if last4 != "1234" {
		t.Fatalf("esperava key_last4='1234', veio %q", last4)
	}

	// CHECK constraint para provider_key e status inválidos.
	if _, err := db.Exec(`INSERT INTO user_ai_providers (id, user_id, provider_key, key_ciphertext, key_last4, status, created_at, updated_at) VALUES ('p-bad', 'u-ai', 'unknown', 'c', '0000', 'ok', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`); err == nil {
		t.Fatal("esperava falha na CHECK constraint para provider_key inválido")
	}
	if _, err := db.Exec(`INSERT INTO user_ai_providers (id, user_id, provider_key, key_ciphertext, key_last4, status, created_at, updated_at) VALUES ('p-bad-s', 'u-ai', 'openai', 'c', '0000', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`); err == nil {
		t.Fatal("esperava falha na CHECK constraint para status inválido")
	}

	// ON DELETE CASCADE ao excluir usuário.
	if _, err := db.Exec(`DELETE FROM users WHERE id = 'u-ai'`); err != nil {
		t.Fatal(err)
	}
	var remaining int
	if err := db.QueryRow(`SELECT COUNT(*) FROM user_ai_providers WHERE user_id = 'u-ai'`).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatalf("esperava remoção em cascata em user_ai_providers, restaram %d", remaining)
	}
}

func TestVersionedMigrations_ByokBackupCascade(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "byok_backup.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := db.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('u-byok', 'BYOK', 'byok@test.com', 'h', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO finance_byok_backup (user_id, ciphertext, nonce, key_version, updated_at) VALUES ('u-byok', X'010203', X'040506', 2, CURRENT_TIMESTAMP)`)
	if err != nil {
		t.Fatal(err)
	}

	if err := runVersionedMigrations(db); err != nil {
		t.Fatalf("reexecução idempotente falhou: %v", err)
	}
	var keyVersion int
	if err := db.QueryRow(`SELECT key_version FROM finance_byok_backup WHERE user_id = 'u-byok'`).Scan(&keyVersion); err != nil {
		t.Fatalf("registro existente deveria ser preservado: %v", err)
	}
	if keyVersion != 2 {
		t.Fatalf("esperava key_version=2, veio %d", keyVersion)
	}

	if _, err := db.Exec(`DELETE FROM users WHERE id = 'u-byok'`); err != nil {
		t.Fatal(err)
	}
	var remaining int
	if err := db.QueryRow(`SELECT COUNT(*) FROM finance_byok_backup WHERE user_id = 'u-byok'`).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatalf("esperava remoção em cascata do backup BYOK, restaram %d", remaining)
	}
}
