package service_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestWhatsAppService_Webhook_PrivateMessageAndAntiLoop(t *testing.T) {
	svc, waRepo, mockClient := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-1",
		UserID:       "user-100",
		InstanceName: "vito_user_100",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnected,
	})

	// 1a. Mensagem privada do usuário SEM marcação explícita -> Silenciosamente arquivada, NÃO respondida
	payloadPrivateWithoutTrigger := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511988887777@s.whatsapp.net",
				"fromMe":    false,
			},
			"message": map[string]interface{}{
				"conversation": "Quais são meus compromissos de hoje?",
			},
		},
	}
	bytesPrivateWithoutTrigger, _ := json.Marshal(payloadPrivateWithoutTrigger)

	err := svc.HandleWebhook(ctx, "messages.upsert", bytesPrivateWithoutTrigger)
	if err != nil {
		t.Fatalf("erro ao processar mensagem privada sem menção: %v", err)
	}
	if len(mockClient.sentMessages) != 0 {
		t.Fatalf("mensagem privada sem @vito não deveria responder, obteve %d", len(mockClient.sentMessages))
	}

	// 1b. Mensagem privada do usuário COM marcação explícita (@vito) -> Respondida
	payloadPrivateWithTrigger := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511988887777@s.whatsapp.net",
				"fromMe":    false,
			},
			"message": map[string]interface{}{
				"conversation": "@vito Quais são meus compromissos de hoje?",
			},
		},
	}
	bytesPrivateWithTrigger, _ := json.Marshal(payloadPrivateWithTrigger)

	err = svc.HandleWebhook(ctx, "messages.upsert", bytesPrivateWithTrigger)
	if err != nil {
		t.Fatalf("erro ao processar mensagem privada com @vito: %v", err)
	}
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 mensagem enviada para @vito, obteve %d", len(mockClient.sentMessages))
	}

	// 2. Mensagem com assinatura do Vito (fromMe ou não) -> Ignorada (anti-loop)
	payloadLoop := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511988887777@s.whatsapp.net",
				"fromMe":    true,
			},
			"message": map[string]interface{}{
				"conversation": "🎩 Vito:\n\nOlá! Sou o Vito...",
			},
		},
	}
	bytesLoop, _ := json.Marshal(payloadLoop)

	mockClient.sentMessages = nil
	err = svc.HandleWebhook(ctx, "messages.upsert", bytesLoop)
	if err != nil {
		t.Fatalf("erro ao processar loop: %v", err)
	}
	if len(mockClient.sentMessages) != 0 {
		t.Fatalf("mensagem com assinatura do Vito não deveria disparar nova resposta (anti-loop)")
	}

	// 3. Mensagem privada de TERCEIRO sem @vito -> Ignorada (privacidade absoluta)
	payloadThirdPartyNormal := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511999990000@s.whatsapp.net",
				"fromMe":    false,
			},
			"message": map[string]interface{}{
				"conversation": "Oi André, tudo bem? Vamos almoçar hoje?",
			},
		},
	}
	bytesThirdPartyNormal, _ := json.Marshal(payloadThirdPartyNormal)

	mockClient.sentMessages = nil
	err = svc.HandleWebhook(ctx, "messages.upsert", bytesThirdPartyNormal)
	if err != nil {
		t.Fatalf("erro ao processar mensagem normal de terceiro: %v", err)
	}
	if len(mockClient.sentMessages) != 0 {
		t.Fatalf("conversa privada normal de terceiro sem @vito não deveria ser respondida pelo Vito")
	}

	// 4. Mensagem privada de TERCEIRO chamando @vito -> Respondida
	payloadThirdPartyVito := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511999990000@s.whatsapp.net",
				"fromMe":    false,
			},
			"message": map[string]interface{}{
				"conversation": "@vito qual é o horário da nossa reunião?",
			},
		},
	}
	bytesThirdPartyVito, _ := json.Marshal(payloadThirdPartyVito)

	mockClient.sentMessages = nil
	err = svc.HandleWebhook(ctx, "messages.upsert", bytesThirdPartyVito)
	if err != nil {
		t.Fatalf("erro ao processar @vito em chat com terceiro: %v", err)
	}
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 mensagem respondida pelo Vito para terceiro chamando @vito, obteve %d", len(mockClient.sentMessages))
	}
}

func TestWhatsAppService_Webhook_DispatchesPushNotificationOnReply(t *testing.T) {
	svc, waRepo, mockClient := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	mockNotif := &mockNotificationSender{}
	svc.SetNotificationSender(mockNotif)

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-1",
		UserID:       "user-100",
		InstanceName: "vito_user_100",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnected,
	})

	payload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "12036302@g.us",
				"fromMe":    true, // No grupo onde só tem o usuário, fromMe é true!
			},
			"message": map[string]interface{}{
				"conversation": "@vito qual é meu próximo compromisso?",
			},
		},
	}
	payloadBytes, _ := json.Marshal(payload)

	err := svc.HandleWebhook(ctx, "messages.upsert", payloadBytes)
	if err != nil {
		t.Fatalf("erro no webhook: %v", err)
	}

	// 1. Deve ter respondido no WhatsApp com o prefixo 💼 Vito:
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 mensagem enviada no WhatsApp, obteve %d", len(mockClient.sentMessages))
	}
	if !strings.HasPrefix(mockClient.sentMessages[0].Text, "💼 Vito:") {
		t.Errorf("resposta no WhatsApp deveria ter o prefixo '💼 Vito:', obteve: %s", mockClient.sentMessages[0].Text)
	}

	// 2. Deve ter despachado Push Notification para o celular do usuário
	if len(mockNotif.sentPushes) != 1 {
		t.Fatalf("esperava 1 push notification despachada, obteve %d", len(mockNotif.sentPushes))
	}
	push := mockNotif.sentPushes[0]
	if push.UserID != "user-100" {
		t.Errorf("push enviado para userID incorreto: %s", push.UserID)
	}
	if push.Title != "💬 Vito (WhatsApp)" {
		t.Errorf("título do push incorreto: %s", push.Title)
	}
	if !strings.Contains(push.Body, "Respondeu no grupo") {
		t.Errorf("corpo do push deveria indicar resposta no grupo: %s", push.Body)
	}
}

func TestWhatsAppService_Webhook_UserFromMeInSelfChat(t *testing.T) {
	svc, waRepo, mockClient := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-1",
		UserID:       "user-100",
		InstanceName: "vito_user_100",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnected,
	})

	// Usuário manda mensagem na conversa consigo mesmo ("Você" / seu próprio número) sem precisar de chip extra, usando @vito
	payloadSelf := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511988887777@s.whatsapp.net",
				"fromMe":    true,
			},
			"message": map[string]interface{}{
				"conversation": "@vito me lembre de comprar café amanhã às 9h",
			},
		},
	}
	payloadBytes, _ := json.Marshal(payloadSelf)

	err := svc.HandleWebhook(ctx, "messages.upsert", payloadBytes)
	if err != nil {
		t.Fatalf("erro ao processar conversa própria: %v", err)
	}

	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 resposta na conversa própria, obteve %d", len(mockClient.sentMessages))
	}
}

func TestWhatsAppService_Webhook_UserFromMeInPrivateChatWithFriend_Ignored(t *testing.T) {
	svc, waRepo, mockClient := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-1",
		UserID:       "user-100",
		InstanceName: "vito_user_100",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnected,
	})

	// Usuário manda mensagem para um amigo em privado (não é grupo, não é ele mesmo e não chamou @vito)
	payloadFriend := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511999990000@s.whatsapp.net", // Amigo
				"fromMe":    true,
			},
			"message": map[string]interface{}{
				"conversation": "Fala cara, tudo bem? Vamos jogar bola hoje?",
			},
		},
	}
	payloadBytes, _ := json.Marshal(payloadFriend)

	err := svc.HandleWebhook(ctx, "messages.upsert", payloadBytes)
	if err != nil {
		t.Fatalf("erro no webhook: %v", err)
	}

	if len(mockClient.sentMessages) != 0 {
		t.Fatalf("Vito NÃO deveria interferir na conversa privada do usuário com um amigo")
	}
}

func TestWhatsAppService_Webhook_SendsReadReactionAndRetainsContext(t *testing.T) {
	svc, waRepo, mockClient := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-1",
		UserID:       "user-100",
		InstanceName: "vito_user_100",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnected,
	})

	// Turno 1: Usuário pergunta sobre emails com @vito
	payload1 := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511988887777@s.whatsapp.net",
				"fromMe":    true,
				"id":        "MSG-001",
			},
			"message": map[string]interface{}{
				"conversation": "@vito Quais são meus emails?",
			},
		},
	}
	p1Bytes, _ := json.Marshal(payload1)
	if err := svc.HandleWebhook(ctx, "messages.upsert", p1Bytes); err != nil {
		t.Fatalf("erro turno 1: %v", err)
	}

	// Verifica se a reação 👀 foi disparada para a mensagem MSG-001
	if len(mockClient.sentReactions) != 1 {
		t.Fatalf("esperava 1 reação enviada, obteve %d", len(mockClient.sentReactions))
	}
	if mockClient.sentReactions[0].Reaction != "👀" || mockClient.sentReactions[0].MessageID != "MSG-001" {
		t.Errorf("reação visual incorreta: %+v", mockClient.sentReactions[0])
	}

	// Turno 2: Usuário complementa com resposta contextual usando !vito
	payload2 := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511988887777@s.whatsapp.net",
				"fromMe":    true,
				"id":        "MSG-002",
			},
			"message": map[string]interface{}{
				"conversation": "!vito ok me diga aqui no chat",
			},
		},
	}
	p2Bytes, _ := json.Marshal(payload2)
	if err := svc.HandleWebhook(ctx, "messages.upsert", p2Bytes); err != nil {
		t.Fatalf("erro turno 2: %v", err)
	}

	// Verifica se enviou reação para o segundo turno também
	if len(mockClient.sentReactions) != 2 {
		t.Fatalf("esperava 2 reações enviadas, obteve %d", len(mockClient.sentReactions))
	}
	if mockClient.sentReactions[1].MessageID != "MSG-002" || mockClient.sentReactions[1].Reaction != "👀" {
		t.Errorf("reação do turno 2 incorreta: %+v", mockClient.sentReactions[1])
	}

	// Verifica se ambas respostas foram enviadas com a identidade 💼 Vito:
	if len(mockClient.sentMessages) != 2 {
		t.Fatalf("esperava 2 respostas enviadas, obteve %d", len(mockClient.sentMessages))
	}
	for i, msg := range mockClient.sentMessages {
		if !strings.HasPrefix(msg.Text, "💼 Vito:") {
			t.Errorf("resposta %d sem prefixo '💼 Vito:': %s", i, msg.Text)
		}
	}
}

func (m *mockEvolutionClient) FindMessages(ctx context.Context, in service.EvolutionFindMessagesInput) ([]service.WhatsAppChatMessage, error) {
	return m.mockMessages, m.mockFindMessagesErr
}

func (m *mockEvolutionClient) FindGroups(ctx context.Context, instanceName string) ([]service.WhatsAppGroup, error) {
	return m.mockGroups, m.mockFindGroupsErr
}

func (m *mockEvolutionClient) FindParticipants(ctx context.Context, instanceName, groupJid string) ([]string, error) {
	return m.mockParticipants, m.mockFindParticipantsErr
}

func (m *mockEvolutionClient) FindOwnerJID(ctx context.Context, instanceName string) (string, error) {
	return m.mockOwnerJID, m.mockOwnerJIDErr
}
