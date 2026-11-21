package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// ExtractedAtomicFact representa um fato atômico ou preferência extraído pelo agente de consolidação ADK.
type ExtractedAtomicFact struct {
	Category     string  `json:"category"`
	Content      string  `json:"content"`
	Importance   int     `json:"importance"`
	Confidence   float64 `json:"confidence"`
	SupersedesID string  `json:"supersedes_id,omitempty"`
}

// ConsolidatedMemoryOutput define o schema estruturado produzido pelo extrator semântico ADK.
type ConsolidatedMemoryOutput struct {
	Facts             []ExtractedAtomicFact `json:"facts"`
	EpisodeTitle      string                `json:"episode_title"`
	EpisodeSummary    string                `json:"episode_summary"`
	EpisodeImportance int                   `json:"episode_importance"`
	ThemeSlug         string                `json:"theme_slug"`
	ThemeTitle        string                `json:"theme_title"`
	ThemeSummary      string                `json:"theme_summary"`
}

// MemorySemanticExtractor abstrai o agente ADK extrator estruturado (OutputSchema via genai).
type MemorySemanticExtractor interface {
	ExtractFromConversation(
		ctx context.Context,
		channel string,
		turns []*repository.ConversationTurn,
		existingFacts []domain.Memory,
	) (*ConsolidatedMemoryOutput, error)
}

// MemoryConsolidationWorker consolida memórias hierárquicas e fatos atômicos após inatividade na conversa.
type MemoryConsolidationWorker struct {
	convRepo         *repository.ConversationStoreRepository
	memoryRepo       *repository.MemoryHierarchyRepository
	factRepo         *repository.MemoryRepositorySQLite
	extractor        MemorySemanticExtractor
	embedder         repository.EmbedderFunc
	debounceDuration time.Duration
	mu               sync.Mutex
	timers           map[string]*time.Timer
	stopChan         chan struct{}
}

func NewMemoryConsolidationWorker(
	convRepo *repository.ConversationStoreRepository,
	memoryRepo *repository.MemoryHierarchyRepository,
	debounceDuration time.Duration,
) *MemoryConsolidationWorker {
	if debounceDuration <= 0 {
		debounceDuration = 150 * time.Second
	}
	return &MemoryConsolidationWorker{
		convRepo:         convRepo,
		memoryRepo:       memoryRepo,
		debounceDuration: debounceDuration,
		timers:           make(map[string]*time.Timer),
		stopChan:         make(chan struct{}),
	}
}

// SetFactRepository conecta o repositório de fatos atômicos (memories + memory_embeddings).
func (w *MemoryConsolidationWorker) SetFactRepository(factRepo *repository.MemoryRepositorySQLite, embedder repository.EmbedderFunc) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.factRepo = factRepo
	w.embedder = embedder
	if factRepo != nil && embedder != nil {
		factRepo.SetEmbedder(embedder)
	}
}

// SetSemanticExtractor conecta o agente extrator ADK para consolidação estruturada.
func (w *MemoryConsolidationWorker) SetSemanticExtractor(extractor MemorySemanticExtractor) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.extractor = extractor
}

// NotifyActivity reseta o temporizador de debounce para a thread.
func (w *MemoryConsolidationWorker) NotifyActivity(threadID, userID string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if timer, exists := w.timers[threadID]; exists {
		timer.Stop()
	}

	w.timers[threadID] = time.AfterFunc(w.debounceDuration, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = w.ConsolidateThread(ctx, threadID, userID)
	})
}

