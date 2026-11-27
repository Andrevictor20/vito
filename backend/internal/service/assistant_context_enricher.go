package service

import (
	"context"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/timeutil"
	"github.com/andrevmp/vito/backend/internal/repository"
	"strings"
	"sync"
	"time"
)

// FormatScheduleLine formata um compromisso da agenda em uma linha legível para o contexto Nível 1.
func FormatScheduleLine(ev domain.Event, loc *time.Location) string {
	evStart, evEnd := ev.StartAt.In(loc), ev.EndAt.In(loc)
	line := fmt.Sprintf("%s (%s, das %s às %s): %s",
		evStart.Format("02/01/2006"),
		timeutil.WeekdayPT(evStart.Weekday()),
		evStart.Format("15:04"),
		evEnd.Format("15:04"),
		ev.Title,
	)
	if strings.TrimSpace(ev.ID) != "" {
		line += fmt.Sprintf(" [ID: %s]", strings.TrimSpace(ev.ID))
	}
	return line
}

// FinanceSnapshotProvider fornece o resumo enxuto Safe-to-Spend e faturas próximas (Plano 05) ao contexto Nível 1.
type FinanceSnapshotProvider interface {
	GetCompactFinanceContext(ctx context.Context, userID string) string
}

// AssistantContextEnricher enriquece o AgentLoop/BeforeModelCallback com o contexto cognitivo de Nível 1
// (perfil permanente, memórias híbridas FTS5+Embeddings, resumos temáticos/episódicos, finanças Safe-to-Spend, agenda e tarefas).
type AssistantContextEnricher struct {
	userRepo        domain.UserRepository
	aiSettingsRepo  domain.AISettingsRepository
	coreProfileRepo domain.CoreProfileRepository
	memoryRepo      domain.MemoryRepository
	hierarchyRepo   *repository.MemoryHierarchyRepository
	entityLinkRepo  *repository.EntityLinkRepository
	financeProvider FinanceSnapshotProvider
	calSvc          CalendarContextLister
	todoSvc         TodoContextLister
	triggerSvc      ActiveTriggerLister
	level1Timeout   time.Duration
}

// CalendarContextLister lista eventos de agenda para enriquecimento de contexto.
type CalendarContextLister interface {
	ListEvents(userID string, start, end time.Time) ([]domain.Event, error)
}

// TodoContextLister lista tarefas pendentes para enriquecimento de contexto.
type TodoContextLister interface {
	ListTodos(userID string, status domain.TodoStatus) ([]domain.Todo, error)
}

// ActiveTriggerLister lista gatilhos/bots ativos para enriquecimento de contexto.
type ActiveTriggerLister interface {
	ListTriggers(userID string, category domain.TriggerCategory, status domain.TriggerStatus) ([]domain.Trigger, error)
}

// NewAssistantContextEnricher instancia o enriquecedor de contexto do agente.
func NewAssistantContextEnricher(
	userRepo domain.UserRepository,
	aiSettingsRepo domain.AISettingsRepository,
	coreProfileRepo domain.CoreProfileRepository,
	memoryRepo domain.MemoryRepository,
	calSvc CalendarContextLister,
	todoSvc TodoContextLister,
	triggerSvc ActiveTriggerLister,
) *AssistantContextEnricher {
	return &AssistantContextEnricher{
		userRepo:        userRepo,
		aiSettingsRepo:  aiSettingsRepo,
		coreProfileRepo: coreProfileRepo,
		memoryRepo:      memoryRepo,
		calSvc:          calSvc,
		todoSvc:         todoSvc,
		triggerSvc:      triggerSvc,
		level1Timeout:   400 * time.Millisecond,
	}
}

// SetLevel1Timeout configura o timeout do enriquecimento paralelo Nível 1 (padrão 400ms em produção).
func (e *AssistantContextEnricher) SetLevel1Timeout(d time.Duration) {
	if d > 0 {
		e.level1Timeout = d
	}
}

// SetMemoryHierarchyRepository conecta os resumos temáticos e episódios consolidados (#s-memory).
func (e *AssistantContextEnricher) SetMemoryHierarchyRepository(repo *repository.MemoryHierarchyRepository) {
	e.hierarchyRepo = repo
}

