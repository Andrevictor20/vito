package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type fakeStreamingVoiceEngine struct {
	deltas []string
}

func (f *fakeStreamingVoiceEngine) Run(ctx context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	full := strings.Join(f.deltas, "")
	return &domain.UnifiedAssistantResponse{
		Reply:   full,
		Message: full,
		Text:    full,
	}, nil
}

func (f *fakeStreamingVoiceEngine) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, onDelta func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	for _, d := range f.deltas {
		if onDelta != nil {
			if err := onDelta(ai.StreamDelta{TextDelta: d}); err != nil {
				return nil, err
			}
		}
	}
	full := strings.Join(f.deltas, "")
	return &domain.UnifiedAssistantResponse{
		Reply:   full,
		Message: full,
		Text:    full,
	}, nil
}

type fakeSentenceTTS struct {
	mu        sync.Mutex
	sentences []string
}

func (f *fakeSentenceTTS) Synthesize(ctx context.Context, text string, voice string) ([]byte, string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sentences = append(f.sentences, strings.TrimSpace(text))
	return []byte("RIFFfakeaudio"), "audio/wav", nil
}

// TestPlano02_VoiceStreamSentenceChunker verifica que o pipeline de voz usa SentenceChunker
// durante RunStream para sintetizar e emitir cada oração imediatamente (< 800ms) sem esperar o turno inteiro.
func TestPlano02_VoiceStreamSentenceChunker(t *testing.T) {
	loop := service.NewAgentLoop(nil, nil, nil, nil, nil, nil)
	loop.SetEngine(&fakeStreamingVoiceEngine{
		deltas: []string{
			"Bom dia, André! ",
			"Seu primeiro compromisso é às nove horas. ",
			"Quer que eu leia suas tarefas?",
		},
	})

	tts := &fakeSentenceTTS{}
	h := NewVoiceStreamHandler(nil)
	h.SetAgentLoop(loop, nil)
	h.SetAudioServices(nil, tts, "")

	var events []VoiceServerEvent
	err := h.ProcessVoiceUtteranceStream(context.Background(), domain.UnifiedAssistantRequest{
		UserID:  "u1",
		Channel: "voice",
		Message: "Qual minha agenda?",
	}, func(ev VoiceServerEvent) {
		events = append(events, ev)
	})
	if err != nil {
		t.Fatalf("ProcessVoiceUtteranceStream erro inesperado: %v", err)
	}

	tts.mu.Lock()
	gotSentences := append([]string(nil), tts.sentences...)
	tts.mu.Unlock()

	if len(gotSentences) != 3 {
		t.Fatalf("esperava 3 sentenças sintetizadas incrementalmente pelo SentenceChunker, obteve %d: %v", len(gotSentences), gotSentences)
	}
	if gotSentences[0] != "Bom dia, André!" {
		t.Errorf("primeira sentença incorreta: %q", gotSentences[0])
	}
	if gotSentences[1] != "Seu primeiro compromisso é às nove horas." {
		t.Errorf("segunda sentença incorreta: %q", gotSentences[1])
	}
	if gotSentences[2] != "Quer que eu leia suas tarefas?" {
		t.Errorf("terceira sentença incorreta: %q", gotSentences[2])
	}

	audioEvents := 0
	for _, ev := range events {
		if ev.Type == "AUDIO" && ev.AudioB64 != "" {
			audioEvents++
		}
	}
	if audioEvents != 3 {
		t.Errorf("esperava 3 eventos AUDIO emitidos em streaming, obteve %d", audioEvents)
	}
}

