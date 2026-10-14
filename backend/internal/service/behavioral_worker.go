package service

import (
	"fmt"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// BehavioralWorker consolida padrões de uso em insights ("dream worker", §8.4 ciclo 3).
// Roda 1x/dia e grava até 3 memórias category=behavioral_insight (rotaciona as antigas).
type BehavioralWorker struct {
	todoRepo   domain.TodoRepository
	eventRepo  domain.EventRepository
	memoryRepo domain.MemoryRepository
	interval   time.Duration
	stopCh     chan struct{}
	wg         sync.WaitGroup
	running    bool
	mu         sync.Mutex
	nowFn      func() time.Time
}

func NewBehavioralWorker(todoRepo domain.TodoRepository, eventRepo domain.EventRepository, memoryRepo domain.MemoryRepository) *BehavioralWorker {
	return &BehavioralWorker{
		todoRepo:   todoRepo,
		eventRepo:  eventRepo,
		memoryRepo: memoryRepo,
		interval:   1 * time.Hour,
		stopCh:     make(chan struct{}),
		nowFn:      time.Now,
	}
}

// Consolidate agrega os últimos 30 dias e rotaciona os insights do usuário.
func (w *BehavioralWorker) Consolidate(userID string) (int, error) {
	now := w.nowFn().UTC()
	from := now.AddDate(0, 0, -30)

	todos, err := w.todoRepo.ListByUser(userID, "")
	if err != nil {
		return 0, err
	}
	events, err := w.eventRepo.ListByUser(userID, from, now)
	if err != nil {
		return 0, err
	}

	var insights []string
	if s := peakCompletionWindow(todos); s != "" {
		insights = append(insights, s)
	}
	if s := procrastinatingCategories(todos, now); s != "" {
		insights = append(insights, s)
	}
	if s := busyWeekdays(events); s != "" {
		insights = append(insights, s)
	}
	if len(insights) == 0 {
		return 0, nil
	}

	// Rotaciona: apaga insights anteriores e grava os frescos.
	existing, err := w.memoryRepo.ListByUser(userID, 50)
	if err == nil {
		for _, m := range existing {
			if m.Category == "behavioral_insight" {
				_ = w.memoryRepo.Delete(m.ID, userID)
			}
		}
	}
	for _, content := range insights {
		_ = w.memoryRepo.Create(&domain.Memory{
			ID:         uuid.New().String(),
			UserID:     userID,
			Category:   "behavioral_insight",
			Content:    content,
			Importance: 4,
			Confidence: 0.8,
			CreatedAt:  now,
			UpdatedAt:  now,
		})
	}
	return len(insights), nil
}

// peakCompletionWindow: faixa de 2h com mais conclusões de tarefas.
func peakCompletionWindow(todos []domain.Todo) string {
	buckets := map[int]int{}
	for _, t := range todos {
		if t.Status != domain.TodoStatusCompleted || t.UpdatedAt.IsZero() {
			continue
		}
		h := t.UpdatedAt.Hour()
		buckets[h/2]++
	}
	if len(buckets) == 0 {
		return ""
	}
	best, bestN := 0, 0
	for b, n := range buckets {
		if n > bestN {
			best, bestN = b, n
		}
	}
	if bestN < 2 {
		return ""
	}
	return fmt.Sprintf("Padrão observado: sua maior taxa de conclusão de tarefas acontece entre %02dh e %02dh. Prefira blocos de foco nesse horário.",
		best*2, best*2+2)
}

// procrastinatingCategories: categorias paradas há 3+ dias.
func procrastinatingCategories(todos []domain.Todo, now time.Time) string {
	byCat := map[string]int{}
	for _, t := range todos {
		if t.Status == domain.TodoStatusCompleted {
			continue
		}
		var ref time.Time
		if t.DueDate != nil {
			ref = *t.DueDate
		} else {
			ref = t.CreatedAt
		}
		if ref.IsZero() || now.Sub(ref) < 72*time.Hour {
			continue
		}
		cat := t.Category
		if cat == "" {
			cat = "geral"
		}
		byCat[cat]++
	}
	if len(byCat) == 0 {
		return ""
	}
	type kv struct {
		k string
		v int
	}
	var ranking []kv
	for k, v := range byCat {
		ranking = append(ranking, kv{k, v})
	}
	sort.Slice(ranking, func(i, j int) bool { return ranking[i].v > ranking[j].v })
	return fmt.Sprintf("Padrão observado: tarefas de '%s' costumam ficar paradas por mais de 3 dias (%d acumuladas). Considere quebrar em subtarefas menores.",
		ranking[0].k, ranking[0].v)
}

// busyWeekdays: dias com mais reuniões nos últimos 30 dias.
func busyWeekdays(events []domain.Event) string {
	days := []string{"domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"}
	counts := map[int]int{}
	for _, e := range events {
		counts[int(e.StartAt.Weekday())]++
	}
	if len(counts) == 0 {
		return ""
	}
	best, bestN := 0, 0
	for d, n := range counts {
		if n > bestN {
			best, bestN = d, n
		}
	}
	if bestN < 2 {
		return ""
	}
	return fmt.Sprintf("Padrão observado: %s concentra suas reuniões (%d nos últimos 30 dias). Evite tarefas pesadas nesse dia.",
		days[best], bestN)
}

func (w *BehavioralWorker) Start(userIDs func() []string) {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	w.stopCh = make(chan struct{})
	w.mu.Unlock()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		ticker := time.NewTicker(w.interval)
		defer ticker.Stop()
		for {
			select {
			case <-w.stopCh:
				return
			case tick := <-ticker.C:
				// Janela noturna (03h UTC≈00h BRT): consolidação diária.
				if tick.UTC().Hour() != 3 {
					continue
				}
				for _, uid := range userIDs() {
					if n, err := w.Consolidate(uid); err != nil {
						log.Printf("[BehavioralWorker] Falha ao consolidar %s: %v", uid, err)
					} else if n > 0 {
						log.Printf("[BehavioralWorker] %d insights atualizados para %s.", n, uid)
					}
				}
			}
		}
	}()
}

func (w *BehavioralWorker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	close(w.stopCh)
	w.mu.Unlock()
	w.wg.Wait()
}