// SetFinanceSnapshotProvider conecta o provedor de snapshot financeiro enxuto (Safe-to-Spend).
func (e *AssistantContextEnricher) SetFinanceSnapshotProvider(provider FinanceSnapshotProvider) {
	e.financeProvider = provider
}

func runEnrichTask(wg *sync.WaitGroup, ctx context.Context, fn func()) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		select {
		case <-ctx.Done():
			return
		default:
			fn()
		}
	}()
}

func appendContextSection(sb *strings.Builder, header string, lines []string) {
	if len(lines) == 0 {
		return
	}
	sb.WriteString("\n" + header + "\n")
	for _, line := range lines {
		sb.WriteString(fmt.Sprintf("  - %s\n", line))
	}
}

func (e *AssistantContextEnricher) collectCoreProfile(userID string) []string {
	items, err := e.coreProfileRepo.GetAll(userID)
	if err != nil || len(items) == 0 {
		return nil
	}
	var out []string
	for _, it := range items {
		k, v := strings.TrimSpace(it.Key), strings.TrimSpace(it.Value)
		if k != "" && v != "" {
			out = append(out, fmt.Sprintf("%s: %s", k, v))
		}
	}
	return out
}

func (e *AssistantContextEnricher) collectMemories(userID, userMessage string) []string {
	mems, err := e.memoryRepo.SearchRelevant(userID, userMessage, 6)
	if err != nil || len(mems) == 0 {
		return nil
	}
	var out []string
	for _, m := range mems {
		if strings.TrimSpace(m.Content) == "" {
			continue
		}
		cat := m.Category
		if cat == "" {
			cat = "fato"
		}
		out = append(out, fmt.Sprintf("[%s] %s", cat, m.Content))
	}
	return out
}

func (e *AssistantContextEnricher) collectThemes(ctx context.Context, userID string) []string {
	themes, err := e.hierarchyRepo.ListThematicSummaries(ctx, userID)
	if err != nil || len(themes) == 0 {
		return nil
	}
	limit := min(len(themes), 3)
	var out []string
	for _, th := range themes[:limit] {
		if strings.TrimSpace(th.ConsolidatedSummary) != "" {
			out = append(out, fmt.Sprintf("[%s] %s", th.ThemeTitle, th.ConsolidatedSummary))
		}
	}
	return out
}

func (e *AssistantContextEnricher) collectUpcomingEvents(userID string, now time.Time, loc *time.Location) []string {
	start := now.In(loc)
	events, err := e.calSvc.ListEvents(userID, start, start.Add(7*24*time.Hour))
	if err != nil || len(events) == 0 {
		return nil
	}
	limit := min(len(events), 5)
	out := make([]string, 0, limit)
	for _, ev := range events[:limit] {
		out = append(out, FormatScheduleLine(ev, loc))
	}
	return out
}

func (e *AssistantContextEnricher) collectPendingTodos(userID string) []string {
	todos, err := e.todoSvc.ListTodos(userID, domain.TodoStatusPending)
	if err != nil || len(todos) == 0 {
		return nil
	}
	limit := min(len(todos), 5)
	out := make([]string, 0, limit)
	for _, td := range todos[:limit] {
		prio := strings.ToUpper(string(td.Priority))
		if prio == "" {
			prio = "MÉDIA"
		}
		out = append(out, fmt.Sprintf("[%s] %s", prio, td.Title))
	}
	return out
}

func (e *AssistantContextEnricher) collectActiveTriggers(userID string) []string {
	trs, err := e.triggerSvc.ListTriggers(userID, "", domain.TriggerStatusActive)
	if err != nil || len(trs) == 0 {
		return nil
	}
	limit := min(len(trs), 4)
	out := make([]string, 0, limit)
	for _, tr := range trs[:limit] {
		out = append(out, fmt.Sprintf("[%s] %s", tr.Category, tr.Title))
	}
	return out
}

