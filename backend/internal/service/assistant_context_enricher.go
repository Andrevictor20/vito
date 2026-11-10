package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/assistant"
)

// AssistantContextEnricher enriquece o AgentLoop com o contexto cognitivo de Nível 1
// (perfil permanente, memórias semânticas relevantes, agenda e tarefas prioritárias).
type AssistantContextEnricher struct {
	userRepo        domain.UserRepository
	aiSettingsRepo  domain.AISettingsRepository
	coreProfileRepo domain.CoreProfileRepository
	memoryRepo      domain.MemoryRepository
	calSvc          *CalendarService
	todoSvc         *TodoService
	triggerSvc      *TriggerService
}

// NewAssistantContextEnricher instancia o enriquecedor de contexto do agente.
func NewAssistantContextEnricher(
	userRepo domain.UserRepository,
	aiSettingsRepo domain.AISettingsRepository,
	coreProfileRepo domain.CoreProfileRepository,
	memoryRepo domain.MemoryRepository,
	calSvc *CalendarService,
	todoSvc *TodoService,
	triggerSvc *TriggerService,
) *AssistantContextEnricher {
	return &AssistantContextEnricher{
		userRepo:        userRepo,
		aiSettingsRepo:  aiSettingsRepo,
		coreProfileRepo: coreProfileRepo,
		memoryRepo:      memoryRepo,
		calSvc:          calSvc,
		todoSvc:         todoSvc,
		triggerSvc:      triggerSvc,
	}
}

// BuildLevel1Context constrói o bloco de contexto essencial em paralelo com timeout estrito de 400ms.
func (e *AssistantContextEnricher) BuildLevel1Context(ctx context.Context, userID, userMessage string, now time.Time) string {
	if strings.TrimSpace(userID) == "" {
		return ""
	}

	enrichCtx, cancel := context.WithTimeout(ctx, 400*time.Millisecond)
	defer cancel()

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}

	var (
		coreProfileLines []string
		memoryLines      []string
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

	// 2. Memórias de Longo Prazo Relevantes
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
						line := assistant.FormatScheduleLine(ev, loc)
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

	if len(coreProfileLines) == 0 && len(memoryLines) == 0 && len(scheduleLines) == 0 && len(todoLines) == 0 && len(triggerLines) == 0 {
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
