package whatsapp_test

import (
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"github.com/andrevmp/vito/backend/internal/whatsapp/evolution"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
)

type spyNotifSender struct {
	mu    sync.Mutex
	calls []spyPushCall
}

type spyPushCall struct {
	UserID   string
	Title    string
	Body     string
	Priority string
	Data     map[string]interface{}
}

func (s *spyNotifSender) SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls = append(s.calls, spyPushCall{UserID: userID, Title: title, Body: body, Priority: priority, Data: data})
	return 1, nil
}

func (s *spyNotifSender) Count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.calls)
}

func (s *spyNotifSender) Last() (spyPushCall, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.calls) == 0 {
		return spyPushCall{}, false
	}
	return s.calls[len(s.calls)-1], true
}

type spyAgentEngine struct {
	mu       sync.Mutex
	calls    int
	requests []domain.UnifiedAssistantRequest
	reply    string
}

func (e *spyAgentEngine) Run(ctx context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	e.mu.Lock()
	e.calls++
	e.requests = append(e.requests, req)
	e.mu.Unlock()
	reply := e.reply
	if reply == "" {
		reply = "Oi! Tudo bem por aqui. 🌙 Em que posso ajudar você agora?"
	}
	return &domain.UnifiedAssistantResponse{
		Text:  reply,
		Reply: reply,
		Telemetry: domain.TurnTelemetry{
			ProviderUsed: "adk-test-model",
		},
	}, nil
}

func (e *spyAgentEngine) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, onDelta func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	return e.Run(ctx, req)
}

type recordedEvoHTTPReq struct {
	Path string
	Body map[string]interface{}
}

func newDeliveryTestRepo(instanceName, phone string) *mockWhatsAppRepoForRegression {
	return newMockWhatsAppRepoForRegression(instanceName, phone)
}

func newDeliveryTestService(t *testing.T, handler http.HandlerFunc, instanceName, phone string) (*whatsapp.WhatsAppService, *httptest.Server, *spyNotifSender, *spyAgentEngine) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	evoClient := evolution.NewDefaultEvolutionClient(srv.URL, "test-key", srv.Client())
	repo := newDeliveryTestRepo(instanceName, phone)
	svc := whatsapp.NewWhatsAppService(whatsapp.WhatsAppServiceConfig{}, repo, evoClient)
	svc.SetAsyncRunner(func(fn func()) { fn() })

	notif := &spyNotifSender{}
	svc.SetNotificationSender(notif)

	engine := &spyAgentEngine{}
	svc.SetAgentLoop(engine)

	ownerCache := whatsapp.NewWhatsAppOwnerCache(evoClient, time.Hour)
	ownerCache.Set(instanceName, phone+"@s.whatsapp.net")
	svc.SetOwnerCache(ownerCache)

	groupMeta := whatsapp.NewWhatsAppGroupMeta(evoClient, time.Hour, time.Hour)
	svc.SetGroupMeta(groupMeta)

	return svc, srv, notif, engine
}

func makeUpsertPayload(instance, remoteJID, remoteJIDAlt, participant, msgID, text string, fromMe bool) []byte {
	key := map[string]interface{}{
		"remoteJid": remoteJID,
		"fromMe":    fromMe,
		"id":        msgID,
	}
	if remoteJIDAlt != "" {
		key["remoteJidAlt"] = remoteJIDAlt
	}
	if participant != "" {
		key["participant"] = participant
	}
	b, _ := json.Marshal(map[string]interface{}{
		"event":    "messages.upsert",
		"instance": instance,
		"data": map[string]interface{}{
			"type":             "notify",
			"key":              key,
			"pushName":         "André",
			"messageType":      "conversation",
			"messageTimestamp": time.Now().UTC().Unix(),
			"message": map[string]interface{}{
				"conversation": text,
			},
		},
	})
	return b
}

func TestAC01_NoPushWhenEvolutionSendFails(t *testing.T) {
	svc, _, notif, _ := newDeliveryTestService(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/message/sendText/"):
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"status":400,"error":"Bad Request","response":{"message":[{"exists":false}]}}`))
		case strings.Contains(r.URL.Path, "/message/sendReaction/"):
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"status":"SUCCESS"}`))
		default:
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
		}
	}, "vito_inst", "559884097322")

	payload := makeUpsertPayload("vito_inst", "559884097322@s.whatsapp.net", "", "", "AC01-MSG-1", "@vito ola", true)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook erro inesperado: %v", err)
	}

	if notif.Count() != 0 {
		t.Fatalf("AC-01 violado: esperava 0 pushes quando Evolution sendText falha, obteve %d", notif.Count())
	}
}

