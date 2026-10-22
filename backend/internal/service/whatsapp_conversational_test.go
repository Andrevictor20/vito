package service_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockAudioTranscriber struct {
	transcribeCalled bool
	returnText       string
	returnErr        error
}

func (m *mockAudioTranscriber) Transcribe(ctx context.Context, audioReader io.Reader, filename string) (string, error) {
	m.transcribeCalled = true
	return m.returnText, m.returnErr
}

func setupConversationalWhatsAppTest(t *testing.T) (*service.WhatsAppService, *mockExtendedEvolutionClient, domain.WhatsAppRepository, domain.UserRepository) {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "test_whatsapp_conv.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("erro ao abrir banco de teste: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	phoneUser := "5511999998888"
	user := &domain.User{
		ID:        "user-conv-1",
		Email:     "conv@vito.local",
		Name:      "André Teste",
		Phone:     &phoneUser,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("erro ao criar usuário: %v", err)
	}

	phoneFriend := "5511988887777"
	friendUser := &domain.User{
		ID:        "user-friend-2",
		Email:     "friend@vito.local",
		Name:      "Amigo Vito",
		Phone:     &phoneFriend,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(friendUser); err != nil {
		t.Fatalf("erro ao criar amigo: %v", err)
	}

	waRepo := repository.NewWhatsAppRepository(db)
	integration := &domain.WhatsAppIntegration{
		ID:           "wa-conv-1",
		UserID:       user.ID,
		Phone:        "5511999998888",
		InstanceName: "vito_conv_user",
		Status:       domain.WhatsAppStatusConnected,
	}
	if err := waRepo.Upsert(context.Background(), integration); err != nil {
		t.Fatalf("erro ao criar integração: %v", err)
	}

	mockClient := &mockExtendedEvolutionClient{
		mockState:       "open",
		mockMediaBase64: base64.StdEncoding.EncodeToString([]byte("fake-ogg-audio-stream")),
		mockContacts: []service.WhatsAppContact{
			{
				ID:       "5511988887777@s.whatsapp.net",
				Name:     "Amigo Vito",
				PushName: "Amigo",
				Number:   "5511988887777",
			},
			{
				ID:       "5511977776666@s.whatsapp.net",
				Name:     "Contato Sem Vito",
				PushName: "Desconhecido",
				Number:   "5511977776666",
			},
		},
	}

	cfg := service.WhatsAppServiceConfig{
		WebhookBaseURL:  "https://vito.test",
		EvolutionAPIURL: "http://evolution.test",
		EvolutionAPIKey: "secret-key",
	}

	mockAI := &mockWhatsAppAIGateway{}
	assistantSvc := service.NewAssistantService(mockAI, nil, nil, nil)

	svc := service.NewWhatsAppService(cfg, waRepo, mockClient, assistantSvc)
	svc.SetUserRepo(userRepo)
	// Shadow inbox: sem ele as mensagens não são arquivadas e o contexto
	// (janela + citada) fica vazio.
	convRepo := repository.NewWhatsAppConversationRepository(db)
	svc.SetContextService(service.NewWhatsAppContextService(convRepo, service.DefaultWhatsAppContextConfig()))
	// Cache de nomes de contato: resolve os chats @lid e dá o nome SALVO
	// pelo dono (tem prioridade sobre o nome de perfil).
	contactsCache := service.NewWhatsAppContactsCache(mockClient, time.Hour)
	if _, err := contactsCache.Fetch(context.Background(), "vito_conv_user"); err != nil {
		t.Fatalf("erro ao preencher o cache de contatos: %v", err)
	}
	svc.SetContactsCache(contactsCache)
	// Runner síncrono: mantém as asserções determinísticas (em produção o
	// processamento com IA roda em background).
	svc.SetAsyncRunner(func(fn func()) { fn() })

	return svc, mockClient, waRepo, userRepo
}

type mockExtendedEvolutionClient struct {
	mockState       string
	mockMediaBase64 string
	mockContacts    []service.WhatsAppContact
	sentMessages    []struct {
		Instance string
		To       string
		Text     string
		QuotedID string
	}
	mediaDownloadedCount int
	findContactsCount    int
	mockMessages         []service.WhatsAppChatMessage
	mockFindMessagesErr  error
	mockGroups           []service.WhatsAppGroup
	mockFindGroupsErr    error
	mockParticipants     []string
	mockFindParticErr    error
	findMessagesCount    int
	findParticipantsCnt  int
	mockOwnerJID         string
	mockOwnerJIDErr      error
}

func (m *mockExtendedEvolutionClient) CreateInstance(ctx context.Context, instanceName, phone string) error {
	return nil
}

func (m *mockExtendedEvolutionClient) SetWebhook(ctx context.Context, instanceName, webhookURL string) error {
	return nil
}

func (m *mockExtendedEvolutionClient) SetSettings(ctx context.Context, instanceName string, settings map[string]interface{}) error {
	return nil
}

func (m *mockExtendedEvolutionClient) GetPairingCode(ctx context.Context, instanceName, phone string) (string, error) {
	return "TEST-1234", nil
}

func (m *mockExtendedEvolutionClient) GetConnectionState(ctx context.Context, instanceName string) (string, error) {
	return m.mockState, nil
}

func (m *mockExtendedEvolutionClient) DeleteInstance(ctx context.Context, instanceName string) error {
	return nil
}

func (m *mockExtendedEvolutionClient) Logout(ctx context.Context, instanceName string) error {
	return nil
}

func (m *mockExtendedEvolutionClient) SendText(ctx context.Context, instanceName, to, text string) error {
	m.sentMessages = append(m.sentMessages, struct {
		Instance string
		To       string
		Text     string
		QuotedID string
	}{
		Instance: instanceName,
		To:       to,
		Text:     text,
	})
	return nil
}

func (m *mockExtendedEvolutionClient) SendTextWithQuoted(ctx context.Context, instanceName, to, text, quotedID string) error {
	m.sentMessages = append(m.sentMessages, struct {
		Instance string
		To       string
		Text     string
		QuotedID string
	}{
		Instance: instanceName,
		To:       to,
		Text:     text,
		QuotedID: quotedID,
	})
	return nil
}

func (m *mockExtendedEvolutionClient) GetMediaBase64(ctx context.Context, instanceName string, messagePayload interface{}) (string, error) {
	m.mediaDownloadedCount++
	return m.mockMediaBase64, nil
}

func (m *mockExtendedEvolutionClient) FindContacts(ctx context.Context, instanceName string) ([]service.WhatsAppContact, error) {
	m.findContactsCount++
	return m.mockContacts, nil
}

func (m *mockExtendedEvolutionClient) SendReaction(ctx context.Context, instanceName, remoteJid, messageID, reaction string) error {
	return nil
}

type simpleTranscriber struct {
	transcribedText string
	called          bool
}

func (s *simpleTranscriber) Transcribe(ctx context.Context, audioReader io.Reader, filename string) (string, error) {
	s.called = true
	return s.transcribedText, nil
}

func TestWhatsAppService_AudioMessage_TranscribesWithGroqWhisper(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	mockTranscriber := &simpleTranscriber{
		transcribedText: "Qual é a minha próxima reunião hoje?",
	}
	svc.SetAudioTranscriber(mockTranscriber)

	webhookPayload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    false,
				"id":        "msg-audio-1",
			},
			"messageType": "audioMessage",
			"message": map[string]interface{}{
				"audioMessage": map[string]interface{}{
					"mimetype": "audio/ogg; codecs=opus",
					"seconds":  4,
				},
			},
		},
	}
	bytesPayload, _ := json.Marshal(webhookPayload)

	err := svc.HandleWebhook(context.Background(), "messages.upsert", bytesPayload)
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}

	if mockClient.mediaDownloadedCount == 0 {
		t.Errorf("esperava download de mídia de áudio na Evolution API")
	}

	if !mockTranscriber.called {
		t.Errorf("esperava chamada ao AudioTranscriber (Groq Whisper)")
	}

	if len(mockClient.sentMessages) == 0 {
		t.Fatalf("esperava resposta enviada pelo Vito para o áudio")
	}

	lastMsg := mockClient.sentMessages[len(mockClient.sentMessages)-1]
	if !strings.Contains(lastMsg.Text, "Vito:") {
		t.Errorf("resposta deve conter assinatura do Vito: %s", lastMsg.Text)
	}
}

