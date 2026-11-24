package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// FormatScheduleLine formata um compromisso da agenda em uma linha legível para o contexto Nível 1.
func FormatScheduleLine(ev domain.Event, loc *time.Location) string {
	evStart, evEnd := ev.StartAt.In(loc), ev.EndAt.In(loc)
	line := fmt.Sprintf("%s (%s, das %s às %s): %s",
		evStart.Format("02/01/2006"),
		ai.WeekdayPT(evStart.Weekday()),
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

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}

	var (
		coreProfileLines []string
		memoryLines      []string
		themeLines       []string
		entityLines      []string
		financeLine      string
		scheduleLines    []string
		todoLines        []string
		triggerLines     []string
		wg               sync.WaitGroup
	)

	// 1. Core Profile
	if e.coreProfileRepo != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case <-enrichCtx.Done():
				return
			default:
				if items, err := e.coreProfileRepo.GetAll(userID); err == nil && len(items) > 0 {
					for _, it := range items {
						k := strings.TrimSpace(it.Key)
						v := strings.TrimSpace(it.Value)
						if k != "" && v != "" {
							coreProfileLines = append(coreProfileLines, fmt.Sprintf("%s: %s", k, v))
						}
					}
				}
			}
		}()
	}

	// 2. Memórias de Longo Prazo Relevantes (Busca Híbrida FTS5 + Embeddings)
	if e.memoryRepo != nil && strings.TrimSpace(userMessage) != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case <-enrichCtx.Done():
				return
			default:
				if mems, err := e.memoryRepo.SearchRelevant(userID, userMessage, 6); err == nil && len(mems) > 0 {
					for _, m := range mems {
						if strings.TrimSpace(m.Content) != "" {
							cat := m.Category
							if cat == "" {
								cat = "fato"
							}
							memoryLines = append(memoryLines, fmt.Sprintf("[%s] %s", cat, m.Content))
						}
					}
				}
			}
		}()
	}

	// 2.5 Resumos Temáticos e Episódios Relevantes (#s-memory)
	if e.hierarchyRepo != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case <-enrichCtx.Done():
				return
			default:
				if themes, err := e.hierarchyRepo.ListThematicSummaries(enrichCtx, userID); err == nil && len(themes) > 0 {
					limit := 3
					if len(themes) < limit {
						limit = len(themes)
					}
					for _, th := range themes[:limit] {
						if strings.TrimSpace(th.ConsolidatedSummary) != "" {
							themeLines = append(themeLines, fmt.Sprintf("[%s] %s", th.ThemeTitle, th.ConsolidatedSummary))
						}
					}
				}
			}
		}()
	}

	// 2.6 Entidades Vinculadas (entity_links cross-canal na 036)
	if e.entityLinkRepo != nil && strings.TrimSpace(userMessage) != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case <-enrichCtx.Done():
				return
			default:
				entityLines = e.resolveEntityLinksInMessage(enrichCtx, userID, userMessage)
			}
		}()
	}

	// 2.8 Snapshot Financeiro Enxuto (Safe-to-Spend) apenas quando relevante à intenção
	if e.financeProvider != nil && isFinanceRelevantQuery(userMessage) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case <-enrichCtx.Done():
				return
			default:
				financeLine = strings.TrimSpace(e.financeProvider.GetCompactFinanceContext(enrichCtx, userID))
			}
		}()
	}

	// 3. Agenda dos Próximos Dias (Próximos 5 compromissos)
	if e.calSvc != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case <-enrichCtx.Done():
				return
			default:
				start := now.In(loc)
				end := start.Add(7 * 24 * time.Hour)
				if events, err := e.calSvc.ListEvents(userID, start, end); err == nil && len(events) > 0 {
					limit := 5
					if len(events) < limit {
						limit = len(events)
					}
					for _, ev := range events[:limit] {
						line := FormatScheduleLine(ev, loc)
						scheduleLines = append(scheduleLines, line)
					}
				}
			}
		}()
	}

	// 4. Tarefas Prioritárias Pendentes (Top 5)
	if e.todoSvc != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case <-enrichCtx.Done():
				return
			default:
				if todos, err := e.todoSvc.ListTodos(userID, domain.TodoStatusPending); err == nil && len(todos) > 0 {
					limit := 5
					if len(todos) < limit {
						limit = len(todos)
					}
					for _, t := range todos[:limit] {
						prio := strings.ToUpper(string(t.Priority))
						if prio == "" {
							prio = "MÉDIA"
						}
						todoLines = append(todoLines, fmt.Sprintf("[%s] %s", prio, t.Title))
					}
				}
			}
		}()
	}

	// 5. Vigílias e Radares Ativos
	if e.triggerSvc != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case <-enrichCtx.Done():
				return
			default:
				if trs, err := e.triggerSvc.ListTriggers(userID, "", domain.TriggerStatusActive); err == nil && len(trs) > 0 {
					limit := 4
					if len(trs) < limit {
						limit = len(trs)
					}
					for _, tr := range trs[:limit] {
						triggerLines = append(triggerLines, fmt.Sprintf("[%s] %s", tr.Category, tr.Title))
					}
				}
			}
		}()
	}

	wg.Wait()

	if len(coreProfileLines) == 0 && len(memoryLines) == 0 && len(themeLines) == 0 && len(entityLines) == 0 && financeLine == "" && len(scheduleLines) == 0 && len(todoLines) == 0 && len(triggerLines) == 0 {
		return ""
	}

	var sb strings.Builder
	sb.WriteString("### CONTEXTO PESSOAL E OPERACIONAL DO USUÁRIO (NÍVEL 1)\n")
	sb.WriteString("Você já conhece os seguintes dados reais sobre o usuário e sua rotina atual:\n")

	if len(coreProfileLines) > 0 {
		sb.WriteString("\n* Perfil Permanente do Usuário:\n")
		for _, line := range coreProfileLines {
			sb.WriteString(fmt.Sprintf("  - %s\n", line))
		}
	}

	if len(memoryLines) > 0 {
		sb.WriteString("\n* Memórias Pessoais e Fatos Relevantes:\n")
		for _, line := range memoryLines {
			sb.WriteString(fmt.Sprintf("  - %s\n", line))
		}
	}

	if len(themeLines) > 0 {
		sb.WriteString("\n* Resumos Temáticos Consolidados:\n")
		for _, line := range themeLines {
			sb.WriteString(fmt.Sprintf("  - %s\n", line))
		}
	}

	if len(entityLines) > 0 {
		sb.WriteString("\n* Entidades Vinculadas (Cross-Canal):\n")
		for _, line := range entityLines {
			sb.WriteString(fmt.Sprintf("  - %s\n", line))
		}
	}

	if financeLine != "" {
		sb.WriteString("\n* Snapshot Financeiro (Safe-to-Spend):\n")
		sb.WriteString(fmt.Sprintf("  - %s\n", financeLine))
	}

	if len(scheduleLines) > 0 {
		sb.WriteString("\n* Próximos Compromissos na Agenda:\n")
		for _, line := range scheduleLines {
			sb.WriteString(fmt.Sprintf("  - %s\n", line))
		}
	}

	if len(todoLines) > 0 {
		sb.WriteString("\n* Tarefas Pendentes Prioritárias:\n")
		for _, line := range todoLines {
			sb.WriteString(fmt.Sprintf("  - %s\n", line))
		}
	}

	if len(triggerLines) > 0 {
		sb.WriteString("\n* Vigílias e Radares Ativos:\n")
		for _, line := range triggerLines {
			sb.WriteString(fmt.Sprintf("  - %s\n", line))
		}
	}

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
