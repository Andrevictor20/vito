package whatsapp_test

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

type capturedWAInput struct {
	Text               string
	QuotedContext      string
	ConversationWindow []ai.ChatMessageContext
}

// capturingAIGateway registra o input recebido via service.AssistantEngine para permitir asserções sobre o contexto.
type capturingAIGateway struct {
	inputs []capturedWAInput
}

func (m *capturingAIGateway) Run(_ context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	capIn := capturedWAInput{
		Text:          req.Message,
		QuotedContext: req.QuotedContext,
	}
	if idx := strings.Index(req.QuotedContext, "Janela recente do WhatsApp:\n"); idx >= 0 {
		winBlock := req.QuotedContext[idx+len("Janela recente do WhatsApp:\n"):]
		for _, line := range strings.Split(winBlock, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			var chat, sender, text string
			if strings.HasPrefix(line, "[") {
				if endBracket := strings.Index(line, "] "); endBracket > 1 {
					chat = strings.TrimSpace(line[1:endBracket])
					rest := line[endBracket+2:]
					if colon := strings.Index(rest, ": "); colon >= 0 {
						sender = strings.TrimSpace(rest[:colon])
						text = rest[colon+2:]
					} else {
						text = rest
					}
				} else {
					text = line
				}
			} else {
				text = line
			}
			capIn.ConversationWindow = append(capIn.ConversationWindow, ai.ChatMessageContext{
				Chat:   chat,
				Sender: sender,
				Text:   text,
			})
		}
	}
	m.inputs = append(m.inputs, capIn)
	return &domain.UnifiedAssistantResponse{
		Text:    "Entendido.",
		Reply:   "Entendido.",
		Message: "Entendido.",
	}, nil
}

func (m *capturingAIGateway) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, _ func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	return m.Run(ctx, req)
}

func (m *capturingAIGateway) lastInput() capturedWAInput {
	if len(m.inputs) == 0 {
		return capturedWAInput{}
	}
	return m.inputs[len(m.inputs)-1]
}

// failingConversationRepo simula falha de leitura do shadow inbox (fail-open).
type failingConversationRepo struct {
	domain.WhatsAppConversationRepository
}

func (f failingConversationRepo) RecentMessages(ctx context.Context, userID, chatJID string, limit int, since time.Time) ([]domain.WhatsAppConversationMessage, error) {
	return nil, errors.New("falha simulada de leitura")
}

func (f failingConversationRepo) RecentMessagesAcrossChats(ctx context.Context, userID string, limit int, since time.Time) ([]domain.WhatsAppConversationMessage, error) {
	return nil, errors.New("falha simulada de leitura")
}

type contextualFixture struct {
	svc        *whatsapp.WhatsAppService
	contextSvc *whatsapp.WhatsAppContextService
	groupMeta  *whatsapp.WhatsAppGroupMeta
	repo       domain.WhatsAppConversationRepository
	waRepo     domain.WhatsAppRepository
	userRepo   domain.UserRepository
	gateway    *capturingAIGateway
	client     *mockExtendedEvolutionClient
}

