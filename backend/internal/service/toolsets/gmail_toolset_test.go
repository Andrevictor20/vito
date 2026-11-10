package toolsets_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type mockGmailService struct {
	mockScan *domain.GmailScanResult
}

func (m *mockGmailService) SendEmail(ctx context.Context, userID, to, subject, body string) error {
	return nil
}

func (m *mockGmailService) CreateDraft(ctx context.Context, userID, to, subject, body string) error {
	return nil
}

func (m *mockGmailService) ScanEmails(ctx context.Context, userID string) (*domain.GmailScanResult, error) {
	return m.mockScan, nil
}

func TestGmailToolset_SearchEmails_ReturnsScannedItems(t *testing.T) {
	dueDate := time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC)
	scan := &domain.GmailScanResult{
		Bills: []domain.ScannedBill{
			{
				Subject:     "Fatura Nubank",
				AmountBRL:   1250.50,
				DueDate:     &dueDate,
				Beneficiary: "Nubank Pagamentos",
			},
		},
		UrgentEmails: []domain.UrgentEmail{
			{
				Subject: "Urgente: Alinhamento de Contrato",
				Snippet: "Precisamos fechar a minuta hoje",
				From:    "diretoria@empresa.com",
			},
		},
	}
	svc := &mockGmailService{mockScan: scan}
	ts := toolsets.NewGmailToolset(svc)

	execCtx := &domain.ToolExecutionContext{
		UserID: "user-gmail-test",
	}

	params, _ := json.Marshal(map[string]any{"query": "faturas"})
	res, err := ts.Execute(context.Background(), execCtx, "search_emails", params)
	if err != nil {
		t.Fatalf("falha ao executar busca no gmail: %v", err)
	}

	if !strings.Contains(res.SummaryForLLM, "Fatura Nubank") || !strings.Contains(res.SummaryForLLM, "1250.50") {
		t.Errorf("SummaryForLLM deve conter a fatura escaneada: %s", res.SummaryForLLM)
	}
	if !strings.Contains(res.SummaryForLLM, "Alinhamento de Contrato") {
		t.Errorf("SummaryForLLM deve conter e-mail urgente: %s", res.SummaryForLLM)
	}
	if !res.MarksContextAsTainted {
		t.Errorf("E-mails externos devem marcar contexto como tainted")
	}
}