// ConsolidateThread extrai fatos atômicos (com detecção de contradição superseded_by), episódios e resumos temáticos.
func (w *MemoryConsolidationWorker) ConsolidateThread(ctx context.Context, threadID, userID string) error {
	w.mu.Lock()
	delete(w.timers, threadID)
	factRepo := w.factRepo
	extractor := w.extractor
	embedder := w.embedder
	w.mu.Unlock()

	if w.convRepo == nil || w.memoryRepo == nil {
		return nil
	}

	thread, err := w.convRepo.GetThreadByID(ctx, threadID)
	if err != nil || thread == nil {
		return err
	}

	turns, err := w.convRepo.GetRecentTurns(ctx, threadID, 20)
	if err != nil || len(turns) == 0 {
		return nil
	}

	var existingFacts []domain.Memory
	if factRepo != nil {
		existingFacts, _ = factRepo.ListByUser(userID, 50)
	}

	var extracted *ConsolidatedMemoryOutput
	if extractor != nil {
		if out, extErr := extractor.ExtractFromConversation(ctx, thread.Channel, turns, existingFacts); extErr == nil && out != nil {
			extracted = out
		}
	}
	if extracted == nil {
		extracted = heuristicExtractFromTurns(thread, turns, existingFacts)
	}

	now := time.Now().UTC()
	persistedFacts := 0

	for _, f := range extracted.Facts {
		content := strings.TrimSpace(f.Content)
		if content == "" {
			continue
		}
		cat := strings.TrimSpace(f.Category)
		if cat == "" {
			cat = "preference"
		}
		imp := f.Importance
		if imp <= 0 || imp > 5 {
			imp = 4
		}
		conf := f.Confidence
		if conf <= 0 || conf > 1.0 {
			conf = 0.9
		}

		newID := uuid.New().String()
		if factRepo != nil {
			mem := &domain.Memory{
				ID:         newID,
				UserID:     userID,
				Category:   cat,
				Content:    content,
				Importance: imp,
				Confidence: conf,
				CreatedAt:  now,
				UpdatedAt:  now,
			}
			if err := factRepo.Create(mem); err == nil {
				persistedFacts++
				if embedder != nil {
					if vec, embErr := embedder(ctx, content); embErr == nil && len(vec) > 0 {
						_ = factRepo.UpsertEmbedding(ctx, newID, userID, "gemini-embedding-001", vec)
					}
				}
				// Marca memória anterior contraditória como substituída (superseded_by)
				supersedeTarget := strings.TrimSpace(f.SupersedesID)
				if supersedeTarget == "" {
					supersedeTarget = detectContradictedMemoryID(cat, content, existingFacts)
				}
				if supersedeTarget != "" && supersedeTarget != newID {
					_ = factRepo.Supersede(supersedeTarget, userID, newID)
				}
			}
		}

		_ = w.memoryRepo.CreateAtomicFact(ctx, &repository.UserMemoryFact{
			ID:         newID,
			UserID:     userID,
			Category:   cat,
			Content:    content,
			Source:     thread.Channel,
			Confidence: conf,
			IsActive:   true,
			CreatedAt:  now,
			UpdatedAt:  now,
		})
	}

	epTitle := strings.TrimSpace(extracted.EpisodeTitle)
	if epTitle == "" {
		epTitle = fmt.Sprintf("Sessão em %s", now.Format("02/01/2006"))
	}
	epSummary := strings.TrimSpace(extracted.EpisodeSummary)
	if epSummary == "" {
		epSummary = fmt.Sprintf("Conversa com %d turnos sobre %s.", len(turns), thread.Title)
	}
	epImp := extracted.EpisodeImportance
	if epImp <= 0 {
		epImp = 3
	}

	episode := &repository.MemoryEpisode{
		UserID:           userID,
		ThreadID:         threadID,
		Channel:          thread.Channel,
		Title:            epTitle,
		NarrativeSummary: epSummary,
		HappenedAt:       now,
		Importance:       epImp,
	}
	if err := w.memoryRepo.CreateEpisode(ctx, episode); err != nil {
		return fmt.Errorf("falha ao salvar episódio de memória: %w", err)
	}

	themeSlug := strings.TrimSpace(extracted.ThemeSlug)
	if themeSlug == "" {
		themeSlug = "geral_rotina"
	}
	themeTitle := strings.TrimSpace(extracted.ThemeTitle)
	if themeTitle == "" {
		themeTitle = "Rotina e Preferências do Usuário"
	}
	themeSummary := strings.TrimSpace(extracted.ThemeSummary)
	if themeSummary == "" {
		themeSummary = epSummary
	}

	summary := &repository.MemoryThematicSummary{
		UserID:              userID,
		ThemeSlug:           themeSlug,
		ThemeTitle:          themeTitle,
		ConsolidatedSummary: themeSummary,
		FactCount:           persistedFacts,
		EpisodeCount:        1,
	}
	_ = w.memoryRepo.UpsertThematicSummary(ctx, summary)
	return nil
}

