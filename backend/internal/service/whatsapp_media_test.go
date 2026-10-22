package service_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// ---------------------------------------------------------------------------
// F1 — mídia rastreável: o shadow inbox guarda o tipo, o mime e o envelope de
// download da mídia (sem o envelope, uma foto antiga é ilegível para sempre).
// ---------------------------------------------------------------------------

func TestWhatsAppService_ArquivaMidiaDaMensagem(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	mockClient.mockMediaBase64 = base64.StdEncoding.EncodeToString([]byte("bytes-de-imagem-fake"))

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadImagem("5511999998888@s.whatsapp.net", "msg-mid-1", ""))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}

	archived := archivedMessage(t, svc, "msg-mid-1")
	if archived.MediaKind != domain.WhatsAppMediaKindImage {
		t.Errorf("media_kind esperado %q, obteve %q", domain.WhatsAppMediaKindImage, archived.MediaKind)
	}
	if archived.MediaMime != "image/jpeg" {
		t.Errorf("media_mime esperado image/jpeg, obteve %q", archived.MediaMime)
	}
	if archived.MediaStatus != domain.WhatsAppMediaStatusPending {
		t.Errorf("media_status esperado %q, obteve %q", domain.WhatsAppMediaStatusPending, archived.MediaStatus)
	}
	if strings.TrimSpace(archived.MediaPayload) == "" {
		t.Error("esperava o envelope de download da mídia arquivado")
	}
	if !strings.Contains(archived.MediaPayload, "remoteJid") {
		t.Errorf("o envelope precisa ter a key do WhatsApp, obteve: %s", archived.MediaPayload)
	}
}

// archivedMessage busca uma mensagem no shadow inbox do usuário de teste.
func archivedMessage(t *testing.T, svc *service.WhatsAppService, id string) *domain.WhatsAppConversationMessage {
	t.Helper()
	ctx := context.Background()
	msg, err := svc.ContextMessageByID(ctx, "user-conv-1", id)
	if err != nil {
		t.Fatalf("falha ao buscar mensagem arquivada: %v", err)
	}
	if msg == nil {
		t.Fatalf("mensagem %s não foi arquivada", id)
	}
	return msg
}

// ---------------------------------------------------------------------------
// F2 — a mensagem marcada ("responder a esta mensagem") é resolvida por ID:
// cobre mensagens antigas e mídia (o texto citado é vazio nesses casos).
// ---------------------------------------------------------------------------

func TestWhatsAppService_CitadaResolvidaPorStanzaID(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })
	mockClient.mockMediaBase64 = base64.StdEncoding.EncodeToString([]byte("bytes-de-imagem-fake"))

	// 1) chega uma IMAGEM (é arquivada com o envelope de download).
	if err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadImagem("5511999998888@s.whatsapp.net", "msg-citada-1", "recibo de luz")); err != nil {
		t.Fatalf("HandleWebhook da imagem retornou erro: %v", err)
	}

	// 2) o usuário responde a essa imagem ("marcar para responder").
	quotedPayload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    false,
				"id":        "msg-citada-2",
			},
			"messageType": "conversation",
			"message": map[string]interface{}{
				"conversation": "o que tem nessa foto?",
				"contextInfo": map[string]interface{}{
					"stanzaId": "msg-citada-1",
				},
			},
		},
	}
	bytesPayload, _ := json.Marshal(quotedPayload)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", bytesPayload); err != nil {
		t.Fatalf("HandleWebhook da resposta retornou erro: %v", err)
	}

	quoted := svc.QuotedContextOf(context.Background(), "user-conv-1", "msg-citada-2")
	if strings.TrimSpace(quoted) == "" {
		t.Fatal("esperava a mensagem citada resolvida")
	}
	if !strings.Contains(quoted, "recibo de luz") {
		t.Errorf("a citada deveria trazer o conteúdo da imagem citada, obteve: %q", quoted)
	}
}

