package service_test

import (
	"context"
	"encoding/json"
	"path/filepath"
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

func (m *mockEvolutionClient) SendReaction(ctx context.Context, instanceName, remoteJid, messageID, reaction string, fromMe bool) error {
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

func (m *mockWhatsAppAIGateway) Run(_ context.Context, _ domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	msg := "Olá! Sou o Vito, seu assistente pessoal."
	return &domain.UnifiedAssistantResponse{
		Text:    msg,
		Reply:   msg,
		Message: msg,
	}, nil
}

func (m *mockWhatsAppAIGateway) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, _ func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	return m.Run(ctx, req)
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

	svc := service.NewWhatsAppService(service.WhatsAppServiceConfig{
		WebhookBaseURL: "https://vito.rasppi.cloud",
	}, waRepo, mockClient)
	svc.SetAgentLoop(&mockWhatsAppAIGateway{})
	// Runner síncrono: mantém as asserções determinísticas (em produção o
	// processamento com IA roda em background).
	svc.SetAsyncRunner(func(fn func()) { fn() })

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

	// 2. Mensagem de grupo COM @vito de TERCEIRO (fromMe=false) -> o Vito não
	// executa o comando e, em grupo, NÃO envia recusativa (silencioso, para não
	// poluir o chat quando 2 pessoas têm o Vito instalado).
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
	if len(mockClient.sentMessages) != 0 {
		t.Fatalf("terceiro em grupo não deveria gerar resposta, obteve %d", len(mockClient.sentMessages))
	}
}