// TestPlano02_RepositoryUsesDefaultWriterQueue garante que mutações reais nos repositórios SQLite
// (TodoRepository, TriggerRepository, Briefing, Pending, Memory, Calendar) passam pela DefaultWriterQueue compartilhada.
func TestPlano02_RepositoryUsesDefaultWriterQueue(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "plano02_wq.db"))
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	defer db.Close()

	q := database.NewSingleWriterQueue(64)
	database.SetDefaultWriterQueue(q)
	defer func() {
		q.Close()
		database.SetDefaultWriterQueue(nil)
	}()

	now := time.Now().UTC().Truncate(time.Second)
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID:        "u-wq-1",
		Name:      "WQ User",
		Email:     "wq@vito.test",
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("userRepo.Create: %v", err)
	}

	todoRepo := repository.NewTodoRepository(db)
	todo := &domain.Todo{ID: "todo-wq-1", UserID: "u-wq-1", Title: "Teste WQ", Status: domain.TodoStatusPending, Priority: "high", CreatedAt: now, UpdatedAt: now}
	if err := todoRepo.Create(todo); err != nil {
		t.Fatalf("todoRepo.Create: %v", err)
	}
	sub := &domain.Subtask{ID: "sub-wq-1", TodoID: "todo-wq-1", Title: "Sub 1", CreatedAt: now, UpdatedAt: now}
	if err := todoRepo.AddSubtask(sub); err != nil {
		t.Fatalf("todoRepo.AddSubtask: %v", err)
	}
	if _, err := todoRepo.ToggleSubtask("sub-wq-1", "todo-wq-1"); err != nil {
		t.Fatalf("todoRepo.ToggleSubtask: %v", err)
	}
	if err := todoRepo.MarkReminderSent("todo-wq-1", now); err != nil {
		t.Fatalf("todoRepo.MarkReminderSent: %v", err)
	}
	if err := todoRepo.MarkDueReminderSent("todo-wq-1", now); err != nil {
		t.Fatalf("todoRepo.MarkDueReminderSent: %v", err)
	}
	if err := todoRepo.DeleteSubtask("sub-wq-1", "todo-wq-1"); err != nil {
		t.Fatalf("todoRepo.DeleteSubtask: %v", err)
	}

	trigRepo := repository.NewTriggerRepository(db)
	trig := &domain.Trigger{
		ID: "trig-wq-1", UserID: "u-wq-1", Title: "Radar WQ", Category: domain.CategoryFinance,
		Query: "PETR4", ConditionType: domain.ConditionPriceAbove, TargetValue: "40",
		Status: domain.TriggerStatusActive, Frequency: domain.FrequencyHourly, CreatedAt: now, UpdatedAt: now,
	}
	if err := trigRepo.Create(trig); err != nil {
		t.Fatalf("trigRepo.Create: %v", err)
	}
	trig.Title = "Radar WQ Atualizado"
	if err := trigRepo.Update(trig); err != nil {
		t.Fatalf("trigRepo.Update: %v", err)
	}
	if err := trigRepo.UpdateStatus("trig-wq-1", "u-wq-1", domain.TriggerStatusPaused); err != nil {
		t.Fatalf("trigRepo.UpdateStatus: %v", err)
	}
	if err := trigRepo.UpdateLastError("trig-wq-1", "nenhum"); err != nil {
		t.Fatalf("trigRepo.UpdateLastError: %v", err)
	}
	if err := trigRepo.SetSeenHashes("trig-wq-1", []string{"h1"}); err != nil {
		t.Fatalf("trigRepo.SetSeenHashes: %v", err)
	}
	if err := trigRepo.CreateLog(&domain.TriggerLog{ID: "log-wq-1", TriggerID: "trig-wq-1", TriggeredAt: now, Message: "ok"}); err != nil {
		t.Fatalf("trigRepo.CreateLog: %v", err)
	}
	if err := trigRepo.ClearLogs("trig-wq-1", "u-wq-1"); err != nil {
		t.Fatalf("trigRepo.ClearLogs: %v", err)
	}

	briefRepo := repository.NewBriefingRepository(db)
	if err := briefRepo.MarkSent("u-wq-1", "2026-11-21"); err != nil {
		t.Fatalf("briefRepo.MarkSent: %v", err)
	}

	pendRepo := repository.NewPendingRepository(db)
	if err := pendRepo.Create(&domain.PendingItem{
		ID: "pend-wq-1", UserID: "u-wq-1", Title: "Pend", Category: "geral",
		Status: domain.PendingStatusInbox, CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatalf("pendRepo.Create: %v", err)
	}
	if err := pendRepo.MarkNudgeSent("pend-wq-1", now); err != nil {
		t.Fatalf("pendRepo.MarkNudgeSent: %v", err)
	}

	// Ao fechar DefaultWriterQueue mantendo db aberto, qualquer escrita que ainda chame r.db.Exec
	// diretamente passaria; todas as migradas devem retornar ErrQueueClosed.
	q.Close()
	checks := []struct {
		name string
		err  error
	}{
		{"todo.AddSubtask", todoRepo.AddSubtask(&domain.Subtask{ID: "sub-wq-2", TodoID: "todo-wq-1", Title: "X", CreatedAt: now, UpdatedAt: now})},
		{"todo.MarkReminderSent", todoRepo.MarkReminderSent("todo-wq-1", now)},
		{"todo.MarkDueReminderSent", todoRepo.MarkDueReminderSent("todo-wq-1", now)},
		{"todo.DeleteSubtask", todoRepo.DeleteSubtask("sub-wq-1", "todo-wq-1")},
		{"trigger.Update", trigRepo.Update(trig)},
		{"trigger.UpdateStatus", trigRepo.UpdateStatus("trig-wq-1", "u-wq-1", domain.TriggerStatusActive)},
		{"trigger.UpdateLastNotifiedAt", trigRepo.UpdateLastNotifiedAt("trig-wq-1", now)},
		{"trigger.Delete", trigRepo.Delete("trig-wq-1", "u-wq-1")},
		{"trigger.CreateLog", trigRepo.CreateLog(&domain.TriggerLog{ID: "log-wq-2", TriggerID: "trig-wq-1", TriggeredAt: now, Message: "fail"})},
		{"briefing.MarkSent", briefRepo.MarkSent("u-wq-1", "2026-11-22")},
		{"pending.MarkNudgeSent", pendRepo.MarkNudgeSent("pend-wq-1", now)},
	}
	for _, c := range checks {
		if !errors.Is(c.err, database.ErrQueueClosed) {
			t.Errorf("%s não passou pela DefaultWriterQueue (esperava ErrQueueClosed, obteve %v)", c.name, c.err)
		}
	}
}

