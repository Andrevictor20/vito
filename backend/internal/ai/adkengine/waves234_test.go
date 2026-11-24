package adkengine_test

import (
	"context"
	aimemory "github.com/andrevmp/vito/backend/internal/ai/memory"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/adk/v2/memory"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/ai/evals"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

// TestAC04_COG04_MemoryConsolidationAndHybridSearch valida AC-04 (COG-04 / Onda 2):
// Dado o encerramento de uma conversa contendo uma nova preferência que contradiz uma anterior,
// quando o MemoryConsolidationWorker executa via extrator ADK, então extrai o fato real,
// substitui a contradição via superseded_by e o aimemory.SQLiteMemoryService (adk/v2/memory.Service)
// recupera o fato por busca híbrida (FTS5 + embedding vetorial) mesmo perguntado com sinônimo.
func TestAC04_COG04_MemoryConsolidationAndHybridSearch(t *testing.T) {
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "vito_adk_wave2.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	userID := "user-cog04"
	if err := userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "André",
		Email:        "andre.cog04@vito.ai",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	factRepo := repository.NewMemoryRepository(db)
	hierarchyRepo := repository.NewMemoryHierarchyRepository(db)
	convRepo := repository.NewConversationStoreRepository(db)

	memSvc := aimemory.NewSQLiteMemoryService(factRepo, hierarchyRepo, aimemory.DefaultSemanticEmbedder)

	// 1. Insere preferência antiga: "Prefiro reuniões pela manhã"
	oldFactID := "fact-old-morning"
	oldFact := &domain.Memory{
		ID:         oldFactID,
		UserID:     userID,
		Category:   "preference",
		Content:    "Prefiro reuniões no período matutino (manhã).",
		Importance: 4,
		Confidence: 0.9,
		CreatedAt:  time.Now().UTC().Add(-24 * time.Hour),
		UpdatedAt:  time.Now().UTC().Add(-24 * time.Hour),
	}
	if err := factRepo.Create(oldFact); err != nil {
		t.Fatalf("falha ao gravar fato antigo: %v", err)
	}
	if vec, err := aimemory.DefaultSemanticEmbedder(ctx, oldFact.Content); err == nil {
		_ = factRepo.UpsertEmbedding(ctx, oldFactID, userID, "gemini-embedding-001", vec)
	}

	// 2. Simula conversa na thread com nova preferência contraditória ("apenas no período vespertino")
	thread, err := convRepo.GetOrCreateThread(ctx, userID, "app_mobile", "thread-cog04")
	if err != nil {
		t.Fatalf("falha ao criar thread: %v", err)
	}
	_ = convRepo.CreateTurn(ctx, &repository.ConversationTurn{
		ID:        "turn-1",
		ThreadID:  thread.ID,
		UserID:    userID,
		Channel:   "app_mobile",
		Role:      "user",
		Origin:    "direct",
		Content:   "Mudança na minha rotina: agora prefiro reuniões apenas no período vespertino.",
		CreatedAt: time.Now().UTC(),
	})

	// 3. Configura extrator ADK sobre RoutedLLM retornando JSON estruturado com supersedes_id
	extractorLLM := &fakeAgentProvider{
		name:          "Gemini-Extractor",
		model:         "gemini-2.5-flash",
		tier:          3,
		supportsTools: false,
		responses: []*ai.AgentChatResponse{
			{
				Text: `{"facts":[{"category":"preference","content":"Prefere compromissos exclusivamente no período vespertino","importance":5,"confidence":0.98,"supersedes_id":"fact-old-morning"}],"episode_title":"Atualização de Horário de Reuniões","episode_summary":"Usuário definiu preferência por reuniões no período vespertino.","episode_importance":4,"theme_slug":"agenda_preferencias","theme_title":"Preferências de Agenda","theme_summary":"Prefere reuniões no período vespertino."}`,
			},
		},
	}
	router := ai.NewModelRouter()
	router.AddProvider(extractorLLM)
	routed := adkengine.NewRoutedLLM(router)

	worker := service.NewMemoryConsolidationWorker(convRepo, hierarchyRepo, 50*time.Millisecond)
	worker.SetFactRepository(factRepo, aimemory.DefaultSemanticEmbedder)
	worker.SetSemanticExtractor(aimemory.NewADKMemoryExtractor(routed))

	if err := worker.ConsolidateThread(ctx, thread.ID, userID); err != nil {
		t.Fatalf("AC-04: falha no ConsolidateThread: %v", err)
	}

	// 4. Verifica que a memória antiga recebeu superseded_by != ""
	updatedOld, err := factRepo.GetByID(oldFactID, userID)
	if err != nil {
		t.Fatalf("AC-04: erro ao buscar memória antiga: %v", err)
	}
	if strings.TrimSpace(updatedOld.SupersededBy) == "" {
		t.Fatalf("AC-04: esperava que o fato antigo (%s) tivesse superseded_by preenchido", oldFactID)
	}

	// 5. Busca no aimemory.SQLiteMemoryService (adk/v2/memory.Service) usando sinônimo "tarde" (que não aparece literalmente em "vespertino")
	searchResp, err := memSvc.SearchMemory(ctx, &memory.SearchRequest{
		AppName: "vito",
		UserID:  userID,
		Query:   "qual horário à tarde para call?",
	})
	if err != nil {
		t.Fatalf("AC-04: erro no SearchMemory: %v", err)
	}
	if len(searchResp.Memories) == 0 {
		t.Fatalf("AC-04: esperava recuperar memória via busca híbrida com sinônimo 'tarde' -> 'vespertino'")
	}

	foundVespertino := false
	for _, entry := range searchResp.Memories {
		if entry.ID == oldFactID {
			t.Errorf("AC-04: memória substituída (superseded_by) NÃO deveria retornar na busca ativa")
		}
		if entry.Content != nil && len(entry.Content.Parts) > 0 && strings.Contains(entry.Content.Parts[0].Text, "vespertino") {
			foundVespertino = true
		}
	}
	if !foundVespertino {
		t.Errorf("AC-04: esperava encontrar o fato consolidado 'vespertino' nos resultados do aimemory.SQLiteMemoryService")
	}
}

// TestAC05_COG05_AttentionBudgetService_CalendarSilenceAndDedup valida AC-05 (COG-05 / Onda 3):
// Dado um evento em andamento na agenda do usuário e 2 notificações não críticas geradas simultaneamente
// (Bot ADK + Finance), quando passam pelo AttentionBudgetService, então alertas redundantes são deduplicados
// e avisos leves aguardam o término do evento sem bloquear alarmes críticos (critical_alarm).
func TestAC05_COG05_AttentionBudgetService_CalendarSilenceAndDedup(t *testing.T) {
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "vito_adk_wave3.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	eventRepo := calendar.NewEventRepository(db)
	userID := "user-cog05"
	now := time.Date(2026, 11, 21, 15, 0, 0, 0, time.UTC)

	if err := userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "André",
		Email:        "andre.cog05@vito.ai",
		PasswordHash: "hash",
		CreatedAt:    now,
		UpdatedAt:    now,
	}); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	// Cria um evento em andamento das 14:30 às 16:00 UTC
	eventEnd := now.Add(60 * time.Minute)
	if err := eventRepo.Create(&domain.Event{
		ID:        "ev-running-1",
		UserID:    userID,
		Title:     "Reunião de Arquitetura ADK",
		StartAt:   now.Add(-30 * time.Minute),
		EndAt:     eventEnd,
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("falha ao criar evento em andamento: %v", err)
	}

	budgetSvc := service.NewAttentionBudgetService(db, eventRepo)

	// 1. Notificação leve do FinanceTrigger sobre Fatura Nubank durante reunião -> DEFERRED até 16:00
	dec1, err := budgetSvc.Evaluate(ctx, service.AttentionCandidate{
		UserID:       userID,
		SourceWorker: "finance_trigger",
		Category:     "financas",
		Urgency:      "normal",
		Title:        "Alerta de Fatura Nubank vencendo amanhã",
		Body:         "Fatura Nubank no valor de R$ 1.250",
		Now:          now,
	})
	if err != nil {
		t.Fatalf("AC-05: falha ao avaliar notificação 1: %v", err)
	}
	if dec1.Status != service.AttentionStatusDeferred {
		t.Fatalf("AC-05: esperava status DEFERRED durante evento em andamento, obteve %s", dec1.Status)
	}
	if dec1.ScheduledFor == nil || !dec1.ScheduledFor.Equal(eventEnd) {
		t.Errorf("AC-05: esperava agendamento pós-evento em %v, obteve %v", eventEnd, dec1.ScheduledFor)
	}

	// 2. Notificação redundante do Bot ADK sobre a mesma Fatura Nubank -> DEDUPLICATED
	dec2, err := budgetSvc.Evaluate(ctx, service.AttentionCandidate{
		UserID:       userID,
		SourceWorker: "bot_runner",
		Category:     "bots",
		Urgency:      "normal",
		Title:        "Bot Financeiro: Fatura Nubank vencendo amanhã",
		Body:         "Fatura Nubank no valor de R$ 1.250",
		Now:          now.Add(1 * time.Minute),
	})
	if err != nil {
		t.Fatalf("AC-05: falha ao avaliar notificação 2: %v", err)
	}
	if dec2.Status != service.AttentionStatusDeduplicated {
		t.Fatalf("AC-05: esperava status DEDUPLICATED para alerta redundante cross-worker, obteve %s", dec2.Status)
	}

	// 3. Alarme crítico (critical_alarm) durante o mesmo evento -> DELIVERED imediatamente
	decCritical, err := budgetSvc.Evaluate(ctx, service.AttentionCandidate{
		UserID:       userID,
		SourceWorker: "reminder_worker",
		Category:     "critical_alarm",
		Urgency:      "critical",
		Title:        "Remédio de pressão agora",
		Body:         "Alarme crítico de saúde",
		Now:          now.Add(2 * time.Minute),
	})
	if err != nil {
		t.Fatalf("AC-05: falha ao avaliar alarme crítico: %v", err)
	}
	if decCritical.Status != service.AttentionStatusDelivered {
		t.Fatalf("AC-05: alarme crítico deve furar silêncio de agenda com DELIVERED, obteve %s", decCritical.Status)
	}

	// 4. Valida também resolução unificada de entidades (entity_links na 036) e Workflow Agents (ParallelAgent + SequentialAgent)
	entityRepo := repository.NewEntityLinkRepository(db)
	if err := entityRepo.Upsert(ctx, &repository.EntityLink{
		UserID:        userID,
		CanonicalName: "Isabela Alvimar",
		EntityType:    "person",
		WhatsAppJID:   "5511999991111@s.whatsapp.net",
		Email:         "isa@alvimar.com.br",
		Aliases:       []string{"Isa", "Amor"},
	}); err != nil {
		t.Fatalf("AC-05: falha ao gravar entity_link: %v", err)
	}
	matches, err := entityRepo.Resolve(ctx, userID, "isa")
	if err != nil || len(matches) != 1 || matches[0].Email != "isa@alvimar.com.br" {
		t.Fatalf("AC-05: falha ao resolver entidade cruzada WhatsApp<->Email: %v", matches)
	}

	router := ai.NewModelRouter()
	routed := adkengine.NewRoutedLLM(router)
	wf, err := adkengine.BuildCrossDomainBriefingWorkflow(routed, nil)
	if err != nil || wf == nil || wf.ParallelCollectors == nil || wf.SequentialPipeline == nil {
		t.Fatalf("AC-05: falha ao construir workflow ParallelAgent + SequentialAgent: %v", err)
	}
}