func TestAC02_GroupQuotedFallbackToPlainSendText(t *testing.T) {
	var mu sync.Mutex
	var sendTextReqs []map[string]interface{}

	svc, _, notif, _ := newDeliveryTestService(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/group/participants/"):
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"participants":[{"id":"559884097322@s.whatsapp.net"},{"id":"5511999998888@s.whatsapp.net"}]}`))
		case strings.Contains(r.URL.Path, "/message/sendText/"):
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			mu.Lock()
			sendTextReqs = append(sendTextReqs, body)
			mu.Unlock()
			if _, hasQuoted := body["quoted"]; hasQuoted {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"status":400,"error":"quoted_invalid"}`))
				return
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"key":{"id":"OUT-1","remoteJid":"12036300112233@g.us"},"status":"PENDING"}`))
		default:
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
		}
	}, "vito_inst", "559884097322")

	payload := makeUpsertPayload("vito_inst", "12036300112233@g.us", "", "559884097322@s.whatsapp.net", "AC02-MSG-1", "@vito ola grupo", true)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook erro: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if len(sendTextReqs) != 2 {
		t.Fatalf("AC-02 violado: esperava 2 chamadas sendText (1 quoted + 1 fallback sem quoted), obteve %d", len(sendTextReqs))
	}

	quoted, ok := sendTextReqs[0]["quoted"].(map[string]interface{})
	if !ok {
		t.Fatalf("AC-02 violado: primeira tentativa deveria conter objeto quoted")
	}
	qKey, _ := quoted["key"].(map[string]interface{})
	qMsg, _ := quoted["message"].(map[string]interface{})
	if qKey["id"] != "AC02-MSG-1" || qKey["remoteJid"] != "12036300112233@g.us" || qKey["fromMe"] != true {
		t.Fatalf("AC-02 violado: quoted.key incompleto: %+v", qKey)
	}
	if qMsg["conversation"] == nil {
		t.Fatalf("AC-02 violado: quoted.message.conversation ausente: %+v", qMsg)
	}
	if _, hasQuoted := sendTextReqs[1]["quoted"]; hasQuoted {
		t.Fatalf("AC-02 violado: segunda tentativa (fallback) não deve conter quoted")
	}
	if notif.Count() != 1 {
		t.Fatalf("esperava 1 push após entrega em grupo de terceiros, obteve %d", notif.Count())
	}
}

func TestAC03_SelfChatLIDAndBrazil9thDigitRetry(t *testing.T) {
	var mu sync.Mutex
	var numbersSent []string

	svc, _, notif, _ := newDeliveryTestService(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/message/sendText/"):
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			num, _ := body["number"].(string)
			mu.Lock()
			numbersSent = append(numbersSent, num)
			mu.Unlock()
			if num == "559884097322" {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"status":400,"error":"Bad Request","response":{"message":[{"exists":false}]}}`))
				return
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"key":{"id":"OUT-SELF","remoteJid":"5598984097322@s.whatsapp.net"},"status":"PENDING"}`))
		case strings.Contains(r.URL.Path, "/group/participants/"):
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"participants":[{"id":"559884097322@s.whatsapp.net"}]}`))
		default:
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
		}
	}, "vito_inst", "559884097322")

	// Self-chat recebido como @lid com Participant == ""
	payload := makeUpsertPayload("vito_inst", "123456789012345@lid", "", "", "AC03-SELF-1", "@vito ola", true)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook erro: %v", err)
	}

	mu.Lock()
	sentCopy := append([]string(nil), numbersSent...)
	mu.Unlock()

	if len(sentCopy) != 2 {
		t.Fatalf("AC-03 violado: esperava 2 tentativas (12 dígitos + retry 13 dígitos), obteve %v", sentCopy)
	}
	for _, num := range sentCopy {
		if strings.Contains(num, "@lid") || strings.Contains(num, "@s.whatsapp.net") {
			t.Fatalf("AC-03 violado: campo number deve conter apenas E.164 puro em 1-on-1, obteve %q", num)
		}
	}
	if sentCopy[0] != "559884097322" || sentCopy[1] != "5598984097322" {
		t.Fatalf("AC-03 violado: retry 9º dígito esperado [559884097322 5598984097322], obteve %v", sentCopy)
	}

	// Self-group não deve usar copy "Respondeu no grupo:"
	groupPayload := makeUpsertPayload("vito_inst", "12036399999999@g.us", "", "559884097322@s.whatsapp.net", "AC03-SGRP-1", "@vito anotar", true)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", groupPayload); err != nil {
		t.Fatalf("HandleWebhook self_group erro: %v", err)
	}
	if last, ok := notif.Last(); ok && strings.Contains(last.Body, "Respondeu no grupo:") {
		t.Fatalf("AC-03 violado: self_group não pode gerar push 'Respondeu no grupo:', obteve %q", last.Body)
	}
}

