package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/repository"
)

// MemoryConsolidationWorker consolida memórias hierárquicas após 150s de inatividade na conversa.
type MemoryConsolidationWorker struct {
	convRepo         *repository.ConversationStoreRepository
	memoryRepo       *repository.MemoryHierarchyRepository
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

// NotifyActivity reseta o temporizador de debounce de 150s para a thread.
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

// ConsolidateThread extrai episódios e resumos temáticos de novos turnos.
func (w *MemoryConsolidationWorker) ConsolidateThread(ctx context.Context, threadID, userID string) error {
	w.mu.Lock()
	delete(w.timers, threadID)
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

	// Cria um episódio representativo da sessão
	now := time.Now().UTC()
	episode := &repository.MemoryEpisode{
		UserID:           userID,
		ThreadID:         threadID,
		Channel:          thread.Channel,
		Title:            fmt.Sprintf("Sessão em %s", now.Format("02/01/2006")),
		NarrativeSummary: fmt.Sprintf("Conversa com %d turnos sobre %s.", len(turns), thread.Title),
		HappenedAt:       now,
		Importance:       3,
	}

	if err := w.memoryRepo.CreateEpisode(ctx, episode); err != nil {
		return fmt.Errorf("falha ao salvar episódio de memória: %w", err)
	}

	// Atualiza o resumo temático 'geral'
	summary := &repository.MemoryThematicSummary{
		UserID:              userID,
		ThemeSlug:           "geral_rotina",
		ThemeTitle:          "Rotina e Interações Gerais",
		ConsolidatedSummary: fmt.Sprintf("Última interação consolidada com %d turnos na thread %s.", len(turns), threadID),
		FactCount:           1,
		EpisodeCount:        1,
	}
	_ = w.memoryRepo.UpsertThematicSummary(ctx, summary)

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