func TestWhatsAppService_GroupMentions_RespondsWithQuoted(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	// Caso 1: Mensagem no grupo sem menção -> deve ser ignorada
	noMentionPayload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "12036300112233@g.us",
				"fromMe":    false,
				"id":        "msg-group-1",
			},
			"message": map[string]interface{}{
				"conversation": "Pessoal, vamos almoçar onde hoje?",
			},
		},
	}
	noMentionBytes, _ := json.Marshal(noMentionPayload)
	_ = svc.HandleWebhook(context.Background(), "messages.upsert", noMentionBytes)

	if len(mockClient.sentMessages) > 0 {
		t.Errorf("Vito NÃO deve responder a conversas gerais do grupo sem menção")
	}

	// Caso 2: Mensagem de TERCEIRO com !vito no grupo -> o Vito NÃO executa o
	// comando (blindagem: só o dono dá comandos) e responde com a recusativa,
	// citando a mensagem.
	withMentionPayload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "12036300112233@g.us",
				"fromMe":    false,
				"id":        "msg-group-2",
			},
			"message": map[string]interface{}{
				"conversation": "!vito me diga meus compromissos de amanhã",
			},
		},
	}
	withMentionBytes, _ := json.Marshal(withMentionPayload)
	err := svc.HandleWebhook(context.Background(), "messages.upsert", withMentionBytes)
	if err != nil {
		t.Fatalf("HandleWebhook erro: %v", err)
	}

	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 resposta (recusativa) para terceiro, obteve %d", len(mockClient.sentMessages))
	}

	sent := mockClient.sentMessages[0]
	if sent.QuotedID != "msg-group-2" {
		t.Errorf("esperava quotedID 'msg-group-2', obteve '%s'", sent.QuotedID)
	}
	if !strings.Contains(strings.ToLower(sent.Text), "dono") {
		t.Errorf("a resposta a terceiro deve explicar que só o dono dá comandos, obteve: %s", sent.Text)
	}
}