func setupContextualWhatsApp(t *testing.T) *contextualFixture {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "test_whatsapp_context.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("erro ao abrir banco de teste: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	phone := "5511999998888"
	user := &domain.User{
		ID:        "user-ctx-1",
		Email:     "ctx@vito.local",
		Name:      "André Contexto",
		Phone:     &phone,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("erro ao criar usuário: %v", err)
	}

	waRepo := whatsapp.NewWhatsAppRepository(db)
	integration := &domain.WhatsAppIntegration{
		ID:           "wa-ctx-1",
		UserID:       user.ID,
		Phone:        phone,
		InstanceName: "vito_ctx_user",
		Status:       domain.WhatsAppStatusConnected,
	}
	if err := waRepo.Upsert(context.Background(), integration); err != nil {
		t.Fatalf("erro ao criar integração: %v", err)
	}

	mockClient := &mockExtendedEvolutionClient{mockState: "open"}
	gateway := &capturingAIGateway{}

	convRepo := whatsapp.NewWhatsAppConversationRepository(db)
	contextSvc := whatsapp.NewWhatsAppContextService(convRepo, whatsapp.DefaultWhatsAppContextConfig())
	groupMeta := whatsapp.NewWhatsAppGroupMeta(mockClient, time.Hour, 24*time.Hour)

	svc := whatsapp.NewWhatsAppService(whatsapp.WhatsAppServiceConfig{
		WebhookBaseURL:  "https://vito.test",
		EvolutionAPIURL: "http://evolution.test",
		EvolutionAPIKey: "secret-key",
	}, waRepo, mockClient)
	svc.SetAgentLoop(gateway)
	svc.SetUserRepo(userRepo)
	svc.SetContextService(contextSvc)
	svc.SetGroupMeta(groupMeta)
	// Runner síncrono: em produção o processamento roda em background (a análise
	// de imagem pode levar dezenas de segundos); nos testes mantemos a
	// asserção determinística logo após o HandleWebhook.
	svc.SetAsyncRunner(func(fn func()) { fn() })

	return &contextualFixture{
		svc:        svc,
		contextSvc: contextSvc,
		groupMeta:  groupMeta,
		repo:       convRepo,
		waRepo:     waRepo,
		userRepo:   userRepo,
		gateway:    gateway,
		client:     mockClient,
	}
}

// buildPayload monta um payload messages.upsert da Evolution API.
func buildPayload(remoteJID, messageID, text string, extras ...map[string]interface{}) []byte {
	message := map[string]interface{}{"conversation": text}
	for _, extra := range extras {
		for k, v := range extra {
			message[k] = v
		}
	}
	payload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_ctx_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": remoteJID,
				"fromMe":    false,
				"id":        messageID,
			},
			"pushName": "André",
			"message":  message,
		},
	}
	bytes, _ := json.Marshal(payload)
	return bytes
}

func selfJID() string   { return "5511999998888@s.whatsapp.net" }
func friendJID() string { return "5511888887777@s.whatsapp.net" }
func groupJID() string  { return "12036300112233@g.us" }

// AC-F1 — a mensagem citada chega ao assistente.
func TestWhatsAppContext_QuotedMessageReachesAssistant(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	payload := buildPayload(selfJID(), "msg-quoted-1", "@vito isso aqui", map[string]interface{}{
		"extendedTextMessage": map[string]interface{}{
			"text": "@vito isso aqui",
			"contextInfo": map[string]interface{}{
				"stanzaId": "msg-original-1",
				"quotedMessage": map[string]interface{}{
					"conversation": "reunião com a Ana quinta às 10h",
				},
			},
		},
	})

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}

	input := fx.gateway.lastInput()
	if !strings.Contains(input.QuotedContext, "reunião com a Ana quinta às 10h") {
		t.Errorf("esperava a mensagem citada no contexto, obteve %q", input.QuotedContext)
	}
}

// AC-F2 — a janela traz as mensagens anteriores do chat com autor e rótulo.
func TestWhatsAppContext_WindowContainsPreviousMessagesOfSameChat(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-1", "preciso marcar com a Ana")); err != nil {
		t.Fatalf("primeiro webhook: %v", err)
	}
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-2", "@vito isso que falei antes")); err != nil {
		t.Fatalf("segundo webhook: %v", err)
	}

	window := fx.gateway.lastInput().ConversationWindow
	if len(window) == 0 {
		t.Fatal("esperava janela de contexto com a mensagem anterior")
	}
	found := false
	for _, m := range window {
		if strings.Contains(m.Text, "preciso marcar com a Ana") {
			found = true
			if m.Chat != "Você" {
				t.Errorf("esperava rótulo do chat 'Você', obteve %q", m.Chat)
			}
		}
	}
	if !found {
		t.Errorf("janela não contém a mensagem anterior: %+v", window)
	}
}

