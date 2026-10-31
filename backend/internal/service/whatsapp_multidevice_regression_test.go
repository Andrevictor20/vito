package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestNormalizeJIDForSend(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"559884417165:33@s.whatsapp.net", "559884417165@s.whatsapp.net"},
		{"559884417165:1@s.whatsapp.net", "559884417165@s.whatsapp.net"},
		{"559884417165@s.whatsapp.net", "559884417165@s.whatsapp.net"},
		{"12036300112233@g.us", "12036300112233@g.us"},
		{"559884417165", "559884417165"},
		{"", ""},
	}
	for _, tc := range cases {
		got := service.NormalizeJIDForSend(tc.input)
		if got != tc.expected {
			t.Errorf("NormalizeJIDForSend(%q) = %q; esperava %q", tc.input, got, tc.expected)
		}
	}
}

func TestParseInboundMessage_EphemeralMessage(t *testing.T) {
	payload := []byte(`{
		"key": {
			"remoteJid": "12036300112233@g.us",
			"fromMe": false,
			"id": "ephemeral-123",
			"participant": "559884417165:33@s.whatsapp.net"
		},
		"pushName": "André",
		"message": {
			"ephemeralMessage": {
				"message": {
					"extendedTextMessage": {
						"text": "@vito qual minha agenda amanhã?"
					}
				}
			}
		}
	}`)

	msg, err := service.ParseInboundMessageForTest(payload)
	if err != nil {
		t.Fatalf("ParseInboundMessageForTest erro: %v", err)
	}
	if msg.Text != "@vito qual minha agenda amanhã?" {
		t.Errorf("esperava texto extraído de ephemeralMessage, obteve %q", msg.Text)
	}
	if msg.Participant != "559884417165:33@s.whatsapp.net" {
		t.Errorf("esperava participant preservado, obteve %q", msg.Participant)
	}
}

func TestHandleWebhook_AcceptsDataArray(t *testing.T) {
	mockClient := &recordingEvolutionClient{}
	astSvc := setupMockAssistantForRegression()
	repo := newMockWhatsAppRepoForRegression("inst-test", "559884417165")

	svc := service.NewWhatsAppService(service.WhatsAppServiceConfig{}, repo, mockClient, astSvc)
	svc.SetAsyncRunner(func(fn func()) { fn() }) // Síncrono

	// Payload onde "data" é uma lista [ {...} ]
	payload := []byte(`{
		"event": "messages.upsert",
		"instance": "inst-test",
		"data": [
			{
				"key": {
					"remoteJid": "559884417165:33@s.whatsapp.net",
					"fromMe": true,
					"id": "arr-msg-1"
				},
				"message": {
					"conversation": "@vito olá"
				}
			}
		]
	}`)

	err := svc.HandleWebhook(context.Background(), "messages.upsert", payload)
	if err != nil {
		t.Fatalf("HandleWebhook com data array falhou: %v", err)
	}
	if len(mockClient.sentMessages) == 0 {
		t.Errorf("esperava resposta enviada para mensagem em data array, mas nenhuma mensagem foi enviada")
	}
}

func TestHandleWebhook_OwnerInGroupWithFromMeFalse(t *testing.T) {
	mockClient := &recordingEvolutionClient{}
	astSvc := setupMockAssistantForRegression()
	// Dono cadastrado com telefone 559884417165
	repo := newMockWhatsAppRepoForRegression("inst-group", "559884417165")

	svc := service.NewWhatsAppService(service.WhatsAppServiceConfig{}, repo, mockClient, astSvc)
	svc.SetAsyncRunner(func(fn func()) { fn() }) // Síncrono

	// No grupo, fromMe vem como false, mas o participant é o dono com device ID :33
	payload := []byte(`{
		"event": "messages.upsert",
		"instance": "inst-group",
		"data": {
			"key": {
				"remoteJid": "12036300112233@g.us",
				"fromMe": false,
				"id": "grp-msg-owner",
				"participant": "559884417165:33@s.whatsapp.net"
			},
			"pushName": "André",
			"message": {
				"conversation": "@vito o que tenho hoje?"
			}
		}
	}`)

	err := svc.HandleWebhook(context.Background(), "messages.upsert", payload)
	if err != nil {
		t.Fatalf("HandleWebhook erro: %v", err)
	}
	if len(mockClient.sentMessages) == 0 {
		t.Errorf("Vito DEVE responder ao DONO mesmo que fromMe venha false no grupo")
	}
}

