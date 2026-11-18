package service_test

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type slowCountingGateway struct {
	delay      time.Duration
	calls      atomic.Int32
	inFlight   atomic.Int32
	maxInFlight atomic.Int32
	doneCh     chan struct{}
}

func (g *slowCountingGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	cur := g.inFlight.Add(1)
	for {
		prev := g.maxInFlight.Load()
		if cur <= prev || g.maxInFlight.CompareAndSwap(prev, cur) {
			break
		}
	}
	defer g.inFlight.Add(-1)

	if g.delay > 0 {
		select {
		case <-time.After(g.delay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	g.calls.Add(1)
	if g.doneCh != nil {
		select {
		case g.doneCh <- struct{}{}:
		default:
		}
	}
	return &ai.ParsedIntent{
		Action:  ai.ActionGeneralChat,
		Message: "Respondido!",
	}, nil
}

func TestHandleWebhook_IgnoresMessagesUpdateAndDelete(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)
	gw := &slowCountingGateway{}
	svc.SetAssistantService(service.NewAssistantService(gw, nil, nil, nil))

	for _, ev := range []string{"messages.update", "messages_update", "messages.delete", "messages.set"} {
		payload, _ := json.Marshal(map[string]any{
			"event":    ev,
			"instance": "vito_conv_user",
			"data": map[string]any{
				"key": map[string]any{
					"remoteJid": "5511999998888@s.whatsapp.net",
					"fromMe":    true,
					"id":        "ack-" + ev,
				},
				"message": map[string]any{"conversation": "@vito teste"},
			},
		})
		if err := svc.HandleWebhook(context.Background(), ev, payload); err != nil {
			t.Fatalf("HandleWebhook(%s) retornou erro: %v", ev, err)
		}
	}

	if gw.calls.Load() != 0 {
		t.Errorf("esperava 0 chamadas à IA para messages.update/delete, obteve %d", gw.calls.Load())
	}
	if len(mockClient.sentMessages) != 0 {
		t.Errorf("esperava 0 envios para messages.update/delete, obteve %d", len(mockClient.sentMessages))
	}
}

func TestHandleWebhook_ProcessesAllMessagesInBatchArray(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)
	gw := &slowCountingGateway{}
	svc.SetAssistantService(service.NewAssistantService(gw, nil, nil, nil))

	nowUnix := time.Now().UTC().Unix()
	payload, _ := json.Marshal(map[string]any{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]any{
			"type": "notify",
			"messages": []map[string]any{
				{
					"key": map[string]any{
						"remoteJid": "5511999998888@s.whatsapp.net",
						"fromMe":    true,
						"id":        "batch-msg-1",
					},
					"messageTimestamp": nowUnix,
					"message":          map[string]any{"conversation": "@vito primeira"},
				},
				{
					"key": map[string]any{
						"remoteJid": "5511999998888@s.whatsapp.net",
						"fromMe":    true,
						"id":        "batch-msg-2",
					},
					"messageTimestamp": nowUnix,
					"message":          map[string]any{"conversation": "@vito segunda"},
				},
			},
		},
	})

	if err := svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}
	if gw.calls.Load() != 2 {
		t.Fatalf("esperava 2 chamadas à IA para o lote com 2 mensagens, obteve %d", gw.calls.Load())
	}
	if len(mockClient.sentMessages) != 2 {
		t.Fatalf("esperava 2 respostas enviadas, obteve %d", len(mockClient.sentMessages))
	}
}

