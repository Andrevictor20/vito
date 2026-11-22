package handler_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/catalog"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type stubBotRunner struct{}

func (s *stubBotRunner) RunBotNow(_ context.Context, _, _ string) (*domain.BotRunReport, error) {
	return &domain.BotRunReport{
		Summary:  "Verificado sem novidades",
		Verified: []string{"agenda"},
		Did:      []string{},
		Waiting:  []string{},
		Cant:     []string{},
	}, nil
}

type stubBotChat struct {
	msgs []handler.BotChatMessageDTO
}

func (s *stubBotChat) GetMessages(_ context.Context, _, _ string) ([]handler.BotChatMessageDTO, error) {
	return s.msgs, nil
}

func (s *stubBotChat) SendMessage(_ context.Context, _, _, msg string) (*handler.BotChatMessageDTO, error) {
	s.msgs = append(s.msgs, handler.BotChatMessageDTO{ID: "u1", Role: "user", Content: msg, CreatedAt: time.Now().UTC().Format(time.RFC3339)})
	reply := handler.BotChatMessageDTO{ID: "a1", Role: "assistant", Content: "Entendido: " + msg, CreatedAt: time.Now().UTC().Format(time.RFC3339)}
	s.msgs = append(s.msgs, reply)
	return &reply, nil
}

func setupBotHandlerTest(t *testing.T) (*sql.DB, *handler.BotHandler, *service.ConfirmationGateService, *repository.BotRepositorySQLite, string) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "bot_handler_test.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-bot-test-1"
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, 'Teste', 'bot@vito.test', 'hash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, userID)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	cat, err := catalog.LoadDefaultCatalog()
	if err != nil {
		t.Fatalf("LoadDefaultCatalog: %v", err)
	}
	botRepo := repository.NewBotRepository(db)
	confGate := service.NewConfirmationGateService(db)
	h := handler.NewBotHandler(db, botRepo, cat)
	h.SetBotRunner(&stubBotRunner{})
	h.SetBotChatService(&stubBotChat{})
	h.SetConfirmationGate(confGate)
	return db, h, confGate, botRepo, userID
}

