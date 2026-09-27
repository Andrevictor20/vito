package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// AIParsingGateway contrato para desacoplar a IA do serviço.
type AIParsingGateway interface {
	ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error)
}

// AssistantResponse representa o retorno da interação com a secretária Vito.
type AssistantResponse struct {
	Action       ai.IntentAction      `json:"action"`
	Intent       string               `json:"intent,omitempty"`
	Message      string               `json:"message"`
	Reply        string               `json:"reply,omitempty"`
	Event        *domain.Event        `json:"event,omitempty"`
	Conflict     *domain.ConflictInfo `json:"conflict,omitempty"`
	Todo         *domain.Todo         `json:"todo,omitempty"`
	ProviderUsed string               `json:"provider_used,omitempty"`
}

// AssistantService orquestra o parsing de IA com os serviços de calendário, tarefas e memórias.
type AssistantService struct {
	aiGateway  AIParsingGateway
	calSvc     *CalendarService
	todoSvc    *TodoService
	memoryRepo domain.MemoryRepository
}

// NewAssistantService instancia o serviço do assistente.
func NewAssistantService(aiGateway AIParsingGateway, calSvc *CalendarService, todoSvc *TodoService, memoryRepo domain.MemoryRepository) *AssistantService {
	return &AssistantService{
		aiGateway:  aiGateway,
		calSvc:     calSvc,
		todoSvc:    todoSvc,
		memoryRepo: memoryRepo,
	}
}

// Process recebe o input (voz/texto), invoca a IA e aplica a ação no banco de dados.
func (s *AssistantService) Process(ctx context.Context, userID string, input ai.UserInput) (*AssistantResponse, error) {
	if input.Now.IsZero() {
		input.Now = time.Now().UTC()
	}

	// Validação básica de input vazio
	if strings.TrimSpace(input.Text) == "" && input.AudioB64 == "" && input.ImageB64 == "" {
		msg := "Olá! Como posso ajudar com sua agenda ou tarefas hoje?"
		return &AssistantResponse{
			Action:       ai.ActionGeneralChat,
			Intent:       string(ai.ActionGeneralChat),
			Message:      msg,
			Reply:        msg,
			ProviderUsed: "system",
		}, nil
	}

	// Carrega memórias de longo prazo se ainda não informadas
	if len(input.ContextMemories) == 0 && s.memoryRepo != nil {
		if mems, err := s.memoryRepo.ListByUser(userID, 15); err == nil && len(mems) > 0 {
			for _, m := range mems {
				input.ContextMemories = append(input.ContextMemories, fmt.Sprintf("[%s] %s", m.Category, m.Content))
			}
		}
	}

	intent, err := s.aiGateway.ParseIntent(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("falha ao interpretar comando com IA: %w", err)
	}

	res := &AssistantResponse{
		Action:       intent.Action,
		Intent:       string(intent.Action),
		Message:      intent.Message,
		Reply:        intent.Message,
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

	case ai.ActionSaveMemory:
		if s.memoryRepo != nil {
			cat := intent.MemoryCategory
			if cat == "" {
				cat = "geral"
			}
			content := intent.MemoryContent
			if content == "" {
				content = intent.Message
			}

			mem := &domain.Memory{
				ID:        uuid.New().String(),
				UserID:    userID,
				Category:  cat,
				Content:   content,
				CreatedAt: time.Now().UTC(),
				UpdatedAt: time.Now().UTC(),
			}
			if err := s.memoryRepo.Create(mem); err != nil {
				return nil, fmt.Errorf("falha ao salvar memória: %w", err)
			}
			if res.Message == "" {
				res.Message = fmt.Sprintf("Guardei na minha memória: %s", content)
			}
		}
	}

	return res, nil
}
