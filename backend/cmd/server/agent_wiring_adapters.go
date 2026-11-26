package main

import (
	"github.com/andrevmp/vito/backend/internal/gmail"
	"context"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"strings"
	"time"
	"unicode"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

type calendarServiceAdapter struct {
	svc *calendar.CalendarService
}

func (a *calendarServiceAdapter) GetEvents(ctx context.Context, userID string, start, end time.Time) ([]*domain.Event, error) {
	events, err := a.svc.ListEvents(userID, start, end)
	if err != nil {
		return nil, err
	}
	var res []*domain.Event
	for i := range events {
		res = append(res, &events[i])
	}
	return res, nil
}

func (a *calendarServiceAdapter) CreateEvent(ctx context.Context, event *domain.Event) error {
	_, err := a.CreateEventWithConflict(ctx, event)
	return err
}

func (a *calendarServiceAdapter) CreateEventWithConflict(ctx context.Context, event *domain.Event) (*domain.ConflictInfo, error) {
	created, conflict, err := a.svc.CreateEvent(event.UserID, event.Title, event.Description, event.Location, event.StartAt, event.EndAt)
	if err != nil {
		return nil, err
	}
	if created != nil {
		*event = *created
	}
	return conflict, nil
}

func (a *calendarServiceAdapter) DeleteEvent(ctx context.Context, id, userID string) error {
	return a.svc.DeleteEvent(id, userID)
}

type todoServiceAdapter struct {
	svc *tasks.TodoService
}

func (a *todoServiceAdapter) GetTodos(ctx context.Context, userID string) ([]*domain.Todo, error) {
	todos, err := a.svc.ListTodos(userID, "")
	if err != nil {
		return nil, err
	}
	var res []*domain.Todo
	for i := range todos {
		res = append(res, &todos[i])
	}
	return res, nil
}

func (a *todoServiceAdapter) CreateTodo(ctx context.Context, todo *domain.Todo) error {
	created, err := a.svc.CreateTodo(todo.UserID, todo.Title, string(todo.Priority), todo.DueDate)
	if err != nil {
		return err
	}
	if created != nil {
		*todo = *created
	}
	return nil
}

func (a *todoServiceAdapter) CompleteTodo(ctx context.Context, id, userID string) error {
	return a.svc.CompleteTodo(id, userID)
}

func (a *todoServiceAdapter) DeleteTodo(ctx context.Context, id, userID string) error {
	return a.svc.DeleteTodo(id, userID)
}

type whatsAppServiceAdapter struct {
	svc *whatsapp.WhatsAppService
	dir *whatsapp.WhatsAppDirectoryService
}

func (a *whatsAppServiceAdapter) SendMessage(ctx context.Context, userID, phone, message string) error {
	target := strings.TrimSpace(phone)
	if target == "" {
		return fmt.Errorf("destinatário do WhatsApp é obrigatório")
	}

	if strings.Contains(target, "@s.whatsapp.net") || strings.Contains(target, "@g.us") {
		return a.svc.SendWhatsAppMessage(ctx, userID, whatsapp.NormalizeJIDForSend(target), message)
	}

	digits := 0
	for _, r := range target {
		if unicode.IsDigit(r) {
			digits++
		}
	}
	if digits >= 8 {
		normalized := domain.NormalizePhone(target)
		if normalized != "" {
			cleanDigits := strings.TrimPrefix(normalized, "+")
			return a.svc.SendWhatsAppMessage(ctx, userID, cleanDigits+"@s.whatsapp.net", message)
		}
	}

	if a.dir != nil {
		chat, err := a.dir.ResolveChat(ctx, userID, target)
		if err == nil && chat != nil && chat.ChatJID != "" {
			return a.svc.SendWhatsAppMessage(ctx, userID, whatsapp.NormalizeJIDForSend(chat.ChatJID), message)
		}
	}

	return fmt.Errorf("contato %q não encontrado na sua agenda do WhatsApp. Por favor, confirme o número com DDD", target)
}

func (a *whatsAppServiceAdapter) SearchMessages(ctx context.Context, userID, query string, limit int) ([]domain.WhatsAppConversationMessage, error) {
	if a.dir != nil {
		return a.dir.SearchMessages(ctx, userID, query, limit)
	}
	return nil, nil
}

func (a *whatsAppServiceAdapter) RecentChats(ctx context.Context, userID string) ([]ai.ChatContactSummary, error) {
	if a.dir != nil {
		return a.dir.Directory(ctx, userID)
	}
	return nil, nil
}

type gmailServiceAdapter struct {
	svc *gmail.GmailService
}

func (a *gmailServiceAdapter) SendEmail(ctx context.Context, userID, to, subject, body string) error {
	cleanSubj := strings.TrimSpace(subject)
	if cleanSubj == "" {
		cleanSubj = "Mensagem enviada pelo Vito"
	}
	_, err := a.svc.SendEmail(ctx, userID, to, cleanSubj, body)
	return err
}

func (a *gmailServiceAdapter) CreateDraft(ctx context.Context, userID, to, subject, body string) error {
	_, err := a.svc.CreateDraft(ctx, userID, to, subject, body)
	return err
}

func (a *gmailServiceAdapter) ScanEmails(ctx context.Context, userID string) (*domain.GmailScanResult, error) {
	return a.svc.ScanEmails(ctx, userID)
}

type bookingServiceAdapter struct {
	svc *calendar.BookingService
}

func (a *bookingServiceAdapter) ListBookingTypes(ctx context.Context, userID string) ([]*domain.BookingType, error) {
	list, err := a.svc.ListBookingTypes(ctx, userID)
	if err != nil {
		return nil, err
	}
	var res []*domain.BookingType
	for i := range list {
		bt := list[i].BookingType
		res = append(res, &bt)
	}
	return res, nil
}

func (a *bookingServiceAdapter) CreateBookingType(ctx context.Context, userID string, bt *domain.BookingType) (*domain.BookingType, string, error) {
	created, err := a.svc.CreateBookingType(ctx, userID, bt)
	if err != nil {
		return nil, "", err
	}
	return &created.BookingType, created.PublicURL, nil
}

func (a *bookingServiceAdapter) CreateBookingTypeWithLinks(ctx context.Context, userID string, bt *domain.BookingType) (*domain.BookingType, string, string, error) {
	created, err := a.svc.CreateBookingType(ctx, userID, bt)
	if err != nil {
		return nil, "", "", err
	}
	return &created.BookingType, created.PublicURL, created.ShortURL, nil
}

type triggerServiceAdapter struct {
	svc *bots.TriggerService
}

func (a *triggerServiceAdapter) ListTriggers(userID string) ([]*domain.Trigger, error) {
	list, err := a.svc.ListTriggers(userID, "", "")
	if err != nil {
		return nil, err
	}
	var res []*domain.Trigger
	for i := range list {
		tr := list[i]
		res = append(res, &tr)
	}
	return res, nil
}

func (a *triggerServiceAdapter) CreateTrigger(t *domain.Trigger) error {
	input := domain.CreateTriggerInput{
		Title:         t.Title,
		Category:      "",
		Query:         t.UserIntent,
		ConditionType: domain.ConditionChangeDetected,
		TargetValue:   "alert",
		Frequency:     domain.FrequencyDailyMorning,
	}
	created, err := a.svc.CreateTrigger(t.UserID, input)
	if err != nil {
		return err
	}
	if created != nil {
		*t = *created
	}
	return nil
}

func (a *triggerServiceAdapter) DeleteTrigger(id, userID string) error {
	return a.svc.DeleteTrigger(id, userID)
}
