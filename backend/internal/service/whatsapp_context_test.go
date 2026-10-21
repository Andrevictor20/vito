package service_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

// capturingAIGateway registra o input recebido para permitir asserções sobre o contexto.
type capturingAIGateway struct {
	inputs []ai.UserInput
}

func (m *capturingAIGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	m.inputs = append(m.inputs, input)
	return &ai.ParsedIntent{
		Action:  ai.ActionGeneralChat,
		Message: "Entendido.",
	}, nil
}

func (m *capturingAIGateway) lastInput() ai.UserInput {
	if len(m.inputs) == 0 {
		return ai.UserInput{}
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
	svc        *service.WhatsAppService
	contextSvc *service.WhatsAppContextService
	groupMeta  *service.WhatsAppGroupMeta
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

	waRepo := repository.NewWhatsAppRepository(db)
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
	assistantSvc := service.NewAssistantService(gateway, nil, nil, nil)

	convRepo := repository.NewWhatsAppConversationRepository(db)
	contextSvc := service.NewWhatsAppContextService(convRepo, service.DefaultWhatsAppContextConfig())
	groupMeta := service.NewWhatsAppGroupMeta(mockClient, time.Hour, 24*time.Hour)

	svc := service.NewWhatsAppService(service.WhatsAppServiceConfig{
		WebhookBaseURL:  "https://vito.test",
		EvolutionAPIURL: "http://evolution.test",
		EvolutionAPIKey: "secret-key",
	}, waRepo, mockClient, assistantSvc)
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

	payload := buildPayload(selfJID(), "msg-quoted-1", "isso aqui", map[string]interface{}{
		"extendedTextMessage": map[string]interface{}{
			"text": "isso aqui",
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
		buildPayload(selfJID(), "msg-2", "isso que falei antes")); err != nil {
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

	// Agora, no chat "Você", o Vito deve enxergar a conversa com a Ana.
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-self-1", "lembra da reunião que falei que queria fazer com a Ana?")); err != nil {
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

// AC-F16 — grupo só com o usuário dispensa a menção @vito.
func TestWhatsAppContext_SelfGroupRespondsWithoutMention(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	fx.groupMeta.SetParticipants(groupJID(), 1)

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(groupJID(), "msg-grp-1", "anota a reunião com a Ana")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}
	if len(fx.client.sentMessages) != 1 {
		t.Fatalf("esperava resposta no grupo-so-comigo, obteve %d", len(fx.client.sentMessages))
	}
}

// AC-F17 — grupo com outras pessoas exige @vito.
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

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(groupJID(), "msg-grp-3", "@vito meus compromissos de amanhã")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}
	if len(fx.client.sentMessages) != 1 {
		t.Fatalf("esperava 1 resposta após menção, obteve %d", len(fx.client.sentMessages))
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
	restarted := service.NewWhatsAppContextService(fx.repo, service.DefaultWhatsAppContextConfig())
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

	failing := service.NewWhatsAppContextService(failingConversationRepo{WhatsAppConversationRepository: fx.repo}, service.DefaultWhatsAppContextConfig())
	fx.svc.SetContextService(failing)

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-fail-1", "olá")); err != nil {
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
func TestWhatsAppContext_WindowIncludesPreviousVitoReplies(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	payload := buildPayload(selfJID(), "msg-vito-1", "💼 Vito:\n\nAgendei: Dentista — 14/10 às 14h", nil)
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}
	if len(fx.client.sentMessages) != 0 {
		t.Fatalf("o Vito não deve responder à própria mensagem (anti-loop)")
	}

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-after-1", "e o dentista?")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	found := false
	for _, m := range fx.gateway.lastInput().ConversationWindow {
		if strings.Contains(m.Text, "Agendei: Dentista") {
			found = true
			if m.Sender != "Vito" {
				t.Errorf("esperava o remetente 'Vito', obteve %q", m.Sender)
			}
		}
	}
	if !found {
		t.Errorf("esperava a resposta anterior do Vito na janela, obteve %+v", fx.gateway.lastInput().ConversationWindow)
	}
}

// AC-P1 — o caminho quente não busca contexto na Evolution API (só envia a resposta).
func TestWhatsAppContext_HotPathDoesNotFetchFromEvolution(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	for i := 0; i < 3; i++ {
		payload := buildPayload(selfJID(), "msg-perf-"+string(rune('a'+i)), "isso que falei")
		if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
			t.Fatalf("HandleWebhook: %v", err)
		}
	}

	if fx.client.findMessagesCount != 0 {
		t.Errorf("o caminho quente não deve chamar findMessages, chamou %d vezes", fx.client.findMessagesCount)
	}
	if fx.client.findParticipantsCnt != 0 {
		t.Errorf("o caminho quente não deve chamar findParticipants, chamou %d vezes", fx.client.findParticipantsCnt)
	}
}

// Tier 0 (P2) — mensagens autocontidas não exigem a janela completa.
func TestNeedsFullWindow_ReferentialDetection(t *testing.T) {
	referential := []string{
		"isso aqui",
		"aquilo",
		"sobre essa reunião",
		"lembra disso?",
		"sim",
		"e o de amanhã?",
	}
	for _, text := range referential {
		if !service.NeedsFullWindow(text) {
			t.Errorf("esperava janela completa para %q", text)
		}
	}

	selfContained := []string{
		"cria uma tarefa para revisar o contrato do cliente até sexta-feira",
		"agenda uma reunião de alinhamento com o time às quinze horas de amanhã",
	}
	for _, text := range selfContained {
		if service.NeedsFullWindow(text) {
			t.Errorf("esperava janela mínima para %q", text)
		}
	}
}

// O texto da janela é truncado no limite configurado.
func TestTruncateContextText_RespectsLimit(t *testing.T) {
	long := "palavra repetida many times "
	got := service.TruncateContextText(long, 40)
	if len([]rune(got)) > 41 {
		t.Errorf("esperava no máximo 41 runes, obteve %d", len([]rune(got)))
	}
	if got == "" {
		t.Error("esperava texto truncado não vazio")
	}
}

func TestWhatsAppContext_ScopeOffDisablesContext(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-off-1", "primeira mensagem")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}
	if _, err := fx.contextSvc.UpdateSettings(context.Background(), "user-ctx-1", domain.WhatsAppContextScopeOff, 12); err != nil {
		t.Fatalf("UpdateSettings: %v", err)
	}
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert",
		buildPayload(selfJID(), "msg-off-2", "isso aqui")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	input := fx.gateway.lastInput()
	if len(input.ConversationWindow) != 0 {
		t.Errorf("esperava janela vazia com scope=off, obteve %+v", input.ConversationWindow)
	}
	if input.QuotedContext != "" {
		t.Errorf("esperava contexto citado vazio com scope=off, obteve %q", input.QuotedContext)
	}
}

// Regressão: a Evolution entrega texto em `extendedTextMessage` (sem `conversation`).
// Antes o texto vinha VAZIO e o Vito nunca respondia nesse formato.
func TestWhatsAppContext_ReadsExtendedTextMessageFormat(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	payload := []byte(`{
		"event": "messages.upsert",
		"instance": "vito_ctx_user",
		"data": {
			"key": {"remoteJid": "5511999998888@s.whatsapp.net", "fromMe": true, "id": "msg-ext-1"},
			"pushName": "André",
			"messageType": "extendedTextMessage",
			"message": {"extendedTextMessage": {"text": "o que eu falei antes sobre a Ana?"}}
		}
	}`)

	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}
	if len(fx.client.sentMessages) != 1 {
		t.Fatalf("esperava resposta do Vito no formato extendedTextMessage, obteve %d", len(fx.client.sentMessages))
	}
	input := fx.gateway.lastInput()
	if input.Text != "o que eu falei antes sobre a Ana?" {
		t.Errorf("texto recebido pela IA incorreto: %q", input.Text)
	}
}

// Regressão: o JID prefixado do chat "Você" deve ser classificado como self,
// liberando o cross-chat e dispensando o @vito.
func TestWhatsAppContext_PrefixedSelfJIDEnablesCrossChat(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	// Integra o usuário com o número real (o JID do "Você" carrega o prefixo 047).
	integration, err := fx.waRepo.GetByInstanceName(context.Background(), "vito_ctx_user")
	if err != nil || integration == nil {
		t.Fatalf("integração não encontrada: %v", err)
	}
	integration.Phone = "559884097322"
	if err := fx.waRepo.Upsert(context.Background(), integration); err != nil {
		t.Fatalf("Upsert: %v", err)
	}

	// Mensagem em outro chat (LID de contato) — arquivada, sem acionar o Vito.
	otherChat := []byte(`{
		"event": "messages.upsert",
		"instance": "vito_ctx_user",
		"data": {
			"key": {"remoteJid": "471331507024120@lid", "fromMe": false, "id": "msg-lid-1"},
			"pushName": "Ana",
			"messageType": "extendedTextMessage",
			"message": {"extendedTextMessage": {"text": "pode ser quinta às 10h"}}
		}
	}`)
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert", otherChat); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	// No chat "Você" (JID prefixado), sem @vito: o Vito responde e enxerga o outro chat.
	selfChat := []byte(`{
		"event": "messages.upsert",
		"instance": "vito_ctx_user",
		"data": {
			"key": {"remoteJid": "047559884097322@s.whatsapp.net", "fromMe": true, "id": "msg-self-2"},
			"pushName": "André",
			"messageType": "extendedTextMessage",
			"message": {"extendedTextMessage": {"text": "lembra da reunião com a Ana?"}}
		}
	}`)
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert", selfChat); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	if len(fx.client.sentMessages) != 1 {
		t.Fatalf("esperava resposta no chat Você sem @vito, obteve %d", len(fx.client.sentMessages))
	}
	window := fx.gateway.lastInput().ConversationWindow
	found := false
	for _, m := range window {
		if strings.Contains(m.Text, "pode ser quinta às 10h") {
			found = true
		}
	}
	if !found {
		t.Errorf("esperava a mensagem de outro chat na janela cross-chat, obteve %+v", window)
	}
}