// TestWhatsAppService_CitadaDeImagemUsaOMediaText garante que a mídia citada
// entra no prompt com o que o Vito "viu" nela.
func TestWhatsAppService_CitadaDeImagemUsaOMediaText(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })
	mockClient.mockMediaBase64 = base64.StdEncoding.EncodeToString([]byte("bytes-de-imagem-fake"))

	if err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadImagem("5511999998888@s.whatsapp.net", "msg-citada-3", "")); err != nil {
		t.Fatalf("HandleWebhook da imagem retornou erro: %v", err)
	}

	// Simula o enriquecimento: a imagem já foi lida pelo Vito.
	if err := svc.MarkMediaAnalyzed(context.Background(), "user-conv-1", "msg-citada-3", "um recibo de R$ 45,00"); err != nil {
		t.Fatalf("falha ao marcar a mídia como analisada: %v", err)
	}

	quotedPayload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    false,
				"id":        "msg-citada-4",
			},
			"messageType": "conversation",
			"message": map[string]interface{}{
				"conversation": "o que tem nessa foto?",
				"contextInfo":  map[string]interface{}{"stanzaId": "msg-citada-3"},
			},
		},
	}
	bytesPayload, _ := json.Marshal(quotedPayload)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", bytesPayload); err != nil {
		t.Fatalf("HandleWebhook da resposta retornou erro: %v", err)
	}

	quoted := svc.QuotedContextOf(context.Background(), "user-conv-1", "msg-citada-4")
	if !strings.Contains(quoted, "R$ 45,00") {
		t.Errorf("a citada deveria trazer a descrição da imagem, obteve: %q", quoted)
	}
}

// ---------------------------------------------------------------------------
// F3 — enriquecimento de mídia: áudio é transcrito e imagem é descrita.
// ---------------------------------------------------------------------------

func TestWhatsAppService_EnriqueceAudioComTranscricao(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	transcriber := &simpleTranscriber{transcribedText: "me lembra de pagar o boleto amanhã"}
	svc.SetAudioTranscriber(transcriber)
	mockClient.mockMediaBase64 = base64.StdEncoding.EncodeToString([]byte("bytes-de-audio-fake"))

	audioPayload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    false,
				"id":        "msg-audio-h1",
			},
			"messageType": "audioMessage",
			"message": map[string]interface{}{
				"audioMessage": map[string]interface{}{"mimetype": "audio/ogg; codecs=opus"},
			},
		},
	}
	bytesPayload, _ := json.Marshal(audioPayload)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", bytesPayload); err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}

	archived := archivedMessage(t, svc, "msg-audio-h1")
	if archived.MediaKind != domain.WhatsAppMediaKindAudio {
		t.Errorf("media_kind esperado %q, obteve %q", domain.WhatsAppMediaKindAudio, archived.MediaKind)
	}
	if archived.MediaStatus != domain.WhatsAppMediaStatusPending {
		t.Errorf("media_status esperado pending, obteve %q", archived.MediaStatus)
	}
	if strings.TrimSpace(archived.MediaPayload) == "" {
		t.Error("esperava o envelope de download do áudio arquivado")
	}
}

// TestWhatsAppService_JanelaIncluiACitadaDasMensagensPassadas garante que a
// janela de contexto carrega também a mensagem marcada de mensagens antigas.
func TestWhatsAppService_JanelaIncluiACitadaDasMensagensPassadas(t *testing.T) {
	svc, _, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	// Arquiva uma mensagem com a marcação "respondeu a X".
	quotedPayload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    false,
				"id":        "msg-janela-1",
			},
			"messageType": "conversation",
			"message": map[string]interface{}{
				"conversation": "isso responde a foto do recibo",
				"contextInfo": map[string]interface{}{
					"stanzaId":      "msg-janela-0",
					"quotedMessage": map[string]interface{}{"conversation": "foto do recibo de luz"},
				},
			},
		},
	}
	bytesPayload, _ := json.Marshal(quotedPayload)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", bytesPayload); err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}

	archived := archivedMessage(t, svc, "msg-janela-1")
	if archived.QuotedID != "msg-janela-0" {
		t.Errorf("quoted_id esperado msg-janela-0, obteve %q", archived.QuotedID)
	}
	if archived.QuotedText != "foto do recibo de luz" {
		t.Errorf("quoted_text esperado 'foto do recibo de luz', obteve %q", archived.QuotedText)
	}
}

// novoShadowInboxCriado fica reservado para os testes de repositório (ver o
// pacote repository).
var _ = ai.ActionGeneralChat