// AC-F3 — no chat "Você" o Vito enxerga outros chats (cross-chat).
func TestWhatsAppContext_CrossChatAllowedInSelfChat(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	// Mensagem em outro chat (conversa com a Ana) — não aciona o Vito, mas é arquivada.
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(friendJID(), "msg-ana-1", "pode ser quinta às 10h")); err != nil {
		t.Fatalf("webhook da Ana: %v", err)
	}
	if len(fx.client.sentMessages) != 0 {
		t.Fatalf("o Vito não deveria responder em conversa com terceiro sem gatilho")
	}

	// Agora, no chat "Você", o Vito deve enxergar a conversa com a Ana ao ser chamado com @vito.
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-self-1", "@vito lembra da reunião que falei que queria fazer com a Ana?")); err != nil {
		t.Fatalf("webhook do chat Você: %v", err)
	}

	window := fx.gateway.lastInput().ConversationWindow
	found := false
	for _, m := range window {
		if strings.Contains(m.Text, "pode ser quinta às 10h") {
			found = true
		}
	}
	if !found {
		t.Errorf("esperava a mensagem da Ana na janela cross-chat, obteve %+v", window)
	}
}

// AC-F4 — em conversa com terceiro o contexto fica restrito àquele chat.
func TestWhatsAppContext_CrossChatBlockedInDirectChat(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	// Mensagem no chat "Você" (deve ficar fora da janela de um chat de terceiro).
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-self-1", "segredo do banco: 1234")); err != nil {
		t.Fatalf("webhook do chat Você: %v", err)
	}

	// No chat com a Ana, com @vito: a janela NÃO pode conter o chat "Você".
	payload := buildPayload(friendJID(), "msg-ana-2", "@vito o que eu te contei?", map[string]interface{}{})
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("webhook da Ana: %v", err)
	}

	for _, m := range fx.gateway.lastInput().ConversationWindow {
		if strings.Contains(m.Text, "segredo do banco") {
			t.Fatalf("vazamento cross-chat em conversa com terceiro: %+v", m)
		}
	}
}

// AC-F16 — grupo só com o usuário NÃO responde sem menção explícita, mas responde com @vito.
func TestWhatsAppContext_SelfGroupRequiresTrigger(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	fx.groupMeta.SetParticipants(groupJID(), 1)

	// 1. Mensagem sem menção explícita no grupo próprio -> arquiva e não responde
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(groupJID(), "msg-grp-sem-vito", "anota a reunião com a Ana")); err != nil {
		t.Fatalf("HandleWebhook sem menção: %v", err)
	}
	if len(fx.client.sentMessages) != 0 {
		t.Fatalf("não deveria responder no grupo-so-comigo sem menção, obteve %d", len(fx.client.sentMessages))
	}

	// 2. Mensagem com @vito no grupo próprio -> responde
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(groupJID(), "msg-grp-com-vito", "@vito anota a reunião com a Ana")); err != nil {
		t.Fatalf("HandleWebhook com menção: %v", err)
	}
	if len(fx.client.sentMessages) != 1 {
		t.Fatalf("esperava resposta no grupo-so-comigo com @vito, obteve %d", len(fx.client.sentMessages))
	}
}

// AC-F17 — grupo com outras pessoas exige @vito; e, mesmo com @vito, um
// TERCEIRO não comanda o Vito (blindagem: só o dono dá comandos).
func TestWhatsAppContext_GroupWithOthersRequiresMention(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	fx.groupMeta.SetParticipants(groupJID(), 3)

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(groupJID(), "msg-grp-2", "conversa geral do grupo")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}
	if len(fx.client.sentMessages) != 0 {
		t.Fatalf("o Vito não deve responder em grupo sem menção")
	}

	// Com menção, mas de TERCEIRO (fromMe=false): o Vito não executa o comando
	// e, em grupo, NÃO envia recusa educada (silencioso, para não poluir o chat
	// quando 2 pessoas têm o Vito instalado).
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(groupJID(), "msg-grp-3", "@vito meus compromissos de amanhã")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}
	if len(fx.client.sentMessages) != 0 {
		t.Fatalf("terceiro em grupo não deveria gerar resposta, obteve %d", len(fx.client.sentMessages))
	}
}