// O telefone cadastrado pode ser DIFERENTE do número do WhatsApp pareado:
// o owner JID é a única referência confiável para o chat "Você".
func TestWhatsAppContext_OwnerJIDIdentifiesSelfChat(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	ctx := context.Background()

	// Telefone cadastrado (outro número) e owner JID (número realmente pareado).
	integration, err := fx.waRepo.GetByInstanceName(ctx, "vito_ctx_user")
	if err != nil || integration == nil {
		t.Fatalf("integração não encontrada: %v", err)
	}
	integration.Phone = "5598984417165"
	if err := fx.waRepo.Upsert(ctx, integration); err != nil {
		t.Fatalf("Upsert: %v", err)
	}
	ownerCache := service.NewWhatsAppOwnerCache(fx.client, time.Hour)
	ownerCache.Set("vito_ctx_user", "559884097322@s.whatsapp.net")
	fx.svc.SetOwnerCache(ownerCache)

	// Mensagem em outro chat (LID de contato) — arquivada, sem acionar o Vito.
	otherChat := []byte(`{
		"event": "messages.upsert",
		"instance": "vito_ctx_user",
		"data": {
			"key": {"remoteJid": "471331507024120@lid", "fromMe": false, "id": "msg-lid-2"},
			"pushName": "Ana",
			"messageType": "extendedTextMessage",
			"message": {"extendedTextMessage": {"text": "pode ser quinta às 10h"}}
		}
	}`)
	if err := fx.svc.HandleWebhook(ctx, "messages.upsert", otherChat); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	// Chat "Você" com o JID do número paired: sem @vito, responde e enxerga o outro chat.
	selfChat := []byte(`{
		"event": "messages.upsert",
		"instance": "vito_ctx_user",
		"data": {
			"key": {"remoteJid": "559884097322@s.whatsapp.net", "fromMe": true, "id": "msg-self-3"},
			"pushName": "André",
			"messageType": "extendedTextMessage",
			"message": {"extendedTextMessage": {"text": "lembra da reunião com a Ana?"}}
		}
	}`)
	if err := fx.svc.HandleWebhook(ctx, "messages.upsert", selfChat); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	if len(fx.client.sentMessages) != 1 {
		t.Fatalf("esperava resposta no chat Você sem @vito, obteve %d", len(fx.client.sentMessages))
	}
	found := false
	for _, m := range fx.gateway.lastInput().ConversationWindow {
		if strings.Contains(m.Text, "pode ser quinta às 10h") {
			found = true
		}
	}
	if !found {
		t.Errorf("esperava a mensagem de outro chat na janela cross-chat, obteve %+v", fx.gateway.lastInput().ConversationWindow)
	}
}

