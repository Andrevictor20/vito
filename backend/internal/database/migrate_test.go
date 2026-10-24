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
	if count != 21 {
		t.Fatalf("esperava 21 migrações registradas, vieram %d", count)
	}
	if !hasColumn(db, "triggers", "search_config_json") ||
		!hasColumn(db, "triggers", "seen_fingerprints_json") ||
		!hasColumn(db, "triggers", "last_metric_value") {
		t.Fatal("021 deveria adicionar search_config_json, seen_fingerprints_json e last_metric_value em triggers")
	}
	if !hasTable(db, "synced_contacts") {
		t.Fatal("020 deveria criar synced_contacts")
	}
	if !hasTable(db, "whatsapp_contact_aliases") {
		t.Fatal("019 deveria criar whatsapp_contact_aliases")
	}
	if !hasColumn(db, "whatsapp_conversation_messages", "media_kind") ||
		!hasColumn(db, "whatsapp_conversation_messages", "media_payload") ||
		!hasColumn(db, "whatsapp_conversation_messages", "quoted_id") {
		t.Fatal("017 deveria adicionar as colunas de mídia e quoted_id")
	}
	if !hasTable(db, "whatsapp_pending_state") {
		t.Fatal("016 deveria criar whatsapp_pending_state")
	}
	if !hasTable(db, "whatsapp_conversation_messages") || !hasTable(db, "whatsapp_context_settings") {
		t.Fatal("015 deveria criar whatsapp_conversation_messages e whatsapp_context_settings")
	}
	if !hasTable(db, "whatsapp_auth_otps") {
		t.Fatal("014 deveria criar tabela whatsapp_auth_otps")
	}
	if !hasTable(db, "gmail_integrations") {
		t.Fatal("013 deveria criar tabela gmail_integrations")
	}
	if !hasTable(db, "whatsapp_integrations") {
		t.Fatal("012 deveria criar tabela whatsapp_integrations")
	}
	if !hasTable(db, "refresh_tokens") {
		t.Fatal("011 deveria criar tabela refresh_tokens")
	}
	if !hasTable(db, "meetings") || !hasTable(db, "meeting_slots") {
		t.Fatal("009 deveria criar meetings e meeting_slots")
	}
	if !hasColumn(db, "users", "phone") || !hasTable(db, "p2p_meeting_invites") {
		t.Fatal("010 deveria criar coluna phone em users e tabela p2p_meeting_invites")
	}
	if !hasColumn(db, "booking_types", "valid_from") || !hasColumn(db, "booking_types", "valid_until") || !hasColumn(db, "booking_types", "allowed_dates") {
		t.Fatal("008 deveria criar valid_from, valid_until e allowed_dates em booking_types")
	}
	if !hasColumn(db, "todos", "category") || !hasColumn(db, "todos", "remind_at") {
		t.Fatal("001 deveria criar todos com category e remind_at")
	}
	if !hasColumn(db, "events", "recurrence") || !hasColumn(db, "triggers", "days_of_week") {
		t.Fatal("001 deveria incluir colunas dobradas dos ALTERs legados")
	}
	if !hasColumn(db, "triggers", "user_intent") || !hasColumn(db, "triggers", "search_keywords") {
		t.Fatal("006 deveria criar user_intent e search_keywords em triggers")
	}
	if !hasTable(db, "user_core_profile") {
		t.Fatal("005 deveria criar user_core_profile")
	}
}

func TestVersionedMigrations_LegacyDB(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	// Simula base pré-versionada: apaga o rastreio e remove a coluna category.
	if _, err := db.Exec(`DELETE FROM schema_migrations`); err != nil {
		t.Fatal(err)
	}
	db.Close()

	// Reabre "legada": sem rastreio, mas com tabelas (sem category).
	db2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db2.Close()
	// Como a base já tinha category (001 aplicada antes do DELETE), o carimbo ocorre.
	var count int
	if err := db2.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 21 {
		t.Fatalf("base legada deveria ser carimbada com 21, veio %d", count)
	}
}

func TestVersionedMigrations_LastNotifiedColumn(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "notified.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if !hasColumn(db, "triggers", "last_notified_at") {
		t.Fatal("007 deveria criar last_notified_at em triggers")
	}
}