type fakeSSEEngine struct{}

func (f *fakeSSEEngine) Run(ctx context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	return &domain.UnifiedAssistantResponse{Text: "ok", Reply: "ok", Message: "ok"}, nil
}

func (f *fakeSSEEngine) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, onDelta func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	if onDelta != nil {
		_ = onDelta(ai.StreamDelta{Type: "reasoning", ReasoningDelta: "Analisando agenda..."})
		_ = onDelta(ai.StreamDelta{Type: "tool_call", ToolName: "calendar_list_events"})
		_ = onDelta(ai.StreamDelta{Type: "text", TextDelta: "Você tem 1 reunião."})
	}
	return &domain.UnifiedAssistantResponse{Text: "Você tem 1 reunião.", Reply: "Você tem 1 reunião.", Message: "Você tem 1 reunião."}, nil
}

// TestPlano02_AssistantStream_EmitsDeltaContract valida que /api/v1/assistant/chat/stream serializa
// os campos type, tool_name, reasoning_delta e text_delta no SSE para o cliente Mobile.
func TestPlano02_AssistantStream_EmitsDeltaContract(t *testing.T) {
	loop := service.NewAgentLoop(nil, nil, nil, nil, nil, nil)
	loop.SetEngine(&fakeSSEEngine{})
	h := NewAssistantStreamHandler(loop)

	body, _ := json.Marshal(domain.UnifiedAssistantRequest{Message: "Qual minha agenda?", Channel: "app_mobile"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/chat/stream", bytes.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "u-sse-1"))
	rec := httptest.NewRecorder()
	h.Stream(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200, obteve %d", rec.Code)
	}
	raw := rec.Body.String()
	for _, want := range []string{`"type":"reasoning"`, `"reasoning_delta":"Analisando agenda..."`, `"type":"tool_call"`, `"tool_name":"calendar_list_events"`, `"type":"text"`, `"text_delta":"Você tem 1 reunião."`, `event: done`} {
		if !strings.Contains(raw, want) {
			t.Errorf("SSE não conteve %s em:\n%s", want, raw)
		}
	}
}

// TestPlano02_ConfirmHandler_RejectRecordsImplicitFeedback garante que rejeitar uma ação no ConfirmationGate
// aciona MemoryConsolidationWorker.RecordImplicitFeedback e grava a preferência no SQLite.
func TestPlano02_ConfirmHandler_RejectRecordsImplicitFeedback(t *testing.T) {
	ctx := context.Background()
	db, err := database.Open(filepath.Join(t.TempDir(), "confirm_reject_feedback.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	userRepo := repository.NewUserRepository(db)
	userID := "u-fb-1"
	_ = userRepo.Create(&domain.User{ID: userID, Name: "FB User", Email: "fb@vito.test", CreatedAt: now, UpdatedAt: now})

	convRepo := repository.NewConversationStoreRepository(db)
	memHierRepo := repository.NewMemoryHierarchyRepository(db)
	memRepo := repository.NewMemoryRepository(db)

	worker := service.NewMemoryConsolidationWorker(convRepo, memHierRepo, time.Hour)
	worker.SetFactRepository(memRepo, nil)
	defer worker.Stop()

	gate := service.NewConfirmationGateService(db)
	gate.SetFeedbackRecorder(worker)

	thread, err := convRepo.GetOrCreateThread(ctx, userID, "app_mobile", "thread-fb-1")
	if err != nil {
		t.Fatalf("GetOrCreateThread: %v", err)
	}

	pending, err := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:        userID,
		ThreadID:      thread.ID,
		Channel:       "app_mobile",
		ToolsetName:   "gmail_manager",
		Operation:     "send_email",
		ArgumentsJSON: `{"to":"x@y.com"}`,
		PreviewJSON:   `{}`,
	})
	if err != nil {
		t.Fatalf("CreatePending: %v", err)
	}

	loop := service.NewAgentLoop(nil, nil, service.NewScopeGuard(), gate, convRepo, nil)
	h := NewAssistantStreamHandler(loop)

	body, _ := json.Marshal(map[string]any{
		"pending_id": pending.ID,
		"reject":     true,
		"reason":     "prefiro revisar antes de enviar e-mail",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/confirm", bytes.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID))
	rec := httptest.NewRecorder()
	h.Confirm(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Confirm reject esperava 200, obteve %d (%s)", rec.Code, rec.Body.String())
	}

	facts, err := memHierRepo.ListAtomicFacts(ctx, userID, 10)
	if err != nil || len(facts) == 0 {
		t.Fatalf("esperava fato de feedback implícito gravado em user_memories, obteve %+v err=%v", facts, err)
	}
	if !strings.Contains(facts[0].Content, "prefiro revisar antes de enviar e-mail") {
		t.Errorf("conteúdo do feedback implícito inesperado: %q", facts[0].Content)
	}
}