func doBotReq(t *testing.T, r chi.Router, userID, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func mountBotRoutes(h *handler.BotHandler) chi.Router {
	r := chi.NewRouter()
	r.Route("/api/v1/bots", func(br chi.Router) {
		br.Get("/", h.ListBots)
		br.Post("/", h.CreateBot)
		br.Get("/activity", h.GetActivity)
		br.Get("/catalog/templates", h.ListCatalogTemplates)
		br.Get("/catalog/skills", h.ListCatalogSkills)
		br.Get("/apps", h.ListApps)
		br.Post("/apps/suggest", h.SuggestApp)
		br.Route("/{id}", func(bir chi.Router) {
			bir.Get("/", h.GetBot)
			bir.Patch("/", h.UpdateBot)
			bir.Delete("/", h.DeleteBot)
			bir.Post("/run", h.RunBot)
			bir.Get("/chat", h.GetBotChat)
			bir.Post("/chat", h.SendBotChat)
			bir.Patch("/model", h.UpdateBotModelPref)
			bir.Post("/actions", h.AddAction)
			bir.Patch("/actions/{actionKey}", h.UpdateAction)
			bir.Delete("/actions/{actionKey}", h.RemoveAction)
			bir.Post("/skills", h.AddSkill)
			bir.Delete("/skills/{skillKey}", h.RemoveSkill)
			bir.Post("/skills/{skillKey}/upgrade", h.UpgradeSkill)
			bir.Get("/memories", h.ListMemories)
			bir.Post("/memories", h.AddMemory)
			bir.Delete("/memories/{memId}", h.DeleteMemory)
			bir.Post("/pending/{confirmationId}/resolve", h.ResolvePending)
		})
	})
	return r
}

func TestBotHandler_CRUD_Catalog_Skills_Actions_AC03_AC09_AC10(t *testing.T) {
	_, h, _, _, userID := setupBotHandlerTest(t)
	r := mountBotRoutes(h)

	// Catálogo: templates, skills, apps
	if rec := doBotReq(t, r, userID, http.MethodGet, "/api/v1/bots/catalog/templates", nil); rec.Code != http.StatusOK {
		t.Fatalf("templates status = %d", rec.Code)
	}
	if rec := doBotReq(t, r, userID, http.MethodGet, "/api/v1/bots/catalog/skills", nil); rec.Code != http.StatusOK {
		t.Fatalf("skills status = %d", rec.Code)
	}
	if rec := doBotReq(t, r, userID, http.MethodGet, "/api/v1/bots/apps", nil); rec.Code != http.StatusOK {
		t.Fatalf("apps status = %d", rec.Code)
	}
	if rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/apps/suggest", map[string]string{"name": "Notion", "reason": "Notas"}); rec.Code != http.StatusCreated {
		t.Fatalf("suggest status = %d", rec.Code)
	}

	// AC-09: Criar bot pronto fan_on_duty
	rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots", map[string]string{"template_key": "fan_on_duty"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create template bot = %d: %s", rec.Code, rec.Body.String())
	}
	var created handler.BotResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if created.ID == "" || len(created.Skills) < 2 {
		t.Fatalf("bot criado inválido: %+v", created)
	}

	// Listar bots
	if rec := doBotReq(t, r, userID, http.MethodGet, "/api/v1/bots", nil); rec.Code != http.StatusOK {
		t.Fatalf("list bots = %d", rec.Code)
	}

	// AC-03: Adicionar wasend com auto deve falhar (422)
	if rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/"+created.ID+"/actions", map[string]string{"action_key": "wasend", "policy": "auto"}); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("wasend auto deveria falhar com 422, obteve %d: %s", rec.Code, rec.Body.String())
	}
	// Adicionar wasend com ask deve funcionar
	if rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/"+created.ID+"/actions", map[string]string{"action_key": "wasend", "policy": "ask"}); rec.Code != http.StatusOK {
		t.Fatalf("wasend ask = %d: %s", rec.Code, rec.Body.String())
	}
	// AC-03: PATCH wasend para auto deve falhar
	if rec := doBotReq(t, r, userID, http.MethodPatch, "/api/v1/bots/"+created.ID+"/actions/wasend", map[string]string{"policy": "auto"}); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("PATCH wasend auto deveria falhar com 422, obteve %d", rec.Code)
	}

	// AC-10: Adicionar skill inv e depois remover mantendo ações
	if rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/"+created.ID+"/skills", map[string]string{"skill_key": "inv"}); rec.Code != http.StatusOK {
		t.Fatalf("add skill inv = %d: %s", rec.Code, rec.Body.String())
	}
	delRec := doBotReq(t, r, userID, http.MethodDelete, "/api/v1/bots/"+created.ID+"/skills/inv", nil)
	if delRec.Code != http.StatusOK {
		t.Fatalf("remove skill inv = %d: %s", delRec.Code, delRec.Body.String())
	}
	var afterRemove handler.BotResponse
	_ = json.Unmarshal(delRec.Body.Bytes(), &afterRemove)
	hasMailr := false
	for _, a := range afterRemove.Actions {
		if a.ActionKey == "mailr" {
			hasMailr = true
		}
	}
	if !hasMailr {
		t.Fatalf("AC-10 violado: ação mailr deveria permanecer após remover skill inv (actions=%+v)", afterRemove.Actions)
	}

	// Memórias do bot (AC-05)
	memRec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/"+created.ID+"/memories", map[string]string{"content": "prefiro voos diretos pela manhã"})
	if memRec.Code != http.StatusCreated {
		t.Fatalf("add memory = %d", memRec.Code)
	}
	var mem domain.BotMemory
	_ = json.Unmarshal(memRec.Body.Bytes(), &mem)
	if rec := doBotReq(t, r, userID, http.MethodGet, "/api/v1/bots/"+created.ID+"/memories", nil); rec.Code != http.StatusOK {
		t.Fatalf("list memories = %d", rec.Code)
	}
	if rec := doBotReq(t, r, userID, http.MethodDelete, "/api/v1/bots/"+created.ID+"/memories/"+mem.ID, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("delete memory = %d", rec.Code)
	}

	// Run & Chat & Model & Activity
	if rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/"+created.ID+"/run", nil); rec.Code != http.StatusOK {
		t.Fatalf("run bot = %d", rec.Code)
	}
	if rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/"+created.ID+"/chat", map[string]string{"message": "oi"}); rec.Code != http.StatusOK {
		t.Fatalf("send chat = %d", rec.Code)
	}
	if rec := doBotReq(t, r, userID, http.MethodGet, "/api/v1/bots/"+created.ID+"/chat", nil); rec.Code != http.StatusOK {
		t.Fatalf("get chat = %d", rec.Code)
	}
	if rec := doBotReq(t, r, userID, http.MethodPatch, "/api/v1/bots/"+created.ID+"/model", map[string]string{"model_pref": "openai:gpt-4o", "effort_pref": "low"}); rec.Code != http.StatusOK {
		t.Fatalf("update model = %d", rec.Code)
	}
	if rec := doBotReq(t, r, userID, http.MethodGet, "/api/v1/bots/activity?limit=10", nil); rec.Code != http.StatusOK {
		t.Fatalf("activity = %d", rec.Code)
	}

	// Delete bot
	if rec := doBotReq(t, r, userID, http.MethodDelete, "/api/v1/bots/"+created.ID, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("delete bot = %d", rec.Code)
	}
}