// archiveMessage grava uma mensagem no shadow inbox com um timestamp arbitrário.
func archiveMessage(t *testing.T, fx *contextualFixture, id, chatJID, chatKind, label, text string, ts time.Time) {
	t.Helper()
	if err := fx.repo.SaveMessage(context.Background(), &domain.WhatsAppConversationMessage{
		ID:               id,
		UserID:           "user-ctx-1",
		InstanceName:     "vito_ctx_user",
		ChatJID:          chatJID,
		ChatKind:         chatKind,
		ChatLabel:        label,
		SenderName:       "André",
		Text:             text,
		MessageTimestamp: ts,
		CreatedAt:        ts,
	}); err != nil {
		t.Fatalf("SaveMessage: %v", err)
	}
}

// A janela precisa enxergar o MESMO período que o backfill importa (30 dias).
// Com 72h o histórico importado era filtrado fora e o Vito respondia "não sei".
func TestWhatsAppContext_WindowCoversBackfillHorizon(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()

	archiveMessage(t, fx, "msg-20d", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "conversa de vinte dias atras", now.AddDate(0, 0, -20))
	archiveMessage(t, fx, "msg-40d", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "conversa de quarenta dias atras", now.AddDate(0, 0, -40))

	window := fx.contextSvc.SelfWindow(context.Background(), "user-ctx-1", "")
	joined := ""
	for _, m := range window {
		joined += m.Text + " | "
	}
	if !strings.Contains(joined, "vinte dias atras") {
		t.Errorf("mensagem de 20 dias deveria entrar na janela, obteve: %q", joined)
	}
	if strings.Contains(joined, "quarenta dias atras") {
		t.Errorf("mensagem de 40 dias está fora do horizonte de 30 dias, obteve: %q", joined)
	}
}

