package service_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// TestWhatsApp_ExplicitTriggerRequiredInAllChats reproduz exatamente o caso relatado:
// No grupo consigo mesmo (self_group) ou qualquer chat do WhatsApp, o Vito NUNCA deve
// ser ativado sem marcação explícita (@vito, /vito, !vito).
func TestWhatsApp_ExplicitTriggerRequiredInAllChats(t *testing.T) {
	svc, mockClient, waRepo, _ := setupConversationalWhatsAppTest(t)
	ctx := context.Background()

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	selfGroupJID := "12036399999999@g.us"
	groupMeta := service.NewWhatsAppGroupMeta(mockClient, time.Hour, 24*time.Hour)
	groupMeta.SetParticipants(selfGroupJID, 1) // 1 participante = grupo consigo mesmo
	svc.SetGroupMeta(groupMeta)

	// Casos que NÃO devem ativar o Vito em hipótese alguma
	cenariosIgnorados := []struct {
		nome  string
		jid   string
		texto string
	}{
		{
			nome:  "Link do Twitter/X no grupo consigo mesmo",
			jid:   selfGroupJID,
			texto: "https://x.com/LunarResearcher/status/2116522516915028254?a=dQOayidTyGuM7Cdf34s&s=08",
		},
		{
			nome:  "Outro link do X",
			jid:   selfGroupJID,
			texto: "https://x.com/m4lkxx/status/2114338456750997922?a=92vHgGPS4OoqaQGli0w&s=08",
		},
		{
			nome:  "Nota pessoal / relato de bug no grupo",
			jid:   selfGroupJID,
			texto: "No modo conversacao quando peço uma pesquisa ele fala comando executado mas n me mostra o resultado e sai",
		},
		{
			nome:  "Chamada natural sem prefixo no grupo",
			jid:   selfGroupJID,
			texto: "Vito me ajuda com uma anotação",
		},
		{
			nome:  "Saudação comum sem prefixo",
			jid:   selfGroupJID,
			texto: "Oi Vito bom dia",
		},
		{
			nome:  "Email contendo palavra vito",
			jid:   selfGroupJID,
			texto: "meu email é andre@vito.com para contato",
		},
		{
			nome:  "Palavra similar sem ser vito",
			jid:   selfGroupJID,
			texto: "@vitor você viu isso?",
		},
		{
			nome:  "Link no chat 'Você' (self)",
			jid:   "5511999998888@s.whatsapp.net",
			texto: "https://x.com/post/12345",
		},
		{
			nome:  "Pensamento solto no chat 'Você'",
			jid:   "5511999998888@s.whatsapp.net",
			texto: "comprar pão e leite mais tarde",
		},
	}

	for i, tc := range cenariosIgnorados {
		mockClient.sentMessages = nil
		mockClient.sentReactions = nil

		payload := map[string]interface{}{
			"event":    "messages.upsert",
			"instance": "vito_conv_user",
			"data": map[string]interface{}{
				"key": map[string]interface{}{
					"remoteJid": tc.jid,
					"fromMe":    true,
					"id":        "msg-ignora-" + string(rune('a'+i)),
				},
				"messageType": "conversation",
				"message":     map[string]interface{}{"conversation": tc.texto},
			},
		}
		bytesPayload, _ := json.Marshal(payload)
		if err := svc.HandleWebhook(ctx, "messages.upsert", bytesPayload); err != nil {
			t.Fatalf("[%s] HandleWebhook falhou: %v", tc.nome, err)
		}

		if len(mockClient.sentMessages) != 0 {
			t.Fatalf("[%s] Vito NÃO deveria responder, mas enviou: %q", tc.nome, mockClient.sentMessages[0].Text)
		}
		if len(mockClient.sentReactions) != 0 {
			t.Fatalf("[%s] Vito NÃO deveria enviar reações, mas enviou: %+v", tc.nome, mockClient.sentReactions[0])
		}
	}

	// Casos que DEVEM ativar o Vito com sucesso (@vito, /vito, !vito)
	cenariosAtivados := []struct {
		nome            string
		jid             string
		texto           string
		esperadoNaIA    string
	}{
		{
			nome:         "Prefixo @vito no grupo consigo mesmo",
			jid:          selfGroupJID,
			texto:        "@vito criar evento Dentista amanhã às 14h",
			esperadoNaIA: "criar evento Dentista amanhã às 14h",
		},
		{
			nome:         "Prefixo /vito no grupo consigo mesmo",
			jid:          selfGroupJID,
			texto:        "/vito me lembra de ligar pro banco",
			esperadoNaIA: "me lembra de ligar pro banco",
		},
		{
			nome:         "Prefixo !vito no grupo consigo mesmo",
			jid:          selfGroupJID,
			texto:        "!vito resumo do dia",
			esperadoNaIA: "resumo do dia",
		},
		{
			nome:         "Prefixo @Vito maiúsculo com dois pontos",
			jid:          selfGroupJID,
			texto:        "@Vito: agendar reunião com time",
			esperadoNaIA: "agendar reunião com time",
		},
		{
			nome:         "Prefixo /VITO em caixa alta",
			jid:          selfGroupJID,
			texto:        "/VITO status",
			esperadoNaIA: "status",
		},
		{
			nome:         "Prefixo @vito no meio da frase",
			jid:          selfGroupJID,
			texto:        "olha esse link @vito resuma para mim",
			esperadoNaIA: "olha esse link resuma para mim",
		},
		{
			nome:         "Apenas @vito",
			jid:          selfGroupJID,
			texto:        "@vito",
			esperadoNaIA: "olá",
		},
		{
			nome:         "Prefixo @vito no chat 'Você' (self)",
			jid:          "5511999998888@s.whatsapp.net",
			texto:        "@vito o que tenho hoje?",
			esperadoNaIA: "o que tenho hoje?",
		},
	}

	// Garante integração válida no repo
	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-test",
		UserID:       "user-conv-1",
		InstanceName: "vito_conv_user",
		Phone:        "5511999998888",
		Status:       domain.WhatsAppStatusConnected,
	})

	for i, tc := range cenariosAtivados {
		mockClient.sentMessages = nil
		mockClient.sentReactions = nil
		gateway.input.Text = ""

		msgID := "msg-ativa-" + string(rune('a'+i))
		payload := map[string]interface{}{
			"event":    "messages.upsert",
			"instance": "vito_conv_user",
			"data": map[string]interface{}{
				"key": map[string]interface{}{
					"remoteJid": tc.jid,
					"fromMe":    true,
					"id":        msgID,
				},
				"messageType": "conversation",
				"message":     map[string]interface{}{"conversation": tc.texto},
			},
		}
		bytesPayload, _ := json.Marshal(payload)
		if err := svc.HandleWebhook(ctx, "messages.upsert", bytesPayload); err != nil {
			t.Fatalf("[%s] HandleWebhook falhou: %v", tc.nome, err)
		}

		if len(mockClient.sentMessages) != 1 {
			t.Fatalf("[%s] esperava 1 resposta do Vito, obteve %d", tc.nome, len(mockClient.sentMessages))
		}
		if gateway.input.Text != tc.esperadoNaIA {
			t.Errorf("[%s] texto enviado à IA: obteve %q, esperava %q", tc.nome, gateway.input.Text, tc.esperadoNaIA)
		}
		if len(mockClient.sentReactions) != 1 || mockClient.sentReactions[0].Reaction != "👀" {
			t.Errorf("[%s] esperava reação 👀 para a mensagem ativada", tc.nome)
		}
	}
}
