package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// executeUpdateTodo atualiza prazo, prioridade, horário ou título de uma tarefa.
func (s *AssistantService) executeUpdateTodo(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.todoSvc == nil || intent.TodoUpdate == nil || strings.TrimSpace(intent.TodoUpdate.TargetQuery) == "" {
		return clarificationResponse(intent, "Qual tarefa você deseja alterar? Me diga o nome ou prazo."), nil
	}

	target := strings.TrimSpace(intent.TodoUpdate.TargetQuery)
	cleanID := normalizeTargetID(target)

	// Busca na lista de pendentes primeiro
	todos, _ := s.todoSvc.ListTodos(userID, domain.TodoStatusPending)
	var matched *domain.Todo
	for i := range todos {
		if todos[i].ID == cleanID || strings.Contains(strings.ToLower(todos[i].Title), strings.ToLower(target)) {
			matched = &todos[i]
			break
		}
	}

	// Se não achou em pendentes, busca em concluídas
	if matched == nil {
		doneTodos, _ := s.todoSvc.ListTodos(userID, domain.TodoStatusCompleted)
		for i := range doneTodos {
			if doneTodos[i].ID == cleanID || strings.Contains(strings.ToLower(doneTodos[i].Title), strings.ToLower(target)) {
				matched = &doneTodos[i]
				break
			}
		}
	}

	if matched == nil {
		res.Message = fmt.Sprintf("Não encontrei a tarefa '%s'.", target)
		res.Reply = res.Message
		return res, nil
	}

	updateInput := domain.UpdateTodoInput{}
	if intent.TodoUpdate.Title != "" {
		updateInput.Title = &intent.TodoUpdate.Title
	}
	if intent.TodoUpdate.Priority != "" {
		updateInput.Priority = &intent.TodoUpdate.Priority
	}
	if intent.TodoUpdate.DueDate != nil {
		updateInput.DueDate = intent.TodoUpdate.DueDate
	}
	if intent.TodoUpdate.RemindAt != nil {
		updateInput.RemindAt = intent.TodoUpdate.RemindAt
	}
	if intent.TodoUpdate.RemindRepeat != "" {
		updateInput.RemindRepeat = &intent.TodoUpdate.RemindRepeat
	}
	if intent.TodoUpdate.RemindAdvanceMinutes > 0 {
		updateInput.RemindAdvance = &intent.TodoUpdate.RemindAdvanceMinutes
	}

	updated, err := s.todoSvc.UpdateTodo(matched.ID, userID, updateInput)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui atualizar a tarefa '%s' (%v).", matched.Title, err)
		res.Reply = res.Message
		return res, nil
	}

	res.Todo = updated
	if res.Message == "" {
		res.Message = fmt.Sprintf("Pronto! Atualizei a tarefa '%s'.", updated.Title)
	}
	res.Reply = res.Message
	return res, nil
}

// executeUpdateTrigger pausa, retoma ou altera horários e frequências de um radar.
func (s *AssistantService) executeUpdateTrigger(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.triggerSvc == nil || intent.TriggerUpdate == nil || strings.TrimSpace(intent.TriggerUpdate.TargetQuery) == "" {
		return clarificationResponse(intent, "Qual radar você deseja atualizar ou pausar? Me diga o nome da vigília."), nil
	}

	target := strings.TrimSpace(intent.TriggerUpdate.TargetQuery)
	cleanID := normalizeTargetID(target)

	triggers, err := s.triggerSvc.ListTriggers(userID, "", "")
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui buscar suas vigílias (%v).", err)
		res.Reply = res.Message
		return res, nil
	}

	var matched *domain.Trigger
	for i := range triggers {
		if triggers[i].ID == cleanID || strings.Contains(strings.ToLower(triggers[i].Title), strings.ToLower(target)) {
			matched = &triggers[i]
			break
		}
	}

	if matched == nil {
		res.Message = fmt.Sprintf("Não encontrei a vigília '%s'.", target)
		res.Reply = res.Message
		return res, nil
	}

	// Pausar ou retomar vigília
	if intent.TriggerUpdate.IsActive != nil {
		desiredActive := *intent.TriggerUpdate.IsActive
		currentActive := matched.Status == domain.TriggerStatusActive
		if desiredActive != currentActive {
			toggled, err := s.triggerSvc.ToggleStatus(matched.ID, userID)
			if err == nil && toggled != nil {
				matched = toggled
			}
		}
	}

	// Atualizar outros campos se especificados
	if intent.TriggerUpdate.ScheduledTime != "" || intent.TriggerUpdate.Frequency != "" || intent.TriggerUpdate.Title != "" {
		uInput := domain.UpdateTriggerInput{}
		if intent.TriggerUpdate.Title != "" {
			uInput.Title = &intent.TriggerUpdate.Title
		}
		if intent.TriggerUpdate.ScheduledTime != "" {
			uInput.ScheduledTime = &intent.TriggerUpdate.ScheduledTime
		}
		if intent.TriggerUpdate.Frequency != "" {
			freq := domain.TriggerFrequency(intent.TriggerUpdate.Frequency)
			uInput.Frequency = &freq
		}
		if intent.TriggerUpdate.TargetValue != "" {
			uInput.TargetValue = &intent.TriggerUpdate.TargetValue
		}
		updated, err := s.triggerSvc.UpdateTrigger(matched.ID, userID, uInput)
		if err == nil && updated != nil {
			matched = updated
		}
	}

	res.Trigger = matched
	if res.Message == "" {
		if matched.Status == domain.TriggerStatusActive {
			res.Message = fmt.Sprintf("Vigília '%s' atualizada e ativa.", matched.Title)
		} else {
			res.Message = fmt.Sprintf("Vigília '%s' pausada.", matched.Title)
		}
	}
	res.Reply = res.Message
	return res, nil
}

