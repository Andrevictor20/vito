package service_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// TestCanActOnMessage trava a REGRA DE OURO: só o dono da instância pode
// acionar o Vito.
//
// Sem isso, qualquer pessoa num grupo (ou num 1-1) podia escrever
// "@vito cria uma reunião amanhã" e o Vito criava o evento NA CONTA DO DONO —
// além de responder pelo WhatsApp dele.
func TestCanActOnMessage(t *testing.T) {
	casos := []struct {
		chatKind string
		fromMe   bool
		esperado bool
	}{
		// O dono pode, em qualquer conversa (no grupo/1-1 ele precisa mencionar).
		{domain.WhatsAppChatKindSelf, true, true},
		{domain.WhatsAppChatKindSelfGroup, true, true},
		{domain.WhatsAppChatKindGroup, true, true},
		{domain.WhatsAppChatKindDirect, true, true},
		// Chat pessoal (sem terceiros por construção): o dono sempre pode.
		{domain.WhatsAppChatKindSelf, false, true},
		{domain.WhatsAppChatKindSelfGroup, false, true},
		// Terceiro: NUNCA pode.
		{domain.WhatsAppChatKindGroup, false, false},
		{domain.WhatsAppChatKindDirect, false, false},
	}
	for _, c := range casos {
		obtido := service.CanActOnMessage(c.chatKind, c.fromMe)
		if obtido != c.esperado {
			t.Errorf("CanActOnMessage(kind=%q, fromMe=%v) = %v, esperava %v", c.chatKind, c.fromMe, obtido, c.esperado)
		}
	}
}

// payloadComVito monta um payload de webhook com (ou sem) menção ao Vito.
func payloadComVito(remoteJID, messageID, text string, fromMe bool) []byte {
	payload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": remoteJID,
				"fromMe":    fromMe,
				"id":        messageID,
			},
			"messageType": "conversation",
			"message":     map[string]interface{}{"conversation": text},
		},
	}
	bytesPayload, _ := json.Marshal(payload)
	return bytesPayload
}

// TestWhatsAppService_TerceiroNoGrupoNaoExecutaComando é o teste do bug
// reportado: outra pessoa num grupo chama @vito e o Vito executava na conta
// do dono.
func TestWhatsAppService_TerceiroNoGrupoNaoExecutaComando(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito("12036300112233@g.us", "msg-terceiro-grp", "@vito cria uma reunião amanhã às 10h", false))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}

	// A IA NÃO pode ser chamada: se fosse, o comando entraria na conta do dono.
	if gateway.input.Text != "" {
		t.Errorf("a IA não deveria ser acionada por terceiro, obteve: %q", gateway.input.Text)
	}
	// A resposta é a educada (e não uma resposta de comando).
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 resposta educativa, obteve %d", len(mockClient.sentMessages))
	}
	resposta := mockClient.sentMessages[0].Text
	if !strings.Contains(strings.ToLower(resposta), "dono") {
		t.Errorf("resposta deveria explicar que só o dono dá comandos, obteve: %s", resposta)
	}
	if strings.Contains(strings.ToLower(resposta), "criei") || strings.Contains(strings.ToLower(resposta), "agendei") {
		t.Errorf("a resposta não pode afirmar que executou o comando: %s", resposta)
	}
}

// TestWhatsAppService_TerceiroNoChatPrivadoNaoExecutaComando cobre o 1-on-1.
func TestWhatsAppService_TerceiroNoChatPrivadoNaoExecutaComando(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito("5511988887777@s.whatsapp.net", "msg-terceiro-1on1", "@vito manda uma mensagem pra Ana", false))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if gateway.input.Text != "" {
		t.Errorf("a IA não deveria ser acionada por terceiro, obteve: %q", gateway.input.Text)
	}
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 resposta educativa, obteve %d", len(mockClient.sentMessages))
	}
}

// TestWhatsAppService_TerceiroSemMencaoFicaSilencioso: terceiro sem @vito não
// gera nem resposta educativa (seria spam).
func TestWhatsAppService_TerceiroSemMencaoFicaSilencioso(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito("5511988887777@s.whatsapp.net", "msg-terceiro-silencioso", "bom dia, pessoal", false))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if gateway.input.Text != "" {
		t.Errorf("a IA não deveria ser acionada, obteve: %q", gateway.input.Text)
	}
	if len(mockClient.sentMessages) != 0 {
		t.Errorf("terceiro sem menção não deveria gerar resposta, obteve %d", len(mockClient.sentMessages))
	}
}

// TestWhatsAppService_MensagemDeTerceiroContinuaArquivada: a mensagem é
// ignorada para COMANDO, mas o Vito precisa continuar enxergando o que os
// outros falam (para resolver "a Ana me mandou aquilo").
func TestWhatsAppService_MensagemDeTerceiroContinuaArquivada(t *testing.T) {
	svc, _, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	if err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito("5511988887777@s.whatsapp.net", "msg-terceiro-arquivo", "a reunião é quinta às 10h", false)); err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}

	archived, err := svc.ContextMessageByID(context.Background(), "user-conv-1", "msg-terceiro-arquivo")
	if err != nil {
		t.Fatalf("falha ao buscar a mensagem arquivada: %v", err)
	}
	if archived == nil {
		t.Fatal("a mensagem do terceiro deveria estar arquivada (o Vito precisa ver o que os outros falam)")
	}
	if !strings.Contains(archived.Text, "quinta") {
		t.Errorf("o conteúdo arquivado deveria preservar a mensagem, obteve: %q", archived.Text)
	}
}