func TestHandleWebhook_SkipsStaleAndAppendReplayAfterPowerLoss(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)
	gw := &slowCountingGateway{}
	svc.SetAssistantService(service.NewAssistantService(gw, nil, nil, nil))
	tr := &simpleTranscriber{transcribedText: "@vito áudio antigo"}
	svc.SetAudioTranscriber(tr)

	twoHoursAgo := time.Now().UTC().Add(-2 * time.Hour).Unix()

	// 1. Áudio antigo (2h atrás, pós-queda): não pode chamar Whisper, nem 👀, nem IA.
	oldAudioPayload, _ := json.Marshal(map[string]any{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]any{
			"key": map[string]any{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    true,
				"id":        "stale-audio-1",
			},
			"messageType":      "audioMessage",
			"messageTimestamp": twoHoursAgo,
			"message":          map[string]any{"audioMessage": map[string]any{"mimetype": "audio/ogg"}},
		},
	})
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", oldAudioPayload); err != nil {
		t.Fatalf("HandleWebhook áudio antigo erro: %v", err)
	}
	if tr.called {
		t.Error("áudio antigo (2h) não deveria disparar transcrição Whisper no caminho quente")
	}

	// 2. Mensagem de texto marcada como type: "append" (sync de histórico): arquiva sem responder.
	appendPayload, _ := json.Marshal(map[string]any{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]any{
			"type": "append",
			"messages": []map[string]any{
				{
					"key": map[string]any{
						"remoteJid": "5511999998888@s.whatsapp.net",
						"fromMe":    true,
						"id":        "append-msg-1",
					},
					"messageTimestamp": time.Now().UTC().Unix(),
					"message":          map[string]any{"conversation": "@vito histórico"},
				},
			},
		},
	})
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", appendPayload); err != nil {
		t.Fatalf("HandleWebhook append erro: %v", err)
	}
	archived, err := svc.ContextMessageByID(context.Background(), "user-conv-1", "append-msg-1")
	if err != nil || archived == nil {
		t.Fatalf("mensagem append deveria continuar arquivada para contexto, err=%v", err)
	}

	// 3. Mensagem antiga de texto (2h atrás) com @vito: arquiva sem IA/reação.
	staleTextPayload, _ := json.Marshal(map[string]any{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]any{
			"key": map[string]any{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    true,
				"id":        "stale-text-1",
			},
			"messageTimestamp": twoHoursAgo,
			"message":          map[string]any{"conversation": "@vito comando antigo"},
		},
	})
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", staleTextPayload); err != nil {
		t.Fatalf("HandleWebhook texto antigo erro: %v", err)
	}

	if gw.calls.Load() != 0 {
		t.Errorf("nenhuma mensagem antiga/append deveria acionar a IA, obteve %d chamadas", gw.calls.Load())
	}
	if len(mockClient.sentReactions) != 0 {
		t.Errorf("mensagens antigas/append não deveriam receber reação 👀, obteve %d", len(mockClient.sentReactions))
	}
	if len(mockClient.sentMessages) != 0 {
		t.Errorf("mensagens antigas/append não deveriam gerar resposta, obteve %d", len(mockClient.sentMessages))
	}

	// 4. Mensagem já arquivada anteriormente no banco (>2m) não é reprocessada mesmo sem cache em RAM.
	if err := svc.ContextSvcForTest().Archive(context.Background(), &domain.WhatsAppConversationMessage{
		ID:               "already-db-1",
		UserID:           "user-conv-1",
		InstanceName:     "vito_conv_user",
		ChatJID:          "5511999998888@s.whatsapp.net",
		ChatKind:         domain.WhatsAppChatKindSelf,
		Kind:             "text",
		Text:             "já processada antes do crash",
		MessageTimestamp: time.Now().UTC().Add(-4 * time.Minute),
		CreatedAt:        time.Now().UTC().Add(-4 * time.Minute),
	}); err != nil {
		t.Fatalf("Archive erro: %v", err)
	}
	replayDBPayload, _ := json.Marshal(map[string]any{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]any{
			"key": map[string]any{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    true,
				"id":        "already-db-1",
			},
			"messageTimestamp": time.Now().UTC().Add(-4 * time.Minute).Unix(),
			"message":          map[string]any{"conversation": "@vito já processada antes do crash"},
		},
	})
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", replayDBPayload); err != nil {
		t.Fatalf("HandleWebhook replay DB erro: %v", err)
	}
	if gw.calls.Load() != 0 {
		t.Errorf("replay de mensagem já existente no banco não deveria acionar a IA")
	}

	// 5. Mensagem recente (30s atrás) com @vito DEVE responder normalmente.
	freshPayload, _ := json.Marshal(map[string]any{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]any{
			"key": map[string]any{
				"remoteJid": "5511999998888@s.whatsapp.net",
				"fromMe":    true,
				"id":        "fresh-msg-1",
			},
			"messageTimestamp": time.Now().UTC().Add(-30 * time.Second).Unix(),
			"message":          map[string]any{"conversation": "@vito bom dia"},
		},
	})
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", freshPayload); err != nil {
		t.Fatalf("HandleWebhook mensagem recente erro: %v", err)
	}
	if gw.calls.Load() != 1 || len(mockClient.sentMessages) != 1 {
		t.Errorf("mensagem recente deveria acionar IA e responder 1 vez (calls=%d, sent=%d)",
			gw.calls.Load(), len(mockClient.sentMessages))
	}
}

func TestHandleWebhook_FastAckAndBoundedConcurrency(t *testing.T) {
	svc, _, waRepo, _ := setupConversationalWhatsAppTest(t)
	_ = waRepo
	// Cria nova instância para usar o runner assíncrono padrão (sem override síncrono).
	mockClient := &mockExtendedEvolutionClient{mockState: "open"}
	gw := &slowCountingGateway{
		delay:  80 * time.Millisecond,
		doneCh: make(chan struct{}, 20),
	}
	astSvc := service.NewAssistantService(gw, nil, nil, nil)
	asyncSvc := service.NewWhatsAppService(service.WhatsAppServiceConfig{}, waRepo, mockClient, astSvc)

	start := time.Now()
	const total = 10
	for i := 0; i < total; i++ {
		payload, _ := json.Marshal(map[string]any{
			"event":    "messages.upsert",
			"instance": "vito_conv_user",
			"data": map[string]any{
				"key": map[string]any{
					"remoteJid": "5511999998888@s.whatsapp.net",
					"fromMe":    true,
					"id":        "async-burst-" + string(rune('a'+i)),
				},
				"messageTimestamp": time.Now().UTC().Unix(),
				"message":          map[string]any{"conversation": "@vito ping"},
			},
		})
		if err := asyncSvc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
			t.Fatalf("HandleWebhook falhou: %v", err)
		}
	}
	// Todos os 10 webhooks devem retornar em muito menos que 80ms (não bloqueiam na IA).
	if elapsed := time.Since(start); elapsed > 60*time.Millisecond {
		t.Errorf("HandleWebhook deveria fazer ack imediato sem bloquear na IA, levou %s", elapsed)
	}

	deadline := time.After(5 * time.Second)
	for gw.calls.Load() < total {
		select {
		case <-gw.doneCh:
		case <-deadline:
			t.Fatalf("timeout aguardando processamento assíncrono (%d/%d concluídos)", gw.calls.Load(), total)
		}
	}
	if max := gw.maxInFlight.Load(); max > 4 {
		t.Errorf("concorrência máxima esperada <= 4, obteve %d", max)
	}
	_ = svc
}
