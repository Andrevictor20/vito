package service_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

type spyADKEngine struct {
	called   int
	lastReq  domain.UnifiedAssistantRequest
	response *domain.UnifiedAssistantResponse
}

func (s *spyADKEngine) Run(ctx context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	s.called++
	s.lastReq = req
	return s.response, nil
}

func (s *spyADKEngine) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, onDelta func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	return s.Run(ctx, req)
}

// TestWhatsAppService_ADKPrimaryPath_SkipsLegacyV1 garante que quando SetAgentLoop está conectado
// (como em agent_wiring.go com ADKLoopFacade), o canal WhatsApp usa exclusivamente o motor ADK
// e não cai no AssistantService v1 legado.
func TestWhatsAppService_ADKPrimaryPath_SkipsLegacyV1(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)
	ctx := context.Background()

	adkSpy := &spyADKEngine{
		response: &domain.UnifiedAssistantResponse{
			Reply: "Respondido pelo motor ADK primário.",
			Text:  "Respondido pelo motor ADK primário.",
			Telemetry: domain.TurnTelemetry{
				ProviderUsed: "Google AI Studio",
			},
		},
	}
	svc.SetAgentLoop(adkSpy)
	svc.SetAsyncRunner(func(fn func()) { fn() })

	payload, _ := json.Marshal(map[string]any{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]any{
			"key": map[string]any{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    true,
				"id":        "msg-adk-primary-1",
			},
			"messageType": "conversation",
			"message":     map[string]any{"conversation": "@vito qual minha agenda de hoje?"},
		},
	})

	if err := svc.HandleWebhook(ctx, "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook falhou: %v", err)
	}
	if adkSpy.called != 1 {
		t.Fatalf("esperava 1 chamada ao motor ADK primário, obteve %d", adkSpy.called)
	}
	if adkSpy.lastReq.Channel != "whatsapp" {
		t.Errorf("esperava channel='whatsapp', obteve %q", adkSpy.lastReq.Channel)
	}
	if len(mockClient.sentMessages) == 0 || !strings.Contains(mockClient.sentMessages[0].Text, "Respondido pelo motor ADK primário.") {
		t.Errorf("resposta ADK não foi enviada pelo cliente WhatsApp: %+v", mockClient.sentMessages)
	}
}