// AC-01: Entrega e Roteamento de Webhook WhatsApp Resiliente
// AC-02: Resolução de ReplyJID em Note-to-Self 047... e @lid + Anti-Loop
// AC-03: Correção de findOwnerJIDIn e Cadeia de Modelos Gemini no WhatsApp
// AC-08: Qualidade, Zero Regressões e No-God-Files < 500L
func TestResolveReplyJID(t *testing.T) {
	cases := []struct {
		name       string
		remoteJID  string
		altJID     string
		chatKind   string
		ownerJID   string
		ownerPhone string
		expected   string
	}{
		{
			name:       "AC-02: note-to-self com prefixo 047",
			remoteJID:  "047559884417165:33@s.whatsapp.net",
			altJID:     "",
			chatKind:   domain.WhatsAppChatKindSelf,
			ownerJID:   "559884417165@s.whatsapp.net",
			ownerPhone: "559884417165",
			expected:   "559884417165@s.whatsapp.net",
		},
		{
			name:       "AC-02: chat self via @lid",
			remoteJID:  "1849204920149@lid",
			altJID:     "",
			chatKind:   domain.WhatsAppChatKindSelf,
			ownerJID:   "559884417165@s.whatsapp.net",
			ownerPhone: "559884417165",
			expected:   "559884417165@s.whatsapp.net",
		},
		{
			name:       "AC-02: grupo deve manter o jid do grupo",
			remoteJID:  "12036300112233@g.us",
			altJID:     "",
			chatKind:   domain.WhatsAppChatKindGroup,
			ownerJID:   "559884417165@s.whatsapp.net",
			ownerPhone: "559884417165",
			expected:   "12036300112233@g.us",
		},
		{
			name:       "AC-02: chat @lid de terceiro com alt @s.whatsapp.net",
			remoteJID:  "1849204920149@lid",
			altJID:     "5511999998888@s.whatsapp.net",
			chatKind:   domain.WhatsAppChatKindDirect,
			ownerJID:   "559884417165@s.whatsapp.net",
			ownerPhone: "559884417165",
			expected:   "5511999998888@s.whatsapp.net",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := service.ResolveReplyJID(tc.remoteJID, tc.altJID, tc.chatKind, tc.ownerJID, tc.ownerPhone)
			if got != tc.expected {
				t.Errorf("ResolveReplyJID esperava %q, obteve %q", tc.expected, got)
			}
		})
	}
}

// AC-02: Classificação correta com ownerLID sem colisão
func TestClassifyChat_WithOwnerLID(t *testing.T) {
	// Se o JID remoto for o LID registrado do dono, classifica como self
	chatKind := service.ClassifyChat("1849204920149@lid", "559884417165", 0, false, "1849204920149@lid")
	if chatKind != domain.WhatsAppChatKindSelf {
		t.Errorf("esperava chatKind self para JID igual ao ownerLID, obteve %q", chatKind)
	}
}

// Helpers
type recordingEvolutionClient struct {
	sentMessages []string
}

