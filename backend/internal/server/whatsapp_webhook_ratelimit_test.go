package server_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
)

type noopEvolutionClient struct{}

func (noopEvolutionClient) CreateInstance(context.Context, string, string) error { return nil }
func (noopEvolutionClient) SetWebhook(context.Context, string, string) error     { return nil }
func (noopEvolutionClient) SetSettings(context.Context, string, map[string]interface{}) error {
	return nil
}
func (noopEvolutionClient) GetPairingCode(context.Context, string, string) (string, error) {
	return "", nil
}
func (noopEvolutionClient) GetConnectionState(context.Context, string) (string, error) {
	return "open", nil
}
func (noopEvolutionClient) DeleteInstance(context.Context, string) error              { return nil }
func (noopEvolutionClient) Logout(context.Context, string) error                      { return nil }
func (noopEvolutionClient) SendText(context.Context, string, string, string) error    { return nil }
func (noopEvolutionClient) SendTextWithQuoted(context.Context, string, string, string, string) error {
	return nil
}
func (noopEvolutionClient) GetMediaBase64(context.Context, string, interface{}) (string, error) {
	return "", nil
}
func (noopEvolutionClient) FindContacts(context.Context, string) ([]service.WhatsAppContact, error) {
	return nil, nil
}
func (noopEvolutionClient) SendReaction(context.Context, string, string, string, string, bool) error {
	return nil
}
func (noopEvolutionClient) FindMessages(context.Context, service.EvolutionFindMessagesInput) ([]service.WhatsAppChatMessage, error) {
	return nil, nil
}
func (noopEvolutionClient) FindGroups(context.Context, string) ([]service.WhatsAppGroup, error) {
	return nil, nil
}
func (noopEvolutionClient) FindParticipants(context.Context, string, string) ([]string, error) {
	return nil, nil
}
func (noopEvolutionClient) FindOwnerJID(context.Context, string) (string, error) { return "", nil }

type noopGateway struct{}

func (noopGateway) ParseIntent(context.Context, ai.UserInput) (*ai.ParsedIntent, error) {
	return &ai.ParsedIntent{Action: ai.ActionGeneralChat, Message: "ok"}, nil
}

// TestWhatsAppWebhook_NotThrottledByGlobalAPIRateLimiter garante que rajadas de
// webhooks vindas do container Evolution API após reconexão não recebem HTTP 429,
// enquanto demais rotas /api/v1 continuam protegidas pelo apiLimiter (120/min).
func TestWhatsAppWebhook_NotThrottledByGlobalAPIRateLimiter(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "test_wh_ratelimit.db"))
	if err != nil {
		t.Fatalf("erro ao abrir banco: %v", err)
	}
	defer db.Close()

	waRepo := repository.NewWhatsAppRepository(db)
	astSvc := service.NewAssistantService(noopGateway{}, nil, nil, nil)
	waSvc := service.NewWhatsAppService(service.WhatsAppServiceConfig{}, waRepo, noopEvolutionClient{}, astSvc)
	waHandler := handler.NewWhatsAppHandler(waSvc)

	triggerRepo := repository.NewTriggerRepository(db)
	triggerHandler := handler.NewTriggerHandler(service.NewTriggerService(triggerRepo))

	srv := server.New(server.Config{
		WhatsAppHandler: waHandler,
		TriggerHandler:  triggerHandler,
	})
	router := srv.Router()

	body := []byte(`{"event":"connection.update","instance":"inst-1","data":{"state":"open"}}`)
	for i := 0; i < 200; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/whatsapp/webhook", bytes.NewReader(body))
		req.RemoteAddr = "172.18.0.5:43210"
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code == http.StatusTooManyRequests {
			t.Fatalf("webhook recebeu 429 Too Many Requests na requisição %d; rajada pós-queda seria represada!", i+1)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("esperava 200 OK no webhook, obteve %d", rec.Code)
		}
	}

	// Rotas normais em /api/v1 continuam limitadas a 120 req/min por IP.
	throttled := false
	for i := 0; i < 130; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/triggers/templates", nil)
		req.RemoteAddr = "198.51.100.10:12345"
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code == http.StatusTooManyRequests {
			throttled = true
			break
		}
	}
	if !throttled {
		t.Error("esperava HTTP 429 em rota normal /api/v1 após exceder 120 req/min")
	}

	_ = domain.WhatsAppStatusConnected
	_ = time.Second
}
