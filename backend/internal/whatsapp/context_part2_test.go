package whatsapp_test

import (
	"context"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"strings"
	"testing"
	"time"
)

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
		buildPayload(selfJID(), "msg-after-1", "@vito e o dentista?")); err != nil {
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
		if !whatsapp.NeedsFullWindow(text) {
			t.Errorf("esperava janela completa para %q", text)
		}
	}

	selfContained := []string{
		"cria uma tarefa para revisar o contrato do cliente até sexta-feira",
		"agenda uma reunião de alinhamento com o time às quinze horas de amanhã",
	}
	for _, text := range selfContained {
		if whatsapp.NeedsFullWindow(text) {
			t.Errorf("esperava janela mínima para %q", text)
		}
	}
}

// O texto da janela é truncado no limite configurado.
func TestTruncateContextText_RespectsLimit(t *testing.T) {
	long := "palavra repetida many times "
	got := whatsapp.TruncateContextText(long, 40)
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
			"message": {"extendedTextMessage": {"text": "@vito o que eu falei antes sobre a Ana?"}}
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
// liberando o cross-chat ao ser chamado com @vito.
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

	// No chat "Você" (JID prefixado), com @vito: o Vito responde e enxerga o outro chat.
	selfChat := []byte(`{
		"event": "messages.upsert",
		"instance": "vito_ctx_user",
		"data": {
			"key": {"remoteJid": "047559884097322@s.whatsapp.net", "fromMe": true, "id": "msg-self-2"},
			"pushName": "André",
			"messageType": "extendedTextMessage",
			"message": {"extendedTextMessage": {"text": "@vito lembra da reunião com a Ana?"}}
		}
	}`)
	if err := fx.svc.HandleWebhook(context.Background(), "messages.upsert", selfChat); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	if len(fx.client.sentMessages) != 1 {
		t.Fatalf("esperava resposta no chat Você com @vito, obteve %d", len(fx.client.sentMessages))
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
	ownerCache := whatsapp.NewWhatsAppOwnerCache(fx.client, time.Hour)
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

	// Chat "Você" com o JID do número paired: com @vito, responde e enxerga o outro chat.
	selfChat := []byte(`{
		"event": "messages.upsert",
		"instance": "vito_ctx_user",
		"data": {
			"key": {"remoteJid": "559884097322@s.whatsapp.net", "fromMe": true, "id": "msg-self-3"},
			"pushName": "André",
			"messageType": "extendedTextMessage",
			"message": {"extendedTextMessage": {"text": "@vito lembra da reunião com a Ana?"}}
		}
	}`)
	if err := fx.svc.HandleWebhook(ctx, "messages.upsert", selfChat); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}

	if len(fx.client.sentMessages) != 1 {
		t.Fatalf("esperava resposta no chat Você com @vito, obteve %d", len(fx.client.sentMessages))
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
		if !whatsapp.NeedsFullWindow(text) {
			t.Errorf("esperava janela completa para %q", text)
		}
	}

	// Comandos autocontidos continuam usando a janela mínima.
	autocontidos := []string{
		"cria uma tarefa para revisar o contrato do cliente até sexta-feira",
		"agenda uma reunião de alinhamento com o time às quinze horas de amanhã",
	}
	for _, text := range autocontidos {
		if whatsapp.NeedsFullWindow(text) {
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
