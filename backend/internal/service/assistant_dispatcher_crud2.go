package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// executeUpdateBooking atualiza um link de agendamento.
func (s *AssistantService) executeUpdateBooking(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.BookingUpdate == nil || strings.TrimSpace(intent.BookingUpdate.TargetQuery) == "" {
		return clarificationResponse(intent, "Qual booking deseja alterar? Me diga o nome ou slug (ex: 'booking Café')."), nil
	}
	if s.bookingSvc == nil {
		res.Message = "Não consegui acessar o Vito Booking agora."
		res.Reply = res.Message
		return res, nil
	}
	query := strings.TrimSpace(intent.BookingUpdate.TargetQuery)
	cleanID := normalizeTargetID(query)
	var bt *domain.BookingType
	bts, err := s.bookingSvc.ListBookingTypes(ctx, userID)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui buscar bookings (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	qLower := strings.ToLower(query)
	for i := range bts {
		btLink := &bts[i]
		if strings.EqualFold(btLink.Slug, query) || strings.EqualFold(btLink.ID, cleanID) || strings.Contains(strings.ToLower(btLink.Title), qLower) {
			bt = &btLink.BookingType
			break
		}
	}
	if bt == nil {
		res.Message = fmt.Sprintf("Não encontrei booking com '%s'.", query)
		res.Reply = res.Message
		return res, nil
	}
	if intent.BookingUpdate.Title != "" {
		bt.Title = intent.BookingUpdate.Title
	}
	if intent.BookingUpdate.Description != "" {
		bt.Description = intent.BookingUpdate.Description
	}
	if intent.BookingUpdate.DurationMinutes > 0 {
		bt.DurationMinutes = intent.BookingUpdate.DurationMinutes
	}
	if intent.BookingUpdate.BufferMinutes >= 0 {
		bt.BufferMinutes = intent.BookingUpdate.BufferMinutes
	}
	if intent.BookingUpdate.StartHour != "" {
		bt.StartHour = intent.BookingUpdate.StartHour
	}
	if intent.BookingUpdate.EndHour != "" {
		bt.EndHour = intent.BookingUpdate.EndHour
	}
	if intent.BookingUpdate.DaysOfWeek != "" {
		bt.DaysOfWeek = intent.BookingUpdate.DaysOfWeek
	}
	if intent.BookingUpdate.IsActive != nil {
		bt.IsActive = *intent.BookingUpdate.IsActive
	}
	if intent.BookingUpdate.ValidUntil != "" {
		if parsed, err := time.Parse("2006-01-02", intent.BookingUpdate.ValidUntil); err == nil {
			v := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 23, 59, 59, 0, time.UTC)
			bt.ValidUntil = &v
		}
	}
	updated, err := s.bookingSvc.UpdateBookingType(ctx, userID, bt)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui atualizar o booking (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	res.Booking = &updated.BookingType
	url := updated.ShortURL
	if url == "" {
		url = updated.PublicURL
	}
	res.Message = fmt.Sprintf("Booking '%s' atualizado! Link: %s", updated.Title, url)
	res.Reply = res.Message
	return res, nil
}

// executeUpdateMeeting atualiza uma reunião.
func (s *AssistantService) executeUpdateMeeting(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.MeetingUpdate == nil || strings.TrimSpace(intent.MeetingUpdate.TargetQuery) == "" {
		return clarificationResponse(intent, "Qual reunião deseja alterar? Me diga o nome ou ID."), nil
	}
	if s.meetingSvc == nil {
		res.Message = "Não consegui acessar as reuniões agora."
		res.Reply = res.Message
		return res, nil
	}
	query := strings.TrimSpace(intent.MeetingUpdate.TargetQuery)
	cleanID := normalizeTargetID(query)
	meetings, _ := s.meetingSvc.ListUserMeetings(ctx, userID, "")
	var m *domain.MeetingWithDetails
	for i := range meetings {
		if meetings[i].ID == cleanID || meetings[i].ID == query || strings.Contains(strings.ToLower(meetings[i].Title), strings.ToLower(query)) {
			m = &meetings[i]
			break
		}
	}
	if m == nil {
		res.Message = fmt.Sprintf("Não encontrei reunião com '%s'.", query)
		res.Reply = res.Message
		return res, nil
	}
	req := UpdateMeetingRequest{
		Title:           m.Title,
		Description:     m.Description,
		DurationMinutes: m.DurationMinutes,
	}
	if intent.MeetingUpdate.Title != "" {
		req.Title = intent.MeetingUpdate.Title
	}
	if intent.MeetingUpdate.Description != "" {
		req.Description = intent.MeetingUpdate.Description
	}
	if intent.MeetingUpdate.DurationMinutes > 0 {
		req.DurationMinutes = intent.MeetingUpdate.DurationMinutes
	}
	if len(intent.MeetingUpdate.Slots) > 0 {
		for _, sl := range intent.MeetingUpdate.Slots {
			if !sl.StartAt.IsZero() && !sl.EndAt.IsZero() && sl.EndAt.After(sl.StartAt) {
				req.Slots = append(req.Slots, MeetingSlotInput{
					StartAt: sl.StartAt,
					EndAt:   sl.EndAt,
				})
			}
		}
	}
	updated, err := s.meetingSvc.UpdateMeeting(ctx, m.ID, userID, req)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui atualizar a reunião (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	res.Meeting = updated
	res.Message = fmt.Sprintf("Reunião '%s' atualizada!", updated.Title)
	res.Reply = res.Message
	return res, nil
}

// executeDeleteMeeting exclui uma reunião.
func (s *AssistantService) executeDeleteMeeting(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	target := ""
	if intent.MeetingQuery != nil {
		target = intent.MeetingQuery.TargetQuery
	}
	if target == "" && intent.MeetingUpdate != nil {
		target = intent.MeetingUpdate.TargetQuery
	}
	if strings.TrimSpace(target) == "" {
		return clarificationResponse(intent, "Qual reunião deseja excluir? Me diga o nome ou ID."), nil
	}
	if s.meetingSvc == nil {
		res.Message = "Não consegui acessar as reuniões agora."
		res.Reply = res.Message
		return res, nil
	}
	query := strings.TrimSpace(target)
	cleanID := normalizeTargetID(query)
	meetings, _ := s.meetingSvc.ListUserMeetings(ctx, userID, "")
	var m *domain.MeetingWithDetails
	for i := range meetings {
		if meetings[i].ID == cleanID || meetings[i].ID == query || strings.Contains(strings.ToLower(meetings[i].Title), strings.ToLower(query)) {
			m = &meetings[i]
			break
		}
	}
	if m == nil {
		res.Message = fmt.Sprintf("Não encontrei reunião com '%s'.", query)
		res.Reply = res.Message
		return res, nil
	}
	if err := s.meetingSvc.DeleteMeeting(ctx, m.ID, userID); err != nil {
		res.Message = fmt.Sprintf("Não consegui excluir a reunião (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	res.Message = fmt.Sprintf("Reunião '%s' excluída.", m.Title)
	res.Reply = res.Message
	return res, nil
}

// executeUpdateMemory atualiza uma memória (suporte parcial via Supersede + Create).
func (s *AssistantService) executeUpdateMemory(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.MemoryUpdate == nil || (strings.TrimSpace(intent.MemoryUpdate.TargetQuery) == "" && strings.TrimSpace(intent.MemoryUpdate.ID) == "") {
		return clarificationResponse(intent, "Qual memória deseja atualizar? Me diga o conteúdo ou ID."), nil
	}
	if s.memoryRepo == nil {
		res.Message = "Não consegui acessar a memória agora."
		res.Reply = res.Message
		return res, nil
	}
	query := strings.TrimSpace(intent.MemoryUpdate.TargetQuery)
	if query == "" {
		query = intent.MemoryUpdate.ID
	}
	mems, err := s.memoryRepo.SearchRelevant(userID, query, 5)
	if err != nil || len(mems) == 0 {
		res.Message = fmt.Sprintf("Não encontrei memória com '%s'.", query)
		res.Reply = res.Message
		return res, nil
	}
	target := mems[0]
	if intent.MemoryUpdate.Content != "" {
		if err := s.memoryRepo.Supersede(target.ID, userID, "updated:"+time.Now().Format("20060102")); err != nil {
			log.Printf("⚠️ [AssistantService] Falha ao superseder memória (user=%s, id=%s): %v", userID, target.ID, err)
			res.Message = fmt.Sprintf("Não consegui atualizar a memória (%v).", err)
			res.Reply = res.Message
			return res, nil
		}
		newMem := &domain.Memory{
			ID:          "mem-" + time.Now().Format("20060102150405"),
			UserID:      userID,
			Category:    intent.MemoryUpdate.Category,
			Content:     intent.MemoryUpdate.Content,
			Importance:  target.Importance,
			Confidence:  target.Confidence,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		if err := s.memoryRepo.Create(newMem); err != nil {
			res.Message = fmt.Sprintf("Não consegui criar a memória atualizada (%v).", err)
			res.Reply = res.Message
			return res, nil
		}
		res.Message = fmt.Sprintf("Memória atualizada: [%s] %s", newMem.Category, newMem.Content)
	} else {
		res.Message = fmt.Sprintf("Memória encontrada: [%s] %s. Informe o novo conteúdo para atualizar.", target.Category, target.Content)
	}
	res.Reply = res.Message
	return res, nil
}

// executeDeleteMemory deleta uma memória.
func (s *AssistantService) executeDeleteMemory(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.MemoryDelete == nil || (strings.TrimSpace(intent.MemoryDelete.TargetQuery) == "" && strings.TrimSpace(intent.MemoryDelete.ID) == "") {
		return clarificationResponse(intent, "Qual memória deseja apagar? Me diga o assunto (ex: 'apague a memória sobre café')."), nil
	}
	if s.memoryRepo == nil {
		res.Message = "Não consegui acessar a memória agora."
		res.Reply = res.Message
		return res, nil
	}
	query := strings.TrimSpace(intent.MemoryDelete.TargetQuery)
	if query == "" {
		query = intent.MemoryDelete.ID
	}
	mems, err := s.memoryRepo.SearchRelevant(userID, query, 5)
	if err != nil || len(mems) == 0 {
		res.Message = fmt.Sprintf("Não encontrei memória com '%s'.", query)
		res.Reply = res.Message
		return res, nil
	}
	target := mems[0]
	if err := s.memoryRepo.Delete(userID, target.ID); err != nil {
		res.Message = fmt.Sprintf("Não consegui apagar a memória (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	res.Message = fmt.Sprintf("Memória apagada: [%s] %s", target.Category, target.Content)
	res.Reply = res.Message
	return res, nil
}

// executeListContacts lista contatos do WhatsApp.
func (s *AssistantService) executeListContacts(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.waDirectory == nil {
		res.Message = "Não consegui acessar o diretório do WhatsApp agora."
		res.Reply = res.Message
		return res, nil
	}
	limit := 50
	if intent.ContactsQuery != nil && intent.ContactsQuery.Limit > 0 {
		limit = intent.ContactsQuery.Limit
	}
	dir, err := s.waDirectory.Directory(ctx, userID)
	if err != nil {
		res.Message = fmt.Sprintf("Não consegui listar contatos (%v).", err)
		res.Reply = res.Message
		return res, nil
	}
	if len(dir) == 0 {
		res.Message = "Nenhum contato salvo."
		res.Reply = res.Message
		return res, nil
	}
	if intent.ContactsQuery != nil && intent.ContactsQuery.Query != "" {
		q := strings.ToLower(intent.ContactsQuery.Query)
		filtered := make([]ai.ChatContactSummary, 0)
		for _, c := range dir {
			if strings.Contains(strings.ToLower(c.Name), q) || (c.Alias != "" && strings.Contains(strings.ToLower(c.Alias), q)) {
				filtered = append(filtered, c)
			}
		}
		dir = filtered
	}
	if len(dir) > limit {
		dir = dir[:limit]
	}
	if len(dir) == 0 {
		res.Message = "Nenhum contato encontrado."
		res.Reply = res.Message
		return res, nil
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("%d contato(s):\n", len(dir)))
	for _, c := range dir {
		alias := ""
		if c.Alias != "" {
			alias = fmt.Sprintf(" (%s)", c.Alias)
		}
		b.WriteString(fmt.Sprintf("- %s%s\n", c.Name, alias))
	}
	res.Message = strings.TrimSpace(b.String())
	res.Reply = res.Message
	return res, nil
}