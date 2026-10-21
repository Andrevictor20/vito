package service_test

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockEvolutionClient struct {
	createInstanceCalled bool
	setWebhookCalled     bool
	getPairingCodeCalled bool
	logoutCalled         bool
	deleteInstanceCalled bool
	sentMessages         []struct {
		Instance string
		To       string
		Text     string
	}
	mockMessages            []service.WhatsAppChatMessage
	mockFindMessagesErr     error
	mockGroups              []service.WhatsAppGroup
	mockFindGroupsErr       error
	mockParticipants        []string
	mockFindParticipantsErr error
	sentReactions           []struct {
		Instance  string
		RemoteJid string
		MessageID string
		Reaction  string
	}
	mockPairingCode string
	mockState       string
	mockOwnerJID    string
	mockOwnerJIDErr error
}

func (m *mockEvolutionClient) CreateInstance(ctx context.Context, instanceName, phone string) error {
	m.createInstanceCalled = true
	return nil
}

func (m *mockEvolutionClient) SetWebhook(ctx context.Context, instanceName, webhookURL string) error {
	m.setWebhookCalled = true
	return nil
}

func (m *mockEvolutionClient) SetSettings(ctx context.Context, instanceName string, settings map[string]interface{}) error {
	return nil
}

func (m *mockEvolutionClient) GetPairingCode(ctx context.Context, instanceName, phone string) (string, error) {
	m.getPairingCodeCalled = true
	return m.mockPairingCode, nil
}

func (m *mockEvolutionClient) GetConnectionState(ctx context.Context, instanceName string) (string, error) {
	return m.mockState, nil
}

func (m *mockEvolutionClient) DeleteInstance(ctx context.Context, instanceName string) error {
	m.deleteInstanceCalled = true
	return nil
}

func (m *mockEvolutionClient) Logout(ctx context.Context, instanceName string) error {
	m.logoutCalled = true
	return nil
}

func (m *mockEvolutionClient) SendText(ctx context.Context, instanceName, to, text string) error {
	return m.SendTextWithQuoted(ctx, instanceName, to, text, "")
}

func (m *mockEvolutionClient) SendTextWithQuoted(ctx context.Context, instanceName, to, text, quotedID string) error {
	m.sentMessages = append(m.sentMessages, struct {
		Instance string
		To       string
		Text     string
	}{
		Instance: instanceName,
		To:       to,
		Text:     text,
	})
	return nil
}

func (m *mockEvolutionClient) GetMediaBase64(ctx context.Context, instanceName string, messagePayload interface{}) (string, error) {
	return "", nil
}

func (m *mockEvolutionClient) FindContacts(ctx context.Context, instanceName string) ([]service.WhatsAppContact, error) {
	return nil, nil
}

func (m *mockEvolutionClient) SendReaction(ctx context.Context, instanceName, remoteJid, messageID, reaction string) error {
	m.sentReactions = append(m.sentReactions, struct {
		Instance  string
		RemoteJid string
		MessageID string
		Reaction  string
	}{
		Instance:  instanceName,
		RemoteJid: remoteJid,
		MessageID: messageID,
		Reaction:  reaction,
	})
	return nil
}

type mockWhatsAppAIGateway struct{}

func (m *mockWhatsAppAIGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	return &ai.ParsedIntent{
		Action:  ai.ActionGeneralChat,
		Message: "Olá! Sou o Vito, seu assistente pessoal.",
	}, nil
}

type mockNotificationSender struct {
	sentPushes []struct {
		UserID   string
		Title    string
		Body     string
		Priority string
		Data     map[string]interface{}
	}
}

func (m *mockNotificationSender) SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error) {
	m.sentPushes = append(m.sentPushes, struct {
		UserID   string
		Title    string
		Body     string
		Priority string
		Data     map[string]interface{}
	}{
		UserID:   userID,
		Title:    title,
		Body:     body,
		Priority: priority,
		Data:     data,
	})
	return 1, nil
}

func setupWhatsAppServiceTest(t *testing.T) (*service.WhatsAppService, *repository.WhatsAppRepositorySQLite, *mockEvolutionClient) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "test_wa_svc.db"))
	if err != nil {
		t.Fatalf("falha ao abrir test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:        "user-100",
		Name:      "André Victor",
		Email:     "andre@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	waRepo := repository.NewWhatsAppRepository(db)
	mockClient := &mockEvolutionClient{
		mockPairingCode: "ABCD-1234",
		mockState:       "close",
	}

	assistantSvc := service.NewAssistantService(&mockWhatsAppAIGateway{}, nil, nil, nil)

	svc := service.NewWhatsAppService(service.WhatsAppServiceConfig{
		WebhookBaseURL: "https://vito.rasppi.cloud",
	}, waRepo, mockClient, assistantSvc)

	return svc, waRepo, mockClient
}

func TestWhatsAppService_RequestPairingCode_Success(t *testing.T) {
	svc, waRepo, mockClient := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	code, err := svc.RequestPairingCode(ctx, "user-100", "(11) 98888-7777")
	if err != nil {
		t.Fatalf("erro inesperado ao pedir código de pareamento: %v", err)
	}

	if code != "ABCD-1234" {
		t.Errorf("código inesperado: %s", code)
	}
	if !mockClient.createInstanceCalled || !mockClient.setWebhookCalled || !mockClient.getPairingCodeCalled {
		t.Errorf("nem todos os métodos do client Evolution foram invocados")
	}

	saved, err := waRepo.GetByUserID(ctx, "user-100")
	if err != nil {
		t.Fatalf("integração não foi salva no banco: %v", err)
	}
	if saved.Phone != "5511988887777" {
		t.Errorf("telefone não foi normalizado para E.164: %s", saved.Phone)
	}
	if saved.Status != domain.WhatsAppStatusConnecting {
		t.Errorf("status deveria ser connecting, mas foi %s", saved.Status)
	}
	if saved.PairingCode != "ABCD-1234" {
		t.Errorf("código salvo incorreto: %s", saved.PairingCode)
	}
}

func TestWhatsAppService_RequestPairingCode_InvalidPhone(t *testing.T) {
	svc, _, _ := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	_, err := svc.RequestPairingCode(ctx, "user-100", "123")
	if err != domain.ErrWhatsAppInvalidPhone {
		t.Fatalf("esperava ErrWhatsAppInvalidPhone, obteve %v", err)
	}
}

func TestWhatsAppService_GetStatus_SyncsOpenState(t *testing.T) {
	svc, waRepo, mockClient := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-1",
		UserID:       "user-100",
		InstanceName: "vito_user_100",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnecting,
		PairingCode:  "ABCD-1234",
	})

	mockClient.mockState = "open"

	status, err := svc.GetStatus(ctx, "user-100")
	if err != nil {
		t.Fatalf("erro ao buscar status: %v", err)
	}
	if status.Status != domain.WhatsAppStatusConnected {
		t.Errorf("esperava status connected após sincronização com Evolution API, obteve %s", status.Status)
	}
	if status.LastConnectedAt == nil {
		t.Errorf("LastConnectedAt deveria ter sido preenchido")
	}
}