// Marcadores de recuperação de memória exigem a janela completa.
func TestWhatsAppContext_RecallIntentUsesFullWindow(t *testing.T) {
	recalls := []string{
		"lembra da reunião com a Ana?",
		"o que eu falei com a Ana?",
		"aquela conversa de ontem",
		"sobre o que a gente conversou?",
	}
	for _, text := range recalls {
		if !service.NeedsFullWindow(text) {
			t.Errorf("esperava janela completa para %q", text)
		}
	}

	// Comandos autocontidos continuam usando a janela mínima.
	autocontidos := []string{
		"cria uma tarefa para revisar o contrato do cliente até sexta-feira",
		"agenda uma reunião de alinhamento com o time às quinze horas de amanhã",
	}
	for _, text := range autocontidos {
		if service.NeedsFullWindow(text) {
			t.Errorf("esperava janela mínima para %q", text)
		}
	}
}

// O chat ativo não pode expulsar as demais conversas da janela cross-chat.
func TestWhatsAppContext_CrossChatKeepsDiversity(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()

	// 10 mensagens no chat atual (o "Você") e 4 na conversa com a Ana.
	for i := 0; i < 10; i++ {
		archiveMessage(t, fx, fmt.Sprintf("msg-self-%02d", i), selfJID(), domain.WhatsAppChatKindSelf, "Você",
			fmt.Sprintf("mensagem do chat atual %d", i), now.Add(-time.Duration(i)*time.Minute))
	}
	for i := 0; i < 4; i++ {
		archiveMessage(t, fx, fmt.Sprintf("msg-ana-%02d", i), friendJID(), domain.WhatsAppChatKindDirect, "Ana",
			fmt.Sprintf("mensagem da Ana %d", i), now.Add(-time.Duration(i+20)*time.Minute))
	}

	window := fx.contextSvc.SelfWindow(context.Background(), "user-ctx-1", "")
	if len(window) == 0 {
		t.Fatal("esperava janela com mensagens")
	}

	hasAna := false
	for _, m := range window {
		if strings.Contains(m.Text, "mensagem da Ana") {
			hasAna = true
			break
		}
	}
	if !hasAna {
		t.Errorf("a conversa com a Ana foi expulsa da janela pelo chat atual: %+v", window)
	}
}

// O app e o desktop recebem o mesmo contexto; com escopo "chat" só a conversa "Você".
func TestWhatsAppContext_SelfWindowRespectsScope(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()
	ctx := context.Background()

	archiveMessage(t, fx, "msg-self-x", selfJID(), domain.WhatsAppChatKindSelf, "Você", "conversa do proprio usuario", now)
	archiveMessage(t, fx, "msg-ana-x", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "conversa da Ana", now)

	// scope=all => todos os chats
	window := fx.contextSvc.SelfWindow(ctx, "user-ctx-1", "")
	if len(window) != 2 {
		t.Fatalf("esperava 2 mensagens com scope=all, obteve %d", len(window))
	}

	// scope=chat => apenas a conversa "Você"
	if _, err := fx.contextSvc.UpdateSettings(ctx, "user-ctx-1", domain.WhatsAppContextScopeChat, 12); err != nil {
		t.Fatalf("UpdateSettings: %v", err)
	}
	window = fx.contextSvc.SelfWindow(ctx, "user-ctx-1", "")
	if len(window) != 1 {
		t.Fatalf("esperava 1 mensagem com scope=chat, obteve %d", len(window))
	}
	if !strings.Contains(window[0].Text, "conversa do proprio usuario") {
		t.Errorf("esperava a conversa 'Você', obteve %q", window[0].Text)
	}

	// scope=off => nada
	if _, err := fx.contextSvc.UpdateSettings(ctx, "user-ctx-1", domain.WhatsAppContextScopeOff, 12); err != nil {
		t.Fatalf("UpdateSettings: %v", err)
	}
	if window := fx.contextSvc.SelfWindow(ctx, "user-ctx-1", ""); len(window) != 0 {
		t.Errorf("esperava janela vazia com scope=off, obteve %d", len(window))
	}
}