// RecordImplicitFeedback registra aprendizado quando o usuário edita ou rejeita uma proposta do ConfirmationGate.
func (w *MemoryConsolidationWorker) RecordImplicitFeedback(ctx context.Context, userID, toolName, action, reason string) error {
	w.mu.Lock()
	factRepo := w.factRepo
	embedder := w.embedder
	w.mu.Unlock()

	if strings.TrimSpace(userID) == "" || strings.TrimSpace(reason) == "" {
		return nil
	}
	now := time.Now().UTC()
	content := fmt.Sprintf("Preferência operacional (%s/%s): %s", toolName, action, strings.TrimSpace(reason))
	id := uuid.New().String()

	if factRepo != nil {
		_ = factRepo.Create(&domain.Memory{
			ID:         id,
			UserID:     userID,
			Category:   "preference",
			Content:    content,
			Importance: 4,
			Confidence: 0.9,
			CreatedAt:  now,
			UpdatedAt:  now,
		})
		if embedder != nil {
			if vec, err := embedder(ctx, content); err == nil && len(vec) > 0 {
				_ = factRepo.UpsertEmbedding(ctx, id, userID, "gemini-embedding-001", vec)
			}
		}
	}
	if w.memoryRepo != nil {
		_ = w.memoryRepo.CreateAtomicFact(ctx, &repository.UserMemoryFact{
			ID:         id,
			UserID:     userID,
			Category:   "preference",
			Content:    content,
			Source:     "implicit_feedback",
			Confidence: 0.9,
			IsActive:   true,
			CreatedAt:  now,
			UpdatedAt:  now,
		})
	}
	return nil
}

// Stop cancela timers pendentes.
func (w *MemoryConsolidationWorker) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, t := range w.timers {
		t.Stop()
	}
	w.timers = make(map[string]*time.Timer)
}

func heuristicExtractFromTurns(
	thread *repository.ConversationThread,
	turns []*repository.ConversationTurn,
	existing []domain.Memory,
) *ConsolidatedMemoryOutput {
	var facts []ExtractedAtomicFact
	var lastUserMsg string
	preferenceCues := []string{
		"prefiro", "preferência", "gosto de", "não gosto", "nunca marque",
		"apenas no período", "só à tarde", "só de manhã", "sempre", "meu horário",
	}

	for _, t := range turns {
		if t == nil || t.Role != "user" {
			continue
		}
		txt := strings.TrimSpace(t.Content)
		if txt == "" {
			continue
		}
		lastUserMsg = txt
		lower := strings.ToLower(txt)
		for _, cue := range preferenceCues {
			if strings.Contains(lower, cue) {
				supID := detectContradictedMemoryID("preference", txt, existing)
				facts = append(facts, ExtractedAtomicFact{
					Category:     "preference",
					Content:      txt,
					Importance:   4,
					Confidence:   0.92,
					SupersedesID: supID,
				})
				break
			}
		}
	}

	summaryText := fmt.Sprintf("Conversa com %d turnos em %s.", len(turns), thread.Channel)
	if lastUserMsg != "" {
		summaryText = fmt.Sprintf("Usuário tratou de: %s", lastUserMsg)
	}
	return &ConsolidatedMemoryOutput{
		Facts:             facts,
		EpisodeTitle:      fmt.Sprintf("Interação (%s)", thread.Channel),
		EpisodeSummary:    summaryText,
		EpisodeImportance: 3,
		ThemeSlug:         "preferencias_e_rotina",
		ThemeTitle:        "Preferências e Rotina",
		ThemeSummary:      summaryText,
	}
}

func detectContradictedMemoryID(category, newContent string, existing []domain.Memory) string {
	newLower := strings.ToLower(newContent)
	topicKeywords := [][]string{
		{"reunião", "reuniões", "agenda", "horário", "manhã", "tarde", "vespertino", "matutino"},
		{"notificação", "notificações", "alerta", "avisos"},
		{"email", "e-mail", "whatsapp", "mensagem"},
	}
	for _, old := range existing {
		if old.SupersededBy != "" || strings.EqualFold(old.Content, newContent) {
			continue
		}
		oldLower := strings.ToLower(old.Content)
		for _, grp := range topicKeywords {
			newHits, oldHits := false, false
			for _, kw := range grp {
				if strings.Contains(newLower, kw) {
					newHits = true
				}
				if strings.Contains(oldLower, kw) {
					oldHits = true
				}
			}
			if newHits && oldHits && old.Category == category {
				return old.ID
			}
		}
	}
	return ""
}
