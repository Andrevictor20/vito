package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/crypto"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type captureGateway struct {
	lastInput ai.UserInput
}

func (g *captureGateway) ParseIntent(_ context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	g.lastInput = input
	return &ai.ParsedIntent{
		Action:  ai.ActionGeneralChat,
		Message: "Aqui estão seus e-mails recentes.",
	}, nil
}

func TestAssistantContext_EnrichesGmailEmailsWhenQueryRelated(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	userID := "user-gmail-enrich-1"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{ID: userID, Name: "André", Email: "andre@test.com", PasswordHash: "x"})

	// Mock do servidor da Gmail API
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/gmail/v1/users/me/messages":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"messages": []map[string]string{
					{"id": "msg-1"},
				},
			})
		case "/gmail/v1/users/me/messages/msg-1":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":      "msg-1",
				"snippet": "Sua fatura de R$ 350,00 vence em 25/10/2026. Código: 34191.12345 67890.123456",
				"payload": map[string]interface{}{
					"headers": []map[string]string{
						{"name": "Subject", "value": "Fatura do Cartão Nubank"},
						{"name": "From", "value": "Nubank <fatura@nubank.com.br>"},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()

	encKey := "test-enc-key-32-chars-long-12345"
	gmailRepo := repository.NewGmailRepository(db)
	gmailSvc := service.NewGmailService(gmailRepo, encKey, "cid", "csec")
	gmailSvc.SetBaseURL(mockServer.URL)

	credsJSON, _ := json.Marshal(map[string]interface{}{"access_token": "valid-token"})
	encCreds, _ := crypto.Encrypt(string(credsJSON), encKey)
	_ = gmailRepo.Upsert(context.Background(), &domain.GmailIntegration{
		ID:                   "g-1",
		UserID:               userID,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: encCreds,
		Status:               domain.GmailStatusActive,
	})

	gw := &captureGateway{}
	astSvc := service.NewAssistantService(gw, nil, nil, nil)
	astSvc.SetGmailService(gmailSvc)

	// Pergunta do usuário mencionando "emails"
	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{
		Text:     "Ola, quais meus últimos emails que recebi?",
		Timezone: "America/Sao_Paulo",
	})
	if err != nil {
		t.Fatalf("process: %v", err)
	}
	if resp == nil {
		t.Fatal("esperava resposta não nula")
	}

	// Verifica se o UserInput enviado para o Gateway de IA foi enriquecido com RecentEmails
	if len(gw.lastInput.RecentEmails) == 0 {
		t.Fatalf("esperava RecentEmails preenchido no UserInput, obteve vazio")
	}

	foundInvoice := false
	for _, l := range gw.lastInput.RecentEmails {
		if strings.Contains(l, "Fatura do Cartão Nubank") && strings.Contains(l, "350.00") {
			foundInvoice = true
			break
		}
	}
	if !foundInvoice {
		t.Errorf("esperava fatura do Nubank em RecentEmails: %+v", gw.lastInput.RecentEmails)
	}

	// Verifica se o flag de integração Gmail ativa foi injetado em AppStateFlags
	hasGmailFlag := false
	for _, f := range gw.lastInput.AppStateFlags {
		if strings.Contains(f, "INTEGRAÇÃO GMAIL ATIVA") {
			hasGmailFlag = true
			break
		}
	}
	if !hasGmailFlag {
		t.Errorf("esperava flag de integração Gmail ativa em AppStateFlags: %+v", gw.lastInput.AppStateFlags)
	}
}