func TestWhatsAppService_MatchWhatsAppContacts(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	matched, err := svc.MatchWhatsAppContacts(context.Background(), "user-conv-1")
	if err != nil {
		t.Fatalf("MatchWhatsAppContacts retornou erro: %v", err)
	}

	if mockClient.findContactsCount == 0 {
		t.Errorf("esperava chamada a FindContacts no Evolution Client")
	}

	// Deve cruzar com a base de usuários: "user-friend-2" (5511988887777) usa Vito; 5511977776666 não usa
	if len(matched) != 1 {
		t.Fatalf("esperava 1 contato correspondido com conta Vito, obteve %d", len(matched))
	}

	if matched[0].UserID != "user-friend-2" {
		t.Errorf("esperava UserID 'user-friend-2', obteve '%s'", matched[0].UserID)
	}
	if matched[0].Name != "Amigo Vito" {
		t.Errorf("esperava Name 'Amigo Vito', obteve '%s'", matched[0].Name)
	}
}

func (m *mockExtendedEvolutionClient) FindMessages(ctx context.Context, in service.EvolutionFindMessagesInput) ([]service.WhatsAppChatMessage, error) {
	m.findMessagesCount++
	return m.mockMessages, m.mockFindMessagesErr
}

func (m *mockExtendedEvolutionClient) FindGroups(ctx context.Context, instanceName string) ([]service.WhatsAppGroup, error) {
	return m.mockGroups, m.mockFindGroupsErr
}

func (m *mockExtendedEvolutionClient) FindParticipants(ctx context.Context, instanceName, groupJid string) ([]string, error) {
	m.findParticipantsCnt++
	return m.mockParticipants, m.mockFindParticErr
}

func (m *mockExtendedEvolutionClient) FindOwnerJID(ctx context.Context, instanceName string) (string, error) {
	return m.mockOwnerJID, m.mockOwnerJIDErr
}