// A prévia mostra o que o Vito está enxergando agora.
func TestWhatsAppContext_PreviewReportsWhatVitoSees(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()

	archiveMessage(t, fx, "msg-p1", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "aqui esta a reunion com a Ana", now)
	archiveMessage(t, fx, "msg-p2", selfJID(), domain.WhatsAppChatKindSelf, "Você", "ok combinado", now)

	preview, err := fx.contextSvc.Preview(context.Background(), "user-ctx-1")
	if err != nil {
		t.Fatalf("Preview: %v", err)
	}
	if preview.ArchivedTotal != 2 {
		t.Errorf("esperava 2 mensagens arquivadas, obteve %d", preview.ArchivedTotal)
	}
	if preview.WindowMessages != 2 {
		t.Errorf("esperava 2 mensagens na janela, obteve %d", preview.WindowMessages)
	}
	if preview.MaxAgeDays != 30 {
		t.Errorf("esperava horizonte de 30 dias, obteve %d", preview.MaxAgeDays)
	}
	if len(preview.Chats) == 0 {
		t.Error("esperava a lista de chats da janela")
	}
}

// O shadow inbox arquiva TUDO, inclusive os códigos de acesso que o Vito envia
// no login por WhatsApp. Esses segredos não podem ir para a janela (e nem para
// a LLM de terceiro).
func TestWhatsAppContext_SecretsNeverEnterTheWindow(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()
	ctx := context.Background()

	archiveMessage(t, fx, "msg-secret-1", selfJID(), domain.WhatsAppChatKindSelf, "Você",
		"Seu codigo de acesso ao Vito e: 216637", now)
	archiveMessage(t, fx, "msg-secret-2", selfJID(), domain.WhatsAppChatKindSelf, "Você",
		"216637", now)
	archiveMessage(t, fx, "msg-secret-3", selfJID(), domain.WhatsAppChatKindSelf, "Você",
		"seu codigo de verificacao e 884512", now)
	archiveMessage(t, fx, "msg-ok-1", selfJID(), domain.WhatsAppChatKindSelf, "Você",
		"reuniao com a Ana quinta as 10h", now)

	window := fx.contextSvc.SelfWindow(ctx, "user-ctx-1", "")
	for _, m := range window {
		if strings.Contains(m.Text, "216637") || strings.Contains(m.Text, "884512") {
			t.Fatalf("segredo entrou na janela de contexto: %q", m.Text)
		}
	}
	if len(window) != 1 {
		t.Fatalf("esperava apenas a mensagem legitima na janela, obteve %d: %+v", len(window), window)
	}
	if !strings.Contains(window[0].Text, "reuniao com a Ana") {
		t.Errorf("a mensagem legitima deveria estar na janela, obteve %q", window[0].Text)
	}
}

// O filtro de segredo não pode descartar mensagens legítimas que têm números:
// datas, valores e horários continuam entrando na janela.
func TestWhatsAppContext_LegitimateNumbersAreNotFiltered(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()
	ctx := context.Background()

	legit := []string{
		"reuniao 12 10 15",
		"ganhei 1000000",
		"paguei R$ 2500",
		"quinta 10h com a Ana",
	}
	for i, text := range legit {
		archiveMessage(t, fx, fmt.Sprintf("msg-legit-%02d", i), selfJID(), domain.WhatsAppChatKindSelf, "Você", text, now)
	}

	window := fx.contextSvc.SelfWindow(ctx, "user-ctx-1", "")
	if len(window) != len(legit) {
		t.Fatalf("esperava %d mensagens na janela, obteve %d: %+v", len(legit), len(window), window)
	}
}