// executeDeleteTrigger exclui um radar.
func (s *AssistantService) executeDeleteTrigger(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.triggerSvc == nil || intent.TriggerDelete == nil || strings.TrimSpace(intent.TriggerDelete.TargetQuery) == "" {
		return clarificationResponse(intent, "Qual vigília você deseja excluir? Me diga o nome do radar."), nil
	}

	target := strings.TrimSpace(intent.TriggerDelete.TargetQuery)
	cleanID := normalizeTargetID(target)

	triggers, err := s.triggerSvc.ListTriggers(userID, "", "")
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui buscar suas vigílias (%v).", err)
		res.Reply = res.Message
		return res, nil
	}

	var matched *domain.Trigger
	for i := range triggers {
		if triggers[i].ID == cleanID || strings.Contains(strings.ToLower(triggers[i].Title), strings.ToLower(target)) {
			matched = &triggers[i]
			break
		}
	}

	if matched == nil {
		res.Message = fmt.Sprintf("Não encontrei a vigília '%s'.", target)
		res.Reply = res.Message
		return res, nil
	}

	if err := s.triggerSvc.DeleteTrigger(matched.ID, userID); err != nil {
		res.Message = fmt.Sprintf("Não consegui excluir a vigília '%s' (%v).", matched.Title, err)
		res.Reply = res.Message
		return res, nil
	}

	if res.Message == "" {
		res.Message = fmt.Sprintf("Vigília '%s' excluída.", matched.Title)
	}
	res.Reply = res.Message
	return res, nil
}

// executeDeleteBooking exclui um link de agendamento do Vito Booking.
func (s *AssistantService) executeDeleteBooking(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.bookingSvc == nil || intent.BookingDelete == nil || strings.TrimSpace(intent.BookingDelete.TargetQuery) == "" {
		return clarificationResponse(intent, "Qual link de agendamento você deseja excluir? Me diga o nome ou duração."), nil
	}

	target := strings.TrimSpace(intent.BookingDelete.TargetQuery)
	cleanID := normalizeTargetID(target)

	bts, err := s.bookingSvc.ListBookingTypes(ctx, userID)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui buscar seus links de agendamento (%v).", err)
		res.Reply = res.Message
		return res, nil
	}

	var matchedID string
	var matchedTitle string
	for i := range bts {
		b := &bts[i]
		if b.ID == cleanID || strings.EqualFold(b.Slug, target) || strings.Contains(strings.ToLower(b.Title), strings.ToLower(target)) {
			matchedID = b.ID
			matchedTitle = b.Title
			break
		}
	}

	if matchedID == "" {
		res.Message = fmt.Sprintf("Não encontrei o link de agendamento '%s'.", target)
		res.Reply = res.Message
		return res, nil
	}

	_, err = s.bookingSvc.DeleteBookingType(ctx, userID, matchedID)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui excluir o link '%s' (%v).", matchedTitle, err)
		res.Reply = res.Message
		return res, nil
	}

	if res.Message == "" {
		res.Message = fmt.Sprintf("Link de agendamento '%s' excluído.", matchedTitle)
	}
	res.Reply = res.Message
	return res, nil
}

// executeUpdateProfile atualiza dados do perfil (telefone, nome, autonomia).
func (s *AssistantService) executeUpdateProfile(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.ProfileUpdate == nil {
		return clarificationResponse(intent, "O que deseja atualizar no seu perfil? (ex: 'muda meu telefone para (98) 98441-7165' ou 'muda autonomia para proativo')."), nil
	}

	var updatedFields []string

	// Atualizar telefone
	if intent.ProfileUpdate.Phone != "" && s.userRepo != nil {
		if err := s.userRepo.UpdatePhone(userID, intent.ProfileUpdate.Phone); err == nil {
			updatedFields = append(updatedFields, fmt.Sprintf("telefone atualizado para %s", intent.ProfileUpdate.Phone))
		}
	}

	// Atualizar modo de autonomia
	if intent.ProfileUpdate.AutonomyMode != "" && s.aiSettingsRepo != nil {
		settings, err := s.aiSettingsRepo.GetSettings(userID)
		if err != nil || settings == nil {
			settings = domain.DefaultAISettings(userID)
		}
		mode := strings.ToLower(strings.TrimSpace(intent.ProfileUpdate.AutonomyMode))
		if mode == "proactive" || mode == "proativo" || mode == "nível 3" || mode == "nivel 3" {
			settings.AutonomyMode = domain.AutonomyModeProactive
			updatedFields = append(updatedFields, "autonomia configurada para Proativo (Nível 3)")
		} else {
			settings.AutonomyMode = domain.AutonomyModeAssisted
			updatedFields = append(updatedFields, "autonomia configurada para Assistido (Nível 1/2)")
		}
		_ = s.aiSettingsRepo.UpsertSettings(settings)
	}

	if len(updatedFields) == 0 {
		res.Message = "Não identifiquei campos válidos para atualizar no perfil."
	} else {
		res.Message = fmt.Sprintf("Pronto! %s.", strings.Join(updatedFields, " e "))
	}
	res.Reply = res.Message
	return res, nil
}