// BuildLevel1Context constrói o bloco de contexto essencial em paralelo com timeout estrito de 400ms.
func (e *AssistantContextEnricher) BuildLevel1Context(ctx context.Context, userID, userMessage string, now time.Time) string {
	if strings.TrimSpace(userID) == "" {
		return ""
	}

	timeout := e.level1Timeout
	if timeout <= 0 {
		timeout = 400 * time.Millisecond
	}
	enrichCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	loc := timeutil.SaoPauloLocation()
	var (
		coreProfileLines, memoryLines, themeLines, entityLines []string
		scheduleLines, todoLines, triggerLines                 []string
		financeLine                                            string
		wg                                                     sync.WaitGroup
	)

	if e.coreProfileRepo != nil {
		runEnrichTask(&wg, enrichCtx, func() { coreProfileLines = e.collectCoreProfile(userID) })
	}
	if e.memoryRepo != nil && strings.TrimSpace(userMessage) != "" {
		runEnrichTask(&wg, enrichCtx, func() { memoryLines = e.collectMemories(userID, userMessage) })
	}
	if e.hierarchyRepo != nil {
		runEnrichTask(&wg, enrichCtx, func() { themeLines = e.collectThemes(enrichCtx, userID) })
	}
	if e.entityLinkRepo != nil && strings.TrimSpace(userMessage) != "" {
		runEnrichTask(&wg, enrichCtx, func() { entityLines = e.resolveEntityLinksInMessage(enrichCtx, userID, userMessage) })
	}
	if e.financeProvider != nil && isFinanceRelevantQuery(userMessage) {
		runEnrichTask(&wg, enrichCtx, func() {
			financeLine = strings.TrimSpace(e.financeProvider.GetCompactFinanceContext(enrichCtx, userID))
		})
	}
	if e.calSvc != nil {
		runEnrichTask(&wg, enrichCtx, func() { scheduleLines = e.collectUpcomingEvents(userID, now, loc) })
	}
	if e.todoSvc != nil {
		runEnrichTask(&wg, enrichCtx, func() { todoLines = e.collectPendingTodos(userID) })
	}
	if e.triggerSvc != nil {
		runEnrichTask(&wg, enrichCtx, func() { triggerLines = e.collectActiveTriggers(userID) })
	}

	wg.Wait()

	if len(coreProfileLines) == 0 && len(memoryLines) == 0 && len(themeLines) == 0 && len(entityLines) == 0 && financeLine == "" && len(scheduleLines) == 0 && len(todoLines) == 0 && len(triggerLines) == 0 {
		return ""
	}

	var sb strings.Builder
	sb.WriteString("### CONTEXTO PESSOAL E OPERACIONAL DO USUÁRIO (NÍVEL 1)\n")
	sb.WriteString("Você já conhece os seguintes dados reais sobre o usuário e sua rotina atual:\n")
	appendContextSection(&sb, "* Perfil Permanente do Usuário:", coreProfileLines)
	appendContextSection(&sb, "* Memórias Pessoais e Fatos Relevantes:", memoryLines)
	appendContextSection(&sb, "* Resumos Temáticos Consolidados:", themeLines)
	appendContextSection(&sb, "* Entidades Vinculadas (Cross-Canal):", entityLines)
	if financeLine != "" {
		appendContextSection(&sb, "* Snapshot Financeiro (Safe-to-Spend):", []string{financeLine})
	}
	appendContextSection(&sb, "* Próximos Compromissos na Agenda:", scheduleLines)
	appendContextSection(&sb, "* Tarefas Pendentes Prioritárias:", todoLines)
	appendContextSection(&sb, "* Vigílias e Radares Ativos:", triggerLines)
	sb.WriteString("\nDIRETRIZ DE USO DESTE CONTEXTO: Utilize estes dados diretamente para responder perguntas pessoais, sobre sua rotina, compromissos ou tarefas com calor humano e precisão, SEM precisar chamar ferramentas para o que já consta acima.\n")

	return sb.String()
}

func isFinanceRelevantQuery(msg string) bool {
	lower := strings.ToLower(msg)
	cues := []string{"gasto", "finanç", "financ", "saldo", "fatura", "cartão", "cartao", "orçamento", "orcamento", "comprar", "dinheiro", "pagar", "pix", "conta"}
	for _, c := range cues {
		if strings.Contains(lower, c) {
			return true
		}
	}
	return false
}