// AC-F5 — o contexto sobrevive à reinicialização do backend (persistido, não em RAM).
func TestWhatsAppContext_SurvivesServiceRestart(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-persist-1", "guarda isso aqui")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	// Novo serviço (simula restart) usando o mesmo repositório.
	restarted := whatsapp.NewWhatsAppContextService(fx.repo, whatsapp.DefaultWhatsAppContextConfig())
	window := restarted.Window(context.Background(), "user-ctx-1", selfJID(), domain.WhatsAppChatKindSelf, "isso que falei", "")
	if len(window) == 0 {
		t.Fatal("esperava que o contexto persistisse após reinício")
	}
	if !strings.Contains(window[0].Text, "guarda isso aqui") {
		t.Errorf("esperava a mensagem persistida, obteve %+v", window)
	}
}

// AC-F10 — falha na leitura do shadow inbox não impede a resposta (fail-open).
func TestWhatsAppContext_FailOpenWhenInboxUnavailable(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	failing := whatsapp.NewWhatsAppContextService(failingConversationRepo{WhatsAppConversationRepository: fx.repo}, whatsapp.DefaultWhatsAppContextConfig())
	fx.svc.SetContextService(failing)

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-fail-1", "@vito olá")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}
	if len(fx.client.sentMessages) != 1 {
		t.Fatalf("esperava resposta mesmo com o inbox indisponível, obteve %d", len(fx.client.sentMessages))
	}
}

// AC-F12 — "Limpar histórico" remove todas as mensagens arquivadas.
func TestWhatsAppContext_PurgeRemovesArchivedMessages(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-purge-1", "algo para apagar")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	msgs, err := fx.repo.RecentMessagesAcrossChats(context.Background(), "user-ctx-1", 50, time.Now().Add(-72*time.Hour))
	if err != nil {
		t.Fatalf("falha ao ler inbox: %v", err)
	}
	if len(msgs) == 0 {
		t.Fatal("esperava mensagem arquivada antes da limpeza")
	}

	if err := fx.contextSvc.PurgeMessages(context.Background(), "user-ctx-1"); err != nil {
		t.Fatalf("PurgeMessages: %v", err)
	}

	msgs, err = fx.repo.RecentMessagesAcrossChats(context.Background(), "user-ctx-1", 50, time.Now().Add(-72*time.Hour))
	if err != nil {
		t.Fatalf("falha ao reler inbox: %v", err)
	}
	if len(msgs) != 0 {
		t.Fatalf("esperava inbox vazio após a limpeza, restaram %d", len(msgs))
	}
}

// AC-F14 — a retenção remove mensagens antigas.
func TestWhatsAppContext_PruneRemovesOldMessages(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	old := &domain.WhatsAppConversationMessage{
		ID:               "msg-old-1",
		UserID:           "user-ctx-1",
		InstanceName:     "vito_ctx_user",
		ChatJID:          selfJID(),
		ChatKind:         domain.WhatsAppChatKindSelf,
		ChatLabel:        "Você",
		SenderName:       "André",
		Text:             "mensagem antiga",
		MessageTimestamp: time.Now().UTC().AddDate(0, 0, -45),
		CreatedAt:        time.Now().UTC().AddDate(0, 0, -45),
	}
	if err := fx.repo.SaveMessage(context.Background(), old); err != nil {
		t.Fatalf("SaveMessage: %v", err)
	}

	removed, err := fx.contextSvc.PruneOlderThan(context.Background(), time.Now().UTC().AddDate(0, 0, -30))
	if err != nil {
		t.Fatalf("PruneOlderThan: %v", err)
	}
	if removed != 1 {
		t.Fatalf("esperava 1 mensagem removida, obteve %d", removed)
	}
}

// AC-F8 — a janela inclui as respostas anteriores do Vito (evita duplicar ação).
