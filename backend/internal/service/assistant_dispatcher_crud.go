package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// executeListBookings lista os links de agendamento do usuário.
func (s *AssistantService) executeListBookings(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.bookingSvc == nil {
		res.Message = "Não consegui acessar o Vito Booking agora."
		res.Reply = res.Message
		return res, nil
	}
	bts, err := s.bookingSvc.ListBookingTypes(ctx, userID)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui listar seus bookings agora (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	if len(bts) == 0 {
		res.Message = "Você não tem nenhum link de agendamento configurado. Quer criar um?"
		res.Reply = res.Message
		return res, nil
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Você tem %d link(s) de agendamento:\n", len(bts)))
	for _, bt := range bts {
		status := "Ativo"
		if !bt.IsActive {
			status = "Pausado"
		}
		url := bt.ShortURL
		if url == "" {
			url = bt.PublicURL
		}
		b.WriteString(fmt.Sprintf("- %s (%d min, %s–%s, %s) — %s\n", bt.Title, bt.DurationMinutes, bt.StartHour, bt.EndHour, status, url))
	}
	res.Message = strings.TrimSpace(b.String())
	res.Reply = res.Message
	return res, nil
}

// executeQueryTriggers lista as vigílias/radares do usuário.
func (s *AssistantService) executeQueryTriggers(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.triggerSvc == nil {
		res.Message = "Não consegui acessar os radares agora."
		res.Reply = res.Message
		return res, nil
	}
	status := domain.TriggerStatusActive
	if intent.TriggerQuery != nil && intent.TriggerQuery.Status != "" {
		status = domain.TriggerStatus(intent.TriggerQuery.Status)
	}
	cat := domain.TriggerCategory("")
	if intent.TriggerQuery != nil && intent.TriggerQuery.Category != "" {
		cat = domain.TriggerCategory(intent.TriggerQuery.Category)
	}
	trigs, err := s.triggerSvc.ListTriggers(userID, cat, status)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui listar radares (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	if len(trigs) == 0 {
		res.Message = "Você não tem radares configurados. Quer criar um?"
		res.Reply = res.Message
		return res, nil
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Você tem %d radar(es):\n", len(trigs)))
	for _, tr := range trigs {
		next := "—"
		if !tr.NextCheckAt.IsZero() {
			next = tr.NextCheckAt.Format("02/01 15:04")
		}
		b.WriteString(fmt.Sprintf("- %s [%s] %s • próxima: %s\n", tr.Title, tr.Category, tr.Frequency, next))
	}
	res.Message = strings.TrimSpace(b.String())
	res.Reply = res.Message
	return res, nil
}

// executeListMeetings lista as reuniões do usuário.
func (s *AssistantService) executeListMeetings(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.meetingSvc == nil {
		res.Message = "Não consegui acessar as reuniões agora."
		res.Reply = res.Message
		return res, nil
	}
	status := ""
	if intent.MeetingQuery != nil && intent.MeetingQuery.Status != "" {
		status = intent.MeetingQuery.Status
	}
	meetings, err := s.meetingSvc.ListUserMeetings(ctx, userID, status)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui listar reuniões (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	if len(meetings) == 0 {
		res.Message = "Você não tem reuniões criadas."
		res.Reply = res.Message
		return res, nil
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Você tem %d reunião(ões):\n", len(meetings)))
	for _, m := range meetings {
		status := "Aberta"
		if m.Status == domain.MeetingStatusConfirmed {
			status = "Confirmada"
		} else if m.Status == domain.MeetingStatusCancelled {
			status = "Cancelada"
		} else if m.Status == domain.MeetingStatusExpired {
			status = "Expirada"
		}
		b.WriteString(fmt.Sprintf("- %s (%s) • %d slots • %s\n", m.Title, status, len(m.Slots), m.PublicURL))
	}
	res.Message = strings.TrimSpace(b.String())
	res.Reply = res.Message
	return res, nil
}

// executeQueryPending lista pendências da incubadora.
func (s *AssistantService) executeQueryPending(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.pendingSvc == nil {
		res.Message = "Não consegui acessar as pendências agora."
		res.Reply = res.Message
		return res, nil
	}
	status := domain.PendingStatusInbox
	if intent.PendingQuery != nil && intent.PendingQuery.Status != "" {
		status = domain.PendingStatus(intent.PendingQuery.Status)
	}
	cat := ""
	if intent.PendingQuery != nil {
		cat = intent.PendingQuery.Category
	}
	items, err := s.pendingSvc.ListByUser(userID, &status, cat)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui listar pendências (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	if len(items) == 0 {
		res.Message = "Nenhuma pendência encontrada."
		res.Reply = res.Message
		return res, nil
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("%d pendência(s):\n", len(items)))
	for _, it := range items {
		due := "sem data"
		if it.ScheduledDate != "" {
			due = it.ScheduledDate
		}
		b.WriteString(fmt.Sprintf("- %s [%s] • %s\n", it.Title, it.Status, due))
	}
	res.Message = strings.TrimSpace(b.String())
	res.Reply = res.Message
	return res, nil
}

// executeQueryMemory busca memórias do usuário.
func (s *AssistantService) executeQueryMemory(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.memoryRepo == nil {
		res.Message = "Não consegui acessar a memória agora."
		res.Reply = res.Message
		return res, nil
	}
	query := ""
	limit := 10
	if intent.MemoryQuery != nil {
		query = intent.MemoryQuery.Query
		if intent.MemoryQuery.Limit > 0 {
			limit = intent.MemoryQuery.Limit
		}
	}
	mems, err := s.memoryRepo.SearchRelevant(userID, query, limit)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui buscar na memória (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	if len(mems) == 0 {
		res.Message = "Nenhuma memória encontrada."
		res.Reply = res.Message
		return res, nil
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("%d memória(s) encontrada(s):\n", len(mems)))
	for _, m := range mems {
		b.WriteString(fmt.Sprintf("- [%s] %s\n", m.Category, m.Content))
	}
	res.Message = strings.TrimSpace(b.String())
	res.Reply = res.Message
	return res, nil
}