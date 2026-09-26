package service

import (
	"context"
	"fmt"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// AIParsingGateway contrato para desacoplar a IA do serviço.
type AIParsingGateway interface {
	ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error)
}

// AssistantResponse representa o retorno da interação com a secretária Kito.
type AssistantResponse struct {
	Action       ai.IntentAction      `json:"action"`
	Message      string               `json:"message"`
	Event        *domain.Event        `json:"event,omitempty"`
	Conflict     *domain.ConflictInfo `json:"conflict,omitempty"`
	Todo         *domain.Todo         `json:"todo,omitempty"`
	ProviderUsed string               `json:"provider_used,omitempty"`
}

// AssistantService orquestra o parsing de IA com os serviços de calendário e tarefas.
type AssistantService struct {
	aiGateway AIParsingGateway
	calSvc    *CalendarService
	todoSvc   *TodoService
}

// NewAssistantService instancia o serviço do assistente.
func NewAssistantService(aiGateway AIParsingGateway, calSvc *CalendarService, todoSvc *TodoService) *AssistantService {
	return &AssistantService{
		aiGateway: aiGateway,
		calSvc:    calSvc,
		todoSvc:   todoSvc,
	}
}

// Process recebe o input (voz/texto), invoca a IA e aplica a ação no banco de dados.
func (s *AssistantService) Process(ctx context.Context, userID string, input ai.UserInput) (*AssistantResponse, error) {
	if input.Now.IsZero() {
		input.Now = time.Now().UTC()
	}

	intent, err := s.aiGateway.ParseIntent(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("falha ao interpretar comando com IA: %w", err)
	}

	res := &AssistantResponse{
		Action:       intent.Action,
		Message:      intent.Message,
		ProviderUsed: intent.ProviderUsed,
	}

	switch intent.Action {
	case ai.ActionCreateEvent:
		if intent.Event != nil {
			event, conflict, err := s.calSvc.CreateEvent(
				userID,
				intent.Event.Title,
				intent.Event.Description,
				intent.Event.Location,
				intent.Event.StartAt,
				intent.Event.EndAt,
			)
			if err != nil {
				return nil, fmt.Errorf("falha ao criar evento: %w", err)
			}

			res.Event = event
			res.Conflict = conflict
			if conflict != nil && conflict.HasConflict {
				res.Message += fmt.Sprintf(" ⚠️ Atenção: você já tem '%s' agendado nesse horário!", conflict.ConflictingTitle)
			}
		}

	case ai.ActionCreateTodo:
		if intent.Todo != nil {
			todo, err := s.todoSvc.CreateTodo(
				userID,
				intent.Todo.Title,
				intent.Todo.Priority,
				intent.Todo.DueDate,
			)
			if err != nil {
				return nil, fmt.Errorf("falha ao criar tarefa: %w", err)
			}
			res.Todo = todo
		}

	case ai.ActionQuerySchedule:
		from := input.Now.Truncate(24 * time.Hour)
		to := from.Add(24 * time.Hour)
		events, err := s.calSvc.ListEvents(userID, from, to)
		if err == nil {
			if len(events) == 0 {
				res.Message = "Você não tem nenhum compromisso agendado para hoje."
			} else {
				res.Message = fmt.Sprintf("Você tem %d compromisso(s) para hoje.", len(events))
			}
		}
	}

	return res, nil
}