func TestBotHandler_ResolvePending_AC02_AC03(t *testing.T) {
	db, h, confGate, botRepo, userID := setupBotHandlerTest(t)
	r := mountBotRoutes(h)

	convRepo := repository.NewConversationStoreRepository(db)
	th, err := convRepo.GetOrCreateThread(context.Background(), userID, "bot", "bot-thread-1")
	if err != nil {
		t.Fatalf("GetOrCreateThread: %v", err)
	}

	bot := &domain.Bot{
		UserID:   userID,
		Title:    "Bot Gate",
		Goal:     "Testar gate",
		ThreadID: th.ID,
		Actions: []domain.BotAction{
			{ActionKey: "evt", Policy: domain.ActionPolicyAsk},
			{ActionKey: "wasend", Policy: domain.ActionPolicyAsk},
		},
	}
	if err := botRepo.Create(context.Background(), bot); err != nil {
		t.Fatalf("botRepo.Create: %v", err)
	}

	// Pendência evt -> always_allow deve promover evt para auto (AC-02)
	pendEvt, err := confGate.CreatePending(context.Background(), &service.CreatePendingRequest{
		UserID: userID, ThreadID: th.ID, Channel: "bot",
		ToolsetName: "calendar_manager", Operation: "create_event",
		ArgumentsJSON: `{"title":"Jogo"}`, PreviewJSON: `{"summary":"Criar evento Jogo"}`,
		IdempotencyKey: "k-evt-1",
	})
	if err != nil {
		t.Fatalf("CreatePending evt: %v", err)
	}
	if rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/"+bot.ID+"/pending/"+pendEvt.ID+"/resolve", map[string]string{"decision": "always_allow"}); rec.Code != http.StatusOK {
		t.Fatalf("resolve evt always_allow = %d: %s", rec.Code, rec.Body.String())
	}
	updated, _ := botRepo.GetByID(context.Background(), bot.ID, userID)
	for _, a := range updated.Actions {
		if a.ActionKey == "evt" && a.Policy != domain.ActionPolicyAuto {
			t.Fatalf("AC-02 violado: evt deveria ter virado auto, está %s", a.Policy)
		}
	}

	// Pendência wasend -> always_allow deve ser recusado com 422 (AC-03)
	pendWa, err := confGate.CreatePending(context.Background(), &service.CreatePendingRequest{
		UserID: userID, ThreadID: th.ID, Channel: "bot",
		ToolsetName: "whatsapp_assistant", Operation: "send_message",
		ArgumentsJSON: `{"to":"123"}`, PreviewJSON: `{"summary":"Enviar WhatsApp"}`,
		IdempotencyKey: "k-wa-1",
	})
	if err != nil {
		t.Fatalf("CreatePending wa: %v", err)
	}
	if rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/"+bot.ID+"/pending/"+pendWa.ID+"/resolve", map[string]string{"decision": "always_allow"}); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("AC-03 violado: always_allow em wasend deveria retornar 422, obteve %d: %s", rec.Code, rec.Body.String())
	}
	// allow_once em wasend deve funcionar
	if rec := doBotReq(t, r, userID, http.MethodPost, "/api/v1/bots/"+bot.ID+"/pending/"+pendWa.ID+"/resolve", map[string]string{"decision": "allow_once"}); rec.Code != http.StatusOK {
		t.Fatalf("allow_once em wasend = %d: %s", rec.Code, rec.Body.String())
	}
}