type fallbackWhatsAppRepo struct {
	*mockWhatsAppRepoForRegression
}

func (r *fallbackWhatsAppRepo) FindConnectedInstance(ctx context.Context) (*domain.WhatsAppIntegration, error) {
	return r.GetByUserID(ctx, "user-1")
}

func TestAC04_FallbackUpdatesInstanceName(t *testing.T) {
	var usedPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/message/sendText/") {
			usedPath = r.URL.Path
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"key":{"id":"OUT-4","remoteJid":"559884097322@s.whatsapp.net"},"status":"PENDING"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	evoClient := evolution.NewDefaultEvolutionClient(srv.URL, "test-key", srv.Client())
	repo := &fallbackWhatsAppRepo{mockWhatsAppRepoForRegression: newDeliveryTestRepo("vito_inst_real", "559884097322")}
	svc := whatsapp.NewWhatsAppService(whatsapp.WhatsAppServiceConfig{}, repo, evoClient)
	svc.SetAsyncRunner(func(fn func()) { fn() })
	svc.SetAgentLoop(&spyAgentEngine{})
	ownerCache := whatsapp.NewWhatsAppOwnerCache(evoClient, time.Hour)
	ownerCache.Set("vito_inst_real", "559884097322@s.whatsapp.net")
	svc.SetOwnerCache(ownerCache)

	// Envia webhook com nome de instância antigo/desatualizado
	payload := makeUpsertPayload("vito_inst_antiga", "559884097322@s.whatsapp.net", "", "", "AC04-MSG-1", "@vito ola", true)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook erro: %v", err)
	}
	if !strings.HasSuffix(usedPath, "/message/sendText/vito_inst_real") {
		t.Fatalf("AC-04 violado: esperava sendText na instância atualizada 'vito_inst_real', obteve path %q", usedPath)
	}
}

func TestAC05_ConcurrentDuplicateWebhooksSingleReply(t *testing.T) {
	var sendCalls atomic.Int32
	svc, _, _, engine := newDeliveryTestService(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/message/sendText/") {
			sendCalls.Add(1)
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"key":{"id":"OUT-5","remoteJid":"559884097322@s.whatsapp.net"},"status":"PENDING"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}, "vito_inst", "559884097322")

	payload := makeUpsertPayload("vito_inst", "559884097322@s.whatsapp.net", "", "", "AC05-DUP-1", "@vito ping", true)
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = svc.HandleWebhook(context.Background(), "messages.upsert", payload)
		}()
	}
	wg.Wait()

	engine.mu.Lock()
	aiCalls := engine.calls
	engine.mu.Unlock()
	if aiCalls != 1 {
		t.Fatalf("AC-05 violado: esperava 1 execução da IA para 4 webhooks concorrentes, obteve %d", aiCalls)
	}
	if got := sendCalls.Load(); got != 1 {
		t.Fatalf("AC-05 violado: esperava 1 envio no WhatsApp, obteve %d", got)
	}
}