// TestWhatsAppService_DonoNoGrupoComandoExecutado garante que a blindagem
// NÃO quebrou o dono: ele continua mandando o Vito no grupo.
func TestWhatsAppService_DonoNoGrupoComandoExecutado(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito("12036300112233@g.us", "msg-dono-grp", "@vito qual é meu próximo compromisso?", true))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if gateway.input.Text == "" {
		t.Error("o dono deveria acionar o Vito normalmente no grupo")
	}
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 resposta do Vito ao dono, obteve %d", len(mockClient.sentMessages))
	}
	if !strings.Contains(mockClient.sentMessages[0].Text, "Vito:") {
		t.Errorf("a resposta ao dono deveria ter a assinatura do Vito: %s", mockClient.sentMessages[0].Text)
	}
}

// TestWhatsAppService_DonoNoChatVoceSemMencaoComandoExecutado: no chat "Você"
// o dono não precisa escrever @vito.
func TestWhatsAppService_DonoNoChatVoceSemMencaoComandoExecutado(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito("5511999998888@s.whatsapp.net", "msg-dono-self", "me lembra de comprar café", true))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if gateway.input.Text == "" {
		t.Error("o dono deveria acionar o Vito no chat 'Você' sem menção")
	}
	if len(mockClient.sentMessages) != 1 {
		t.Fatalf("esperava 1 resposta no chat 'Você', obteve %d", len(mockClient.sentMessages))
	}
}

// TestWhatsAppService_ApenasUmVitoPorMensagem reproduz o segundo problema
// relatado: duas pessoas com Vito no mesmo grupo ⇒ apenas o dono da mensagem
// aciona o seu Vito (o outro fica calado).
func TestWhatsAppService_ApenasUmVitoPorMensagem(t *testing.T) {
	// Instância do dono A (celular A).
	svcA, mockA, _, _ := setupConversationalWhatsAppTest(t)
	gatewayA := &mockGatewayCapturador{}
	svcA.SetAssistantService(service.NewAssistantService(gatewayA, nil, nil, nil))
	svcA.SetAsyncRunner(func(fn func()) { fn() })

	// Instância do dono B (celular B), com o próprio mock.
	svcB, mockB, _, _ := setupConversationalWhatsAppTest(t)
	gatewayB := &mockGatewayCapturador{}
	svcB.SetAssistantService(service.NewAssistantService(gatewayB, nil, nil, nil))
	svcB.SetAsyncRunner(func(fn func()) { fn() })

	// A mensagem "@vito ..." escrita por A: do ponto de vista da instância de A
	// ela é do dono (fromMe=true); na instância de B é de terceiro (false).
	if err := svcA.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito("12036300112233@g.us", "msg-dois-vitos", "@vito o que eu tenho amanhã?", true)); err != nil {
		t.Fatalf("HandleWebhook (A) retornou erro: %v", err)
	}
	if err := svcB.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito("12036300112233@g.us", "msg-dois-vitos", "@vito o que eu tenho amanhã?", false)); err != nil {
		t.Fatalf("HandleWebhook (B) retornou erro: %v", err)
	}

	if gatewayA.input.Text == "" {
		t.Error("o Vito do dono da mensagem deveria responder")
	}
	if gatewayB.input.Text != "" {
		t.Errorf("o Vito de quem NÃO é o dono da mensagem não deveria agir, obteve: %q", gatewayB.input.Text)
	}
	// O Vito do dono respondeu; o outro respondeu apenas a recus educada.
	if len(mockA.sentMessages) != 1 {
		t.Errorf("esperava 1 resposta na instância do dono, obteve %d", len(mockA.sentMessages))
	}
	if len(mockB.sentMessages) > 1 {
		t.Errorf("a instância do terceiro não deveria responder mais que a recusativa, obteve %d", len(mockB.sentMessages))
	}
}

// TestWhatsAppService_RespostaEducativaTemCooldown: "spam de @vito" não pode
// virar spam de resposta no grupo (e nem push no celular do dono).
func TestWhatsAppService_RespostaEducativaTemCooldown(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	for i := 0; i < 3; i++ {
		if err := svc.HandleWebhook(context.Background(), "messages.upsert",
			payloadComVito("5511988887777@s.whatsapp.net", "msg-spam-"+string(rune('a'+i)), "@vito cria uma tarefa", false)); err != nil {
			t.Fatalf("HandleWebhook retornou erro: %v", err)
		}
	}

	if len(mockClient.sentMessages) != 1 {
		t.Errorf("esperava 1 resposta educativa no cooldown, obteve %d", len(mockClient.sentMessages))
	}
}

var _ = ai.ActionGeneralChat
var _ = time.Now