// TestAC06_COG06_ADKGoldenEvalsSuiteAndBotScope valida AC-06 (COG-06 / Onda 4):
// Dado a suíte ADK Golden Evals (36 trajetórias críticas: tool calling, zero tabelas e teto 320 na voz,
// ancoragem financeira, Pix/Web taint tracking no BeforeToolCallback e escopo de llmagent de bot),
// quando executa, então 100% das 36 trajetórias passam e são registradas em ai_eval_runs.
func TestAC06_COG06_ADKGoldenEvalsSuiteAndBotScope(t *testing.T) {
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "vito_adk_wave4.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:           "eval-user",
		Name:         "Eval User",
		Email:        "eval@vito.ai",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	runner := evals.NewGoldenEvalRunner(db)
	report, err := runner.RunDefaultSuite(ctx)
	if err != nil {
		t.Fatalf("AC-06: erro ao executar suíte ADK Golden Evals: %v", err)
	}

	if report.Total < 35 {
		t.Fatalf("AC-06: esperava ao menos 35 cenários na suíte ADK Golden Evals, obteve %d", report.Total)
	}
	if report.FailedCount > 0 || report.PassedCount != report.Total {
		for _, r := range report.Results {
			if !r.Passed {
				t.Errorf("AC-06: cenário %s (%s) falhou: %s", r.ScenarioID, r.Category, r.Notes)
			}
		}
		t.Fatalf("AC-06: esperava 100%% de aprovação (%d/%d), mas %d falharam", report.PassedCount, report.Total, report.FailedCount)
	}

	var storedCount int
	if err := db.QueryRow(`SELECT COUNT(1) FROM ai_eval_runs WHERE suite_name = 'adk_golden_evals' AND passed = 1`).Scan(&storedCount); err != nil {
		t.Fatalf("AC-06: falha ao consultar tabela ai_eval_runs: %v", err)
	}
	if storedCount != report.Total {
		t.Errorf("AC-06: esperava %d execuções persistidas em ai_eval_runs, obteve %d", report.Total, storedCount)
	}
}