func TestAC06_ReactionFromMeUTF8AndSingleTurnPersist(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("database.Open falhou: %v", err)
	}
	defer db.Close()

	convRepo := repository.NewConversationStoreRepository(db)
	userRepo := repository.NewUserRepository(db)
	user := &domain.User{ID: "user-1", Name: "André", Email: "andre@vito.local", PasswordHash: "x"}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("userRepo.Create erro: %v", err)
	}

	var reactionFromMe *bool
	svc, _, notif, engine := newDeliveryTestService(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/group/participants/"):
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"participants":[{"id":"559884097322@s.whatsapp.net"},{"id":"5511999998888@s.whatsapp.net"}]}`))
		case strings.Contains(r.URL.Path, "/message/sendReaction/"):
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			if k, ok := body["key"].(map[string]interface{}); ok {
				if fm, ok := k["fromMe"].(bool); ok {
					reactionFromMe = &fm
				}
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"status":"SUCCESS"}`))
		case strings.Contains(r.URL.Path, "/message/sendText/"):
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"key":{"id":"OUT-6","remoteJid":"12036300112233@g.us"},"status":"PENDING"}`))
		default:
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
		}
	}, "vito_inst", "559884097322")

	svc.SetConversationBridge(whatsapp.NewWhatsAppConversationBridge(convRepo))
	engine.reply = strings.Repeat("Oi! Tudo bem por aqui! 🌙😊 ", 10)

	payload := makeUpsertPayload("vito_inst", "12036300112233@g.us", "", "559884097322@s.whatsapp.net", "AC06-MSG-1", "@vito testar", true)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", payload); err != nil {
		t.Fatalf("HandleWebhook erro: %v", err)
	}

	if reactionFromMe == nil || !*reactionFromMe {
		t.Fatalf("AC-06 violado: SendReaction deveria enviar fromMe=true quando msg.FromMe=true")
	}
	if last, ok := notif.Last(); !ok || !utf8.ValidString(last.Body) {
		t.Fatalf("AC-06 violado: body do push não é UTF-8 válido: %q", last.Body)
	}

	thread, err := convRepo.GetOrCreateThread(context.Background(), "user-1", "whatsapp", "12036300112233@g.us")
	if err != nil {
		t.Fatalf("GetOrCreateThread erro: %v", err)
	}
	turns, err := convRepo.ListTurnsByThread(context.Background(), thread.ID, 10)
	if err != nil {
		t.Fatalf("ListTurnsByThread erro: %v", err)
	}
	if len(turns) != 0 {
		t.Fatalf("AC-06 violado: WhatsAppService não deve gravar turnos duplicados em conversation_turns quando agentLoop != nil, obteve %d", len(turns))
	}
}

func TestAC07_DirectPrivateChatDeliveryAndIsolation(t *testing.T) {
	var mu sync.Mutex
	var numbersSent []string

	svc, _, _, _ := newDeliveryTestService(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/message/sendText/") {
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			num, _ := body["number"].(string)
			mu.Lock()
			numbersSent = append(numbersSent, num)
			mu.Unlock()
			if num == "5511999998888" {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"status":400,"error":"Bad Request","response":{"message":[{"exists":false}]}}`))
				return
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"key":{"id":"OUT-7","remoteJid":"551199998888@s.whatsapp.net"},"status":"PENDING"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}, "vito_inst", "559884097322")

	// 1. Mensagem com remoteJid @lid + remoteJidAlt aprende o mapeamento LID->PN
	firstPayload := makeUpsertPayload("vito_inst", "999888777666@lid", "5511999998888@s.whatsapp.net", "", "AC07-LEARN-1", "oi", false)
	_ = svc.HandleWebhook(context.Background(), "messages.upsert", firstPayload)

	// 2. Dono chama @vito no chat privado @lid (desta vez sem remoteJidAlt)
	ownerCallPayload := makeUpsertPayload("vito_inst", "999888777666@lid", "", "", "AC07-CALL-1", "@vito responde aqui", true)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", ownerCallPayload); err != nil {
		t.Fatalf("HandleWebhook direct erro: %v", err)
	}

	// 3. Terceiro chama @vito no mesmo chat privado -> recusa educada vai para o contato, nunca para o dono
	thirdPartyPayload := makeUpsertPayload("vito_inst", "999888777666@lid", "", "", "AC07-THIRD-1", "@vito cria evento", false)
	if err := svc.HandleWebhook(context.Background(), "messages.upsert", thirdPartyPayload); err != nil {
		t.Fatalf("HandleWebhook direct terceiro erro: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if len(numbersSent) < 3 {
		t.Fatalf("AC-07 violado: esperava envios para o contato (com retry 9º dígito + recusa), obteve %v", numbersSent)
	}
	for _, n := range numbersSent {
		if n == "559884097322" || strings.Contains(n, "@lid") {
			t.Fatalf("AC-07 violado: nunca deve enviar para o dono nem @lid em direct, obteve %q", n)
		}
	}
}
