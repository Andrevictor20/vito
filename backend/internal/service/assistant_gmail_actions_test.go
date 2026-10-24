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

type fixedIntentGateway struct {
	intent *ai.ParsedIntent
}

func (g *fixedIntentGateway) ParseIntent(_ context.Context, _ ai.UserInput) (*ai.ParsedIntent, error) {
	return g.intent, nil
}

func TestAssistantGmailActions_DraftAndSendEmail(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	userID := "user-gmail-act-1"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{ID: userID, Name: "André", Email: "andre@test.com", PasswordHash: "x"})

	var draftCalled, sendCalled bool
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/gmail/v1/users/me/drafts":
			draftCalled = true
			_ = json.NewEncoder(w).Encode(map[string]string{"id": "draft-abc"})
		case "/gmail/v1/users/me/messages/send":
			sendCalled = true
			_ = json.NewEncoder(w).Encode(map[string]string{"id": "msg-xyz"})
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
		ID:                   "g-act-1",
		UserID:               userID,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: encCreds,
		Status:               domain.GmailStatusActive,
	})

	// 1. DRAFT_EMAIL
	gw := &fixedIntentGateway{
		intent: &ai.ParsedIntent{
			Action:  ai.ActionDraftEmail,
			Message: "",
			EmailMessage: &ai.ParsedEmailMessage{
				To:      "cliente@empresa.com",
				Subject: "Orçamento do Projeto",
				Body:    "Olá, segue o orçamento conforme conversamos.",
			},
		},
	}
	astSvc := service.NewAssistantService(gw, nil, nil, nil)
	astSvc.SetGmailService(gmailSvc)

	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{
		Text:     "escreva um rascunho de email para cliente@empresa.com sobre o orçamento",
		Timezone: "America/Sao_Paulo",
	})
	if err != nil {
		t.Fatalf("draft process err: %v", err)
	}
	if !draftCalled {
		t.Error("esperava chamada ao endpoint /gmail/v1/users/me/drafts")
	}
	if !strings.Contains(resp.Message, "cliente@empresa.com") {
		t.Errorf("esperava confirmação do rascunho na mensagem, obteve: %s", resp.Message)
	}

	// 2. SEND_EMAIL
	gw.intent = &ai.ParsedIntent{
		Action:  ai.ActionSendEmail,
		Message: "",
		EmailMessage: &ai.ParsedEmailMessage{
			To:      "parceiro@empresa.com",
			Subject: "Confirmação de Reunião",
			Body:    "Confirmado para amanhã às 14h.",
		},
	}
	respSend, err := astSvc.Process(context.Background(), userID, ai.UserInput{
		Text:     "envie um email para parceiro@empresa.com confirmando a reunião",
		Timezone: "America/Sao_Paulo",
	})
	if err != nil {
		t.Fatalf("send process err: %v", err)
	}
	if !sendCalled {
		t.Error("esperava chamada ao endpoint /gmail/v1/users/me/messages/send")
	}
	if !strings.Contains(respSend.Message, "parceiro@empresa.com") {
		t.Errorf("esperava confirmação de envio na mensagem, obteve: %s", respSend.Message)
	}

	// 3. Sem destinatário -> NEEDS_CLARIFICATION
	gw.intent = &ai.ParsedIntent{
		Action: ai.ActionSendEmail,
		EmailMessage: &ai.ParsedEmailMessage{
			To:   "",
			Body: "Texto sem destinatário",
		},
	}
	respClarify, err := astSvc.Process(context.Background(), userID, ai.UserInput{
		Text: "envie um email dizendo oi",
	})
	if err != nil {
		t.Fatalf("clarify process err: %v", err)
	}
	if respClarify.Action != ai.ActionNeedsClarification {
		t.Errorf("esperava NEEDS_CLARIFICATION para destinatário vazio, obteve %s", respClarify.Action)
	}

	// 4. Conta Gmail desconectada
	_ = gmailRepo.DeleteByUserID(context.Background(), userID)
	gw.intent = &ai.ParsedIntent{
		Action: ai.ActionSendEmail,
		EmailMessage: &ai.ParsedEmailMessage{
			To:      "alguem@empresa.com",
			Subject: "Oi",
			Body:    "Teste",
		},
	}
	respDisconn, err := astSvc.Process(context.Background(), userID, ai.UserInput{
		Text: "envie um email para alguem@empresa.com",
	})
	if err != nil {
		t.Fatalf("disconnected process err: %v", err)
	}
	if !strings.Contains(respDisconn.Message, "não está conectada") {
		t.Errorf("esperava orientação de conectar o Gmail na aba Perfil, obteve: %s", respDisconn.Message)
	}
}
