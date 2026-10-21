package service_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/service"
)

// mockGatewayCapturador registra o input recebido pela IA.
type mockGatewayCapturador struct {
	input ai.UserInput
}

func (m *mockGatewayCapturador) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	m.input = input
	return &ai.ParsedIntent{
		Action:  ai.ActionGeneralChat,
		Message: "É um recibo de R$ 45,00.",
	}, nil
}

// payloadImagem monta um payload de webhook da Evolution com imagem.
func payloadImagem(remoteJID, messageID, caption string) []byte {
	imageMessage := map[string]any{
		"mimetype": "image/jpeg",
		"caption":  caption,
		"url":      "https://mmg.whatsapp.net/v/t62.7117-24/wa/file-1",
	}
	payload := map[string]any{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]any{
			"key": map[string]any{
				"remoteJid": remoteJID,
				"fromMe":    false,
				"id":        messageID,
			},
			"messageType": "imageMessage",
			"message": map[string]any{
				"imageMessage": imageMessage,
			},
		},
	}
	bytesPayload, _ := json.Marshal(payload)
	return bytesPayload
}

// TestWhatsAppService_ImagemNoChatVoce_AnalisaEGeraResposta
//
// O Vito ignorava completamente imagens no WhatsApp: o parser não tinha
// IsImage e o fluxo abortava quando a mensagem não tinha texto.
func TestWhatsAppService_ImagemNoChatVoce_AnalisaEGeraResposta(t *testing.T) {
	svc, mockClient, waRepo, userRepo := setupConversationalWhatsAppTest(t)
	_ = waRepo
	_ = userRepo

	gateway := &mockGatewayCapturador{}
	assistantSvc := service.NewAssistantService(gateway, nil, nil, nil)
	svc.SetAssistantService(assistantSvc)
	svc.SetAsyncRunner(func(fn func()) { fn() })

	mockClient.mockMediaBase64 = base64.StdEncoding.EncodeToString([]byte("bytes-de-imagem-fake"))

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadImagem("5511999998888@s.whatsapp.net", "msg-img-1", ""))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}

	if mockClient.mediaDownloadedCount == 0 {
		t.Error("esperava download da imagem na Evolution API")
	}
	if gateway.input.ImageB64 == "" {
		t.Error("esperava ImageB64 entregue à IA")
	}
	if gateway.input.ImageMime != "image/jpeg" {
		t.Errorf("mime esperado image/jpeg, obteve %q", gateway.input.ImageMime)
	}
	if strings.TrimSpace(gateway.input.Text) == "" {
		t.Error("esperava um prompt para a análise da imagem")
	}
	if len(mockClient.sentMessages) == 0 {
		t.Fatal("esperava resposta do Vito no chat")
	}
	last := mockClient.sentMessages[len(mockClient.sentMessages)-1]
	if !strings.Contains(last.Text, "R$ 45,00") {
		t.Errorf("resposta deveria conter a descrição da imagem, obteve: %s", last.Text)
	}
}

// TestWhatsAppService_ImagemComLegenda_UsaALegendaComoPrompt
func TestWhatsAppService_ImagemComLegenda_UsaALegendaComoPrompt(t *testing.T) {
	svc, _, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadImagem("5511999998888@s.whatsapp.net", "msg-img-2", "quanto eu paguei nesse boleto?"))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if !strings.Contains(gateway.input.Text, "quanto eu paguei nesse boleto?") {
		t.Errorf("esperava a legenda como prompt, obteve: %q", gateway.input.Text)
	}
	if gateway.input.ImageB64 == "" {
		t.Error("esperava ImageB64 entregue à IA")
	}
}

// TestWhatsAppService_ImagemEmGrupoSemMencao_NaoProcessaNemBaixa
//
// Blindagem de privacidade: em grupo (e em conversa com terceiro) o Vito só
// responde quando é citado — e não deve nem baixar a mídia antes disso.
func TestWhatsAppService_ImagemEmGrupoSemMencao_NaoProcessaNemBaixa(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadImagem("12036300112233@g.us", "msg-img-3", "olá gente"))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if mockClient.mediaDownloadedCount != 0 {
		t.Error("imagem em grupo sem menção não deveria ser baixada")
	}
	if gateway.input.ImageB64 != "" {
		t.Error("imagem em grupo sem menção não deveria chegar à IA")
	}
	if len(mockClient.sentMessages) != 0 {
		t.Error("imagem em grupo sem menção não deveria gerar resposta")
	}
}

// TestWhatsAppService_ImagemIndisponivel_RespostaHonesta
//
// Sem a imagem, o Vito não pode descrever nada: melhor avisar do que inventar.
func TestWhatsAppService_ImagemIndisponivel_RespostaHonesta(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	// Mídia vazia => download falha.
	mockClient.mockMediaBase64 = ""

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadImagem("5511999998888@s.whatsapp.net", "msg-img-5", ""))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if gateway.input.ImageB64 != "" {
		t.Error("não deveria haver imagem entregue à IA quando o download falha")
	}
	if !strings.Contains(gateway.input.Text, "não consegui baixar a imagem") &&
		!strings.Contains(strings.ToLower(gateway.input.Text), "não foi possível ler a imagem") {
		t.Errorf("esperava prompt honesto sobre a falha do download, obteve: %q", gateway.input.Text)
	}
}

// TestWhatsAppService_ProcessamentoEmBackground
//
// A análise de imagem leva dezenas de segundos: processar dentro do handler
// HTTP estouraria o timeout do webhook da Evolution (que causaria retry e
// processamento duplicado). O trabalho pesado roda em background.
func TestWhatsAppService_ProcessamentoEmBackground(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))

	agendado := false
	executado := false
	svc.SetAsyncRunner(func(fn func()) {
		agendado = true
		// Simula o agendamento: a função ainda NÃO foi executada.
		_ = fn
	})

	err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadImagem("5511999998888@s.whatsapp.net", "msg-img-4", ""))
	if err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if !agendado {
		t.Error("esperava o processamento agendado em background")
	}
	if executado {
		t.Error("o processamento não deveria ter rodado dentro do handler")
	}
	if gateway.input.ImageB64 != "" {
		t.Error("a IA não deveria ser chamada antes do processamento em background")
	}
	_ = mockClient
}
