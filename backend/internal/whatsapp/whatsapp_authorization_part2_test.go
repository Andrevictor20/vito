package whatsapp_test

import (
	"context"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"testing"
	"time"
)

func TestWhatsAppService_SelfGroupColdCacheBuscaParticipantesSincrono(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)
	mockClient.mockParticipants = []string{"5511999998888@s.whatsapp.net"}

	groupMeta := whatsapp.NewWhatsAppGroupMeta(mockClient, time.Hour, 24*time.Hour)
	svc.SetGroupMeta(groupMeta)

	gateway := &mockGatewayCapturador{}
	svc.SetAgentLoop(gateway)
	svc.SetAsyncRunner(func(fn func()) { fn() })

	// Mensagem em grupo individual COM @vito (mesmo com cache frio) deve
	// buscar participantes sincronamente e responder como self_group.
	if err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito("12036399999999@g.us", "msg-cold-self-grp", "@vito qual minha agenda de amanhã?", true)); err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 resposta no grupo individual com @vito mesmo com cache frio, obteve %d", len(mockClient.sentMessages))
	}
}

func TestWhatsAppService_OwnerLIDSelfChatRecognition(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)
	ownerCache := whatsapp.NewWhatsAppOwnerCache(mockClient, time.Hour)
	svc.SetOwnerCache(ownerCache)

	gateway := &mockGatewayCapturador{}
	svc.SetAgentLoop(gateway)
	svc.SetAsyncRunner(func(fn func()) { fn() })

	// 1) Mensagem com @vito e participant=@lid aprende o LID do dono e responde
	learnPayload := []byte(`{
		"event": "messages.upsert",
		"instance": "vito_conv_user",
		"data": {
			"key": {
				"remoteJid": "182708445675538@lid",
				"fromMe": true,
				"id": "msg-lid-1",
				"participant": "182708445675538@lid"
			},
			"messageType": "conversation",
			"message": {"conversation": "@vito qual minha agenda de hoje?"}
		}
	}`)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", learnPayload); err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 resposta no chat @lid do próprio dono com @vito, obteve %d", len(mockClient.sentMessages))
	}

	// 2) ResolveURL interna do Docker quando evolution-api está no mesmo compose
	if got := whatsapp.ResolveWhatsAppWebhookBaseURL("https://vito.rasppi.cloud", "http://evolution-api:8080", "8180"); got != "http://backend:8180" {
		t.Errorf("esperava http://backend:8180, obteve %q", got)
	}
}

var _ = time.Now