func TestWhatsAppService_Disconnect(t *testing.T) {
	svc, waRepo, mockClient := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-1",
		UserID:       "user-100",
		InstanceName: "vito_user_100",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnected,
	})

	err := svc.Disconnect(ctx, "user-100")
	if err != nil {
		t.Fatalf("falha ao desconectar: %v", err)
	}
	if !mockClient.logoutCalled {
		t.Errorf("Logout não foi invocado na Evolution API")
	}

	saved, err := waRepo.GetByUserID(ctx, "user-100")
	if err != nil {
		t.Fatalf("erro ao buscar do repo: %v", err)
	}
	if saved.Status != domain.WhatsAppStatusDisconnected {
		t.Errorf("status deveria ser disconnected, obteve %s", saved.Status)
	}
}

func TestWhatsAppService_Webhook_ConnectionUpdate(t *testing.T) {
	svc, waRepo, _ := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-1",
		UserID:       "user-100",
		InstanceName: "vito_user_100",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnecting,
	})

	payload := map[string]interface{}{
		"event":    "connection.update",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"state": "open",
		},
	}
	payloadBytes, _ := json.Marshal(payload)

	err := svc.HandleWebhook(ctx, "connection.update", payloadBytes)
	if err != nil {
		t.Fatalf("erro no webhook: %v", err)
	}

	saved, _ := waRepo.GetByUserID(ctx, "user-100")
	if saved.Status != domain.WhatsAppStatusConnected {
		t.Errorf("esperava connected, obteve %s", saved.Status)
	}
}

func TestWhatsAppService_Webhook_GroupPrivacy(t *testing.T) {
	svc, waRepo, mockClient := setupWhatsAppServiceTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-1",
		UserID:       "user-100",
		InstanceName: "vito_user_100",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnected,
	})

	// 1. Mensagem de grupo SEM @vito -> Deve ser ignorada (Zero processamento, privacidade total)
	payloadIgnore := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "12036302@g.us",
				"fromMe":    false,
			},
			"message": map[string]interface{}{
				"conversation": "Alguém viu onde deixei as chaves?",
			},
		},
	}
	bytesIgnore, _ := json.Marshal(payloadIgnore)

	err := svc.HandleWebhook(ctx, "messages.upsert", bytesIgnore)
	if err != nil {
		t.Fatalf("erro no webhook: %v", err)
	}
	if len(mockClient.sentMessages) != 0 {
		t.Fatalf("mensagem de grupo sem menção deveria ter sido ignorada, mas disparou envio")
	}

	// 2. Mensagem de grupo COM @vito -> Deve ser respondida
	payloadRespond := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "12036302@g.us",
				"fromMe":    false,
			},
			"message": map[string]interface{}{
				"conversation": "@vito qual a previsão do tempo para hoje?",
			},
		},
	}
	bytesRespond, _ := json.Marshal(payloadRespond)

	err = svc.HandleWebhook(ctx, "messages.upsert", bytesRespond)
	if err != nil {
		t.Fatalf("erro no webhook: %v", err)
	}
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 mensagem enviada, obteve %d", len(mockClient.sentMessages))
	}
	if !strings.Contains(mockClient.sentMessages[0].Text, "Vito") {
		t.Errorf("resposta não continha texto do assistente: %s", mockClient.sentMessages[0].Text)
	}
}

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

	// 1. Mensagem privada do usuário -> Respondida
	payloadPrivate := map[string]interface{}{
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
	bytesPrivate, _ := json.Marshal(payloadPrivate)

	err := svc.HandleWebhook(ctx, "messages.upsert", bytesPrivate)
	if err != nil {
		t.Fatalf("erro ao processar mensagem privada: %v", err)
	}
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 mensagem enviada, obteve %d", len(mockClient.sentMessages))
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

	// Usuário manda mensagem na conversa consigo mesmo ("Você" / seu próprio número) sem precisar de chip extra
	payloadSelf := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_user_100",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511988887777@s.whatsapp.net",
				"fromMe":    true,
			},
			"message": map[string]interface{}{
				"conversation": "me lembre de comprar café amanhã às 9h",
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

	// Turno 1: Usuário pergunta sobre emails
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
				"conversation": "Quais são meus emails?",
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

	// Turno 2: Usuário complementa com resposta contextual
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
				"conversation": "ok me diga aqui no chat",
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
