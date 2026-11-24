package service_test

import (
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/finance"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

func TestSQLiteFinanceSnapshotProvider_CompactContextAndEnricher(t *testing.T) {
	ctx := context.Background()
	db, err := database.Open(filepath.Join(t.TempDir(), "fin_snapshot.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID: "u-fin-1", Name: "Fin User", Email: "fin@vito.test", CreatedAt: now, UpdatedAt: now,
	})

	finRepo := finance.NewFinanceRepository(db)
	provider := finance.NewSQLiteFinanceSnapshotProvider(finRepo)
	if empty := provider.GetCompactFinanceContext(ctx, "u-fin-1"); empty != "" {
		t.Fatalf("usuário sem contas deveria retornar vazio, obteve %q", empty)
	}

	_ = finRepo.UpsertConnection(ctx, &domain.FinanceConnection{
		ID: "conn-1", UserID: "u-fin-1", PluggyItemID: "item-1", ConnectorID: 200,
		InstitutionName: "Nubank", Status: domain.ConnectionStatusUpdated,
	})
	_ = finRepo.UpsertAccountsBatch(ctx, "u-fin-1", []domain.FinanceAccount{
		{ID: "acc-chk", UserID: "u-fin-1", ConnectionID: "conn-1", PluggyAccountID: "pa-1", AccountType: domain.AccountTypeBank, Name: "Conta Nubank", InstitutionName: "Nubank", Balance: 3500.50},
		{ID: "acc-cc", UserID: "u-fin-1", ConnectionID: "conn-1", PluggyAccountID: "pa-2", AccountType: domain.AccountTypeCredit, Name: "Cartão Roxinho", InstitutionName: "Nubank", Balance: 820.00},
	})
	_ = finRepo.UpsertTransactionsBatch(ctx, "u-fin-1", []domain.FinanceTransaction{
		{ID: "tx-1", UserID: "u-fin-1", AccountID: "acc-chk", PluggyTransactionID: "ptx-1", Description: "Mercado", Amount: -150.00, TransactionType: domain.TxDebit, OccurredAt: now},
	})

	enricher := service.NewAssistantContextEnricher(userRepo, nil, nil, nil, nil, nil, nil)
	enricher.SetFinanceSnapshotProvider(provider)
	enricher.SetLevel1Timeout(3 * time.Second)

	lvl1 := enricher.BuildLevel1Context(ctx, "u-fin-1", "Qual meu saldo e fatura atual?", now)
	for _, want := range []string{"Snapshot Financeiro (Safe-to-Spend)", "Saldo consolidado: R$ 3500.50", "Faturas abertas: R$ 820.00", "Conta Nubank: R$ 3500.50"} {
		if !strings.Contains(lvl1, want) {
			t.Errorf("BuildLevel1Context não conteve %q em:\n%s", want, lvl1)
		}
	}
}

type fakeGmailContract struct{ sentTo string }

func (f *fakeGmailContract) SendEmail(ctx context.Context, userID, to, subject, body string) error {
	f.sentTo = to
	return nil
}
func (f *fakeGmailContract) CreateDraft(ctx context.Context, userID, to, subject, body string) error {
	return nil
}
func (f *fakeGmailContract) ScanEmails(ctx context.Context, userID string) (*domain.GmailScanResult, error) {
	return &domain.GmailScanResult{}, nil
}

type fakeWAContract struct{ sentTo string }

func (f *fakeWAContract) SendMessage(ctx context.Context, userID, phone, message string) error {
	f.sentTo = phone
	return nil
}
func (f *fakeWAContract) SearchMessages(ctx context.Context, userID, query string, limit int) ([]domain.WhatsAppConversationMessage, error) {
	return nil, nil
}
func (f *fakeWAContract) RecentChats(ctx context.Context, userID string) ([]ai.ChatContactSummary, error) {
	return nil, nil
}

func TestEntityLinkRepository_ProductionFlows(t *testing.T) {
	ctx := context.Background()
	db, err := database.Open(filepath.Join(t.TempDir(), "entity_links_prod.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	userRepo := repository.NewUserRepository(db)
	userID := "u-el-1"
	_ = userRepo.Create(&domain.User{ID: userID, Name: "Entity User", Email: "el@vito.test", CreatedAt: now, UpdatedAt: now})

	entityRepo := repository.NewEntityLinkRepository(db)

	todoSvc := tasks.NewTodoService(tasks.NewTodoRepository(db))
	todoSvc.SetEntityLinkRepository(entityRepo)
	createdTodo, err := todoSvc.CreateTodoWithOptions(userID, domain.CreateTodoInput{
		Title: "Enviar ata", EventID: "evt-123", EventTitle: "Alinhamento Q4",
	})
	if err != nil {
		t.Fatalf("CreateTodoWithOptions: %v", err)
	}
	if links, err := entityRepo.Resolve(ctx, userID, "Alinhamento"); err != nil || len(links) == 0 || links[0].ExternalIDs["todo_id"] != createdTodo.ID {
		t.Fatalf("link event<->todo não criado: %+v err=%v", links, err)
	}

	pendSvc := tasks.NewPendingService(tasks.NewPendingRepository(db))
	pendSvc.SetEntityLinkRepository(entityRepo)
	if _, err := pendSvc.CreatePending(userID, domain.CreatePendingInput{
		Title: "Renovar CNH", ScheduledDate: "2026-12-01",
	}); err != nil {
		t.Fatalf("CreatePending: %v", err)
	}
	if links, err := entityRepo.Resolve(ctx, userID, "Renovar"); err != nil || len(links) == 0 || links[0].ExternalIDs["scheduled_date"] != "2026-12-01" {
		t.Fatalf("link pending não criado: %+v err=%v", links, err)
	}

	calSvc := calendar.NewCalendarService(calendar.NewEventRepository(db))
	calSvc.SetEntityLinkRepository(entityRepo)
	if _, _, err := calSvc.CreateEvent(userID, "Café com marina@empresa.com", "", "", now.Add(time.Hour), now.Add(2*time.Hour)); err != nil {
		t.Fatalf("CreateEvent: %v", err)
	}
	if links, err := entityRepo.Resolve(ctx, userID, "marina@empresa.com"); err != nil || len(links) == 0 {
		t.Fatalf("link event<->email não criado: %+v err=%v", links, err)
	}

	// WhatsApp archive + toolsets + enricher
	_ = entityRepo.Upsert(ctx, &repository.EntityLink{
		UserID: userID, CanonicalName: "Marina Costa", EntityType: "person",
		WhatsAppJID: "5511999887766@s.whatsapp.net", Phone: "5511999887766", Email: "marina.costa@empresa.com",
	})

	gmailTS := toolsets.NewGmailToolset(&fakeGmailContract{})
	gmailTS.SetEntityLinkResolver(entityRepo)
	resEmail, err := gmailTS.Execute(ctx, &domain.ToolExecutionContext{UserID: userID}, "send_email", json.RawMessage(`{"to":"Marina Costa","subject":"Oi","body":"Tudo bem?"}`))
	if err != nil || resEmail.Status != "COMPLETED" || !strings.Contains(resEmail.SummaryForLLM, "marina.costa@empresa.com") {
		t.Fatalf("GmailToolset deveria resolver 'Marina Costa' via entity_links, obteve: %+v err=%v", resEmail, err)
	}

	fakeWA := &fakeWAContract{}
	waTS := whatsapp.NewWhatsAppToolset(fakeWA)
	waTS.SetEntityLinkResolver(entityRepo)
	if _, err := waTS.Execute(ctx, &domain.ToolExecutionContext{UserID: userID}, "send_message", json.RawMessage(`{"recipient":"Marina Costa","message":"Oi"}`)); err != nil {
		t.Fatalf("WhatsAppToolset.Execute: %v", err)
	}
	if fakeWA.sentTo != "5511999887766" {
		t.Errorf("WhatsAppToolset deveria resolver 'Marina Costa' para '5511999887766', obteve %q", fakeWA.sentTo)
	}

	enricher := service.NewAssistantContextEnricher(userRepo, nil, nil, nil, nil, nil, nil)
	enricher.SetEntityLinkRepository(entityRepo)
	enricher.SetLevel1Timeout(3 * time.Second)
	lvl1 := enricher.BuildLevel1Context(ctx, userID, "Mande mensagem para Marina", now)
	if !strings.Contains(lvl1, "Entidades Vinculadas (Cross-Canal)") || !strings.Contains(lvl1, "marina.costa@empresa.com") {
		t.Errorf("Enricher deveria expor entity_links relevantes no Nível 1, obteve:\n%s", lvl1)
	}
}