func (c *recordingEvolutionClient) CreateInstance(ctx context.Context, instanceName, phone string) error {
	return nil
}
func (c *recordingEvolutionClient) DeleteInstance(ctx context.Context, instanceName string) error {
	return nil
}
func (c *recordingEvolutionClient) GetConnectionState(ctx context.Context, instanceName string) (string, error) {
	return "open", nil
}
func (c *recordingEvolutionClient) GetPairingCode(ctx context.Context, instanceName, phone string) (string, error) {
	return "12345678", nil
}
func (c *recordingEvolutionClient) SetWebhook(ctx context.Context, instanceName, webhookURL string) error {
	return nil
}
func (c *recordingEvolutionClient) SetSettings(ctx context.Context, instanceName string, settings map[string]interface{}) error {
	return nil
}
func (c *recordingEvolutionClient) Logout(ctx context.Context, instanceName string) error {
	return nil
}
func (c *recordingEvolutionClient) SendText(ctx context.Context, instanceName, to, text string) error {
	c.sentMessages = append(c.sentMessages, text)
	return nil
}
func (c *recordingEvolutionClient) SendTextWithQuoted(ctx context.Context, instanceName, to, text, quotedID string) error {
	c.sentMessages = append(c.sentMessages, text)
	return nil
}
func (c *recordingEvolutionClient) SendReaction(ctx context.Context, instanceName, remoteJID, messageID, reaction string) error {
	return nil
}
func (c *recordingEvolutionClient) GetMediaBase64(ctx context.Context, instanceName string, messagePayload interface{}) (string, error) {
	return "", nil
}
func (c *recordingEvolutionClient) FindMessages(ctx context.Context, in service.EvolutionFindMessagesInput) ([]service.WhatsAppChatMessage, error) {
	return nil, nil
}
func (c *recordingEvolutionClient) FindContacts(ctx context.Context, instanceName string) ([]service.WhatsAppContact, error) {
	return nil, nil
}
func (c *recordingEvolutionClient) FindGroups(ctx context.Context, instanceName string) ([]service.WhatsAppGroup, error) {
	return nil, nil
}
func (c *recordingEvolutionClient) FindParticipants(ctx context.Context, instanceName, groupJID string) ([]string, error) {
	return []string{"559884417165@s.whatsapp.net", "5511999999999@s.whatsapp.net"}, nil
}
func (c *recordingEvolutionClient) FindOwnerJID(ctx context.Context, instanceName string) (string, error) {
	return "559884417165@s.whatsapp.net", nil
}

type mockWhatsAppRepoForRegression struct {
	instName string
	phone    string
}

func newMockWhatsAppRepoForRegression(inst, phone string) *mockWhatsAppRepoForRegression {
	return &mockWhatsAppRepoForRegression{instName: inst, phone: phone}
}
func (m *mockWhatsAppRepoForRegression) Upsert(ctx context.Context, w *domain.WhatsAppIntegration) error {
	return nil
}
func (m *mockWhatsAppRepoForRegression) GetByUserID(ctx context.Context, userID string) (*domain.WhatsAppIntegration, error) {
	return &domain.WhatsAppIntegration{
		ID:           "test-id",
		UserID:       "user-1",
		InstanceName: m.instName,
		Phone:        m.phone,
		Status:       domain.WhatsAppStatusConnected,
	}, nil
}
func (m *mockWhatsAppRepoForRegression) GetByInstanceName(ctx context.Context, instanceName string) (*domain.WhatsAppIntegration, error) {
	if instanceName != m.instName {
		return nil, domain.ErrWhatsAppIntegrationNotFound
	}
	return &domain.WhatsAppIntegration{
		ID:           "test-id",
		UserID:       "user-1",
		InstanceName: m.instName,
		Phone:        m.phone,
		Status:       domain.WhatsAppStatusConnected,
	}, nil
}
func (m *mockWhatsAppRepoForRegression) GetByPhone(ctx context.Context, phone string) (*domain.WhatsAppIntegration, error) {
	return nil, nil
}
func (m *mockWhatsAppRepoForRegression) FindConnectedInstance(ctx context.Context) (*domain.WhatsAppIntegration, error) {
	return nil, nil
}
func (m *mockWhatsAppRepoForRegression) ListAll(ctx context.Context) ([]domain.WhatsAppIntegration, error) {
	return nil, nil
}
func (m *mockWhatsAppRepoForRegression) Delete(ctx context.Context, userID string) error {
	return nil
}
func (m *mockWhatsAppRepoForRegression) UpdateStatus(ctx context.Context, id, status string, lastConnectedAt *time.Time) error {
	return nil
}

type mockProviderForRegression struct{}

func (p *mockProviderForRegression) Name() string { return "mock" }
func (p *mockProviderForRegression) Model() string { return "mock-model" }
func (p *mockProviderForRegression) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	return &ai.ParsedIntent{
		Action:  ai.ActionGeneralChat,
		Message: "Olá! Tudo em ordem.",
	}, nil
}
func (p *mockProviderForRegression) GenerateText(ctx context.Context, prompt string) (string, error) {
	return "Olá! Tudo em ordem.", nil
}

func setupMockAssistantForRegression() *service.AssistantService {
	gateway := ai.NewGateway(&mockProviderForRegression{})
	return service.NewAssistantService(gateway, nil, nil, nil, nil)
}
