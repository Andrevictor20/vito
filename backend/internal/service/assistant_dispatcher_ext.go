package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/assistant"
)

// normalizeTargetID limpa prefixos como "[ID: ...]" ou "ID:" caso o modelo repasse a tag literal.
func normalizeTargetID(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "[")
	s = strings.TrimSuffix(s, "]")
	if strings.HasPrefix(strings.ToUpper(s), "ID:") {
		s = strings.TrimSpace(s[3:])
	}
	return strings.TrimSpace(s)
}

func (s *AssistantService) executeCreateTrigger(userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.Trigger == nil || (strings.TrimSpace(intent.Trigger.Title) == "" && strings.TrimSpace(intent.Trigger.Query) == "") {
		return clarificationResponse(intent, "Sobre o que quer criar a vigília? Me diga o tema (ex: PETR3, voos para Lisboa, jogo do Flamengo), e se quiser um valor alvo e horário (ex: todo dia às 08:30). Se não souber, sugiro resumo diário às 08:30 — topa?"), nil
	}
	if s.triggerSvc == nil {
		log.Printf("⚠️ [AssistantService] TriggerService indisponível para CREATE_TRIGGER (user=%s)", userID)
		res.Message = "Não consegui acessar os radares agora por instabilidade interna. Nada foi criado. Tente novamente em instantes."
		res.Reply = res.Message
		return res, nil
	}
	cat := domain.TriggerCategory(intent.Trigger.Category)
	freq := domain.TriggerFrequency(intent.Trigger.Frequency)
	cond := domain.TriggerConditionType(intent.Trigger.ConditionType)
	title := strings.TrimSpace(intent.Trigger.Title)
	query := strings.TrimSpace(intent.Trigger.Query)
	if title == "" {
		title = query
	}
	if query == "" {
		query = title
	}
	trig, err := s.triggerSvc.CreateTrigger(userID, domain.CreateTriggerInput{
		Title:         title,
		Category:      cat,
		Query:         query,
		TargetValue:   intent.Trigger.TargetValue,
		ConditionType: cond,
		Frequency:     freq,
		ScheduledTime: intent.Trigger.ScheduledTime,
		DaysOfWeek:    intent.Trigger.DaysOfWeek,
	})
	if err != nil {
		log.Printf("⚠️ [AssistantService] Falha ao criar radar (user=%s, title=%q): %v", userID, title, err)
		if strings.Contains(err.Error(), "título") || strings.Contains(err.Error(), "consulta") || strings.Contains(err.Error(), "comando") {
			return clarificationResponse(intent, fmt.Sprintf("Para criar a vigília preciso de mais um detalhe: %v. Ex: 'Monitore a PETR3 acima de R$ 35 todo dia às 08:30'.", err)), nil
		}
		res.Message = fmt.Sprintf("Não consegui criar o radar '%s' agora (%v). Nada foi criado. Tente de novo em instantes.", title, err)
		res.Reply = res.Message
		return res, nil
	}
	res.Trigger = trig
	if res.Message == "" || res.Message == defaultMessageFor(ai.ActionCreateTrigger) {
		res.Message = fmt.Sprintf("Pronto! Criei o radar '%s' e já iniciei a vigília para você.", trig.Title)
	}
	res.Reply = res.Message
	return res, nil
}

func (s *AssistantService) executeCreatePending(userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.Pending == nil || strings.TrimSpace(intent.Pending.Title) == "" {
		return clarificationResponse(intent, "O que devo guardar nas Pendências? Me diga o título (ex: 'Trocar o filtro do ar') e, se quiser, uma data futura (ex: 20/10)."), nil
	}
	if s.pendingSvc == nil {
		log.Printf("⚠️ [AssistantService] PendingService indisponível para CREATE_PENDING (user=%s)", userID)
		res.Message = "Não consegui acessar as Pendências agora por instabilidade interna. Nada foi criado. Tente novamente em instantes."
		res.Reply = res.Message
		return res, nil
	}
	item, err := s.pendingSvc.CreatePending(userID, domain.CreatePendingInput{
		Title:         intent.Pending.Title,
		Description:   intent.Pending.Description,
		Category:      intent.Pending.Category,
		ScheduledDate: intent.Pending.ScheduledDate,
		RemindAt:      intent.Pending.RemindAt,
		RemindRepeat:  intent.Pending.RemindRepeat,
		RemindAdvance: intent.Pending.RemindAdvance,
	})
	if err != nil {
		log.Printf("⚠️ [AssistantService] Falha ao criar pendência (user=%s, title=%q): %v", userID, intent.Pending.Title, err)
		res.Message = fmt.Sprintf("Não consegui guardar '%s' nas Pendências agora (%v). Nada foi criado. Tente de novo em instantes.", intent.Pending.Title, err)
		res.Reply = res.Message
		return res, nil
	}
	res.Pending = item
	if res.Message == "" || res.Message == defaultMessageFor(ai.ActionCreatePending) {
		res.Message = fmt.Sprintf("Guardei '%s' nas suas Pendências!", item.Title)
		res.Reply = res.Message
	}
	return res, nil
}

func (s *AssistantService) executeConvertPending(userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.Event == nil || strings.TrimSpace(intent.Event.Title) == "" {
		return clarificationResponse(intent, "Qual pendência devo agendar e para quando? Me diga o nome e o dia/horário (ex: 'Dentista amanhã às 14h')."), nil
	}
	if s.calSvc == nil {
		log.Printf("⚠️ [AssistantService] CalendarService indisponível para CONVERT_PENDING (user=%s)", userID)
		res.Message = "Não consegui acessar sua agenda agora. Nada foi agendado. Tente novamente em instantes."
		res.Reply = res.Message
		return res, nil
	}
	if intent.Event.StartAt.IsZero() {
		return clarificationResponse(intent, fmt.Sprintf("Para agendar '%s', qual dia e horário? Ex: amanhã às 14h. Se não souber, sugiro 09:00, 14:00 ou 19:00.", intent.Event.Title)), nil
	}
	if intent.Event.EndAt.IsZero() || intent.Event.EndAt.Before(intent.Event.StartAt) || intent.Event.EndAt.Equal(intent.Event.StartAt) {
		intent.Event.EndAt = intent.Event.StartAt.Add(1 * time.Hour)
	}
	event, conflict, err := s.calSvc.CreateEvent(
		userID,
		intent.Event.Title,
		intent.Event.Description,
		intent.Event.Location,
		intent.Event.StartAt,
		intent.Event.EndAt,
	)
	if err != nil {
		log.Printf("⚠️ [AssistantService] Falha ao agendar pendência (user=%s, title=%q): %v", userID, intent.Event.Title, err)
		res.Message = fmt.Sprintf("Não consegui agendar '%s' agora (%v). Nada foi criado. Tente de novo em instantes.", intent.Event.Title, err)
		res.Reply = res.Message
		return res, nil
	}
	res.Event = event
	res.Conflict = conflict
	if intent.Pending != nil && intent.Pending.ID != "" && s.pendingSvc != nil {
		_, _ = s.pendingSvc.CompletePending(intent.Pending.ID, userID)
	}
	if res.Message == "" || res.Message == defaultMessageFor(ai.ActionConvertPending) {
		res.Message = fmt.Sprintf("Agendei '%s' para %s e atualizei a pendência!", event.Title, event.StartAt.Format("02/01 às 15:04"))
		res.Reply = res.Message
	}
	return res, nil
}

func (s *AssistantService) executeCreateBookingLink(ctx context.Context, userID string, intent *ai.ParsedIntent, input ai.UserInput, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.Booking == nil {
		return clarificationResponse(intent, "Claro! Para gerar seu link de agendamento preciso de: 1) Nome do encontro (ex: Café rápido)? 2) Duração (15, 30, 45 ou 60 min — sugiro 30)? 3) Janela de atendimento (ex: 09:00 às 18:00)? 4) Dias (úteis, fim de semana ou todos — sugiro todos)?"), nil
	}
	if strings.TrimSpace(intent.Booking.Title) == "" && strings.TrimSpace(intent.Booking.Description) == "" && strings.TrimSpace(intent.Booking.Slug) == "" && isVagueBookingRequest(input.Text) {
		return clarificationResponse(intent, "Claro! Para gerar seu link de agendamento preciso de: 1) Nome do encontro (ex: Café rápido)? 2) Duração (15, 30, 45 ou 60 min — sugiro 30)? 3) Janela de atendimento (ex: 09:00 às 18:00)? 4) Dias (úteis, fim de semana ou todos — sugiro todos)?"), nil
	}
	if s.bookingSvc == nil {
		log.Printf("⚠️ [AssistantService] BookingService indisponível para CREATE_BOOKING (user=%s)", userID)
		res.Message = "Não consegui acessar o Vito Booking agora por instabilidade interna. Nada foi criado. Tente novamente em instantes ou crie pelo menu Vito Booking."
		res.Reply = res.Message
		return res, nil
	}
	title := intent.Booking.Title
	if title == "" {
		title = "Reunião de Alinhamento"
	}
	dur := intent.Booking.DurationMinutes
	if dur <= 0 {
		dur = 30
	}
	buf := intent.Booking.BufferMinutes
	if buf < 0 {
		buf = 10
	}
	sh := intent.Booking.StartHour
	if sh == "" {
		sh = "09:00"
	}
	eh := intent.Booking.EndHour
	if eh == "" {
		eh = "18:00"
	}
	if startH, startM, errS := parseHour(sh); errS == nil {
		endH, endM, errE := parseHour(eh)
		if errE != nil || (endH*60+endM) <= (startH*60+startM) {
			targetEndMin := startH*60 + startM + dur
			if targetEndMin > 22*60 {
				targetEndMin = 22 * 60
			}
			if targetEndMin <= startH*60+startM {
				targetEndMin = startH*60 + startM + 30
			}
			if targetEndMin > 23*60+59 {
				targetEndMin = 23*60 + 59
			}
			eh = fmt.Sprintf("%02d:%02d", targetEndMin/60, targetEndMin%60)
		}
	}
	slug := intent.Booking.Slug
	if slug == "" {
		slug = assistant.SlugifyBookingTitle(title)
		slug = fmt.Sprintf("%s-%d", slug, time.Now().Unix()%10000)
	}
	dow := strings.TrimSpace(intent.Booking.DaysOfWeek)
	if dow == "" {
		dow = inferBookingDaysOfWeek(input.Text)
	}
	loc := userLocation(input.Timezone)
	nowLoc := input.Now.In(loc)
	validFrom := time.Date(nowLoc.Year(), nowLoc.Month(), nowLoc.Day(), 0, 0, 0, 0, loc).UTC()
	validUntil := validFrom.AddDate(0, 0, 7)
	if vu := strings.TrimSpace(intent.Booking.ValidUntil); vu != "" {
		if parsed, err := time.ParseInLocation("2006-01-02", vu[:min(10, len(vu))], loc); err == nil {
			validUntil = time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 23, 59, 59, 0, loc).UTC()
		}
	}
	bt, err := s.bookingSvc.CreateBookingType(ctx, userID, &domain.BookingType{
		Title:           title,
		Slug:            slug,
		Description:     intent.Booking.Description,
		DurationMinutes: dur,
		BufferMinutes:   buf,
		StartHour:       sh,
		EndHour:         eh,
		DaysOfWeek:      dow,
		ValidFrom:       &validFrom,
		ValidUntil:      &validUntil,
	})
	if err != nil {
		log.Printf("⚠️ [AssistantService] Erro ao criar booking type via chat: %v", err)
		res.Message = fmt.Sprintf("Não consegui gerar o link de agendamento no momento (%v). Nada foi criado. Você também pode criá-lo pelo menu Vito Booking.", err)
		res.Reply = res.Message
	} else {
		res.Booking = &bt.BookingType
		linkURL := bt.ShortURL
		if linkURL == "" {
			linkURL = bt.PublicURL
		}
		res.BookingURL = bt.PublicURL
		res.BookingShort = bt.ShortURL
		res.Message = fmt.Sprintf("Criei o seu link de agendamento para '%s' (%d min):\n%s", bt.Title, bt.DurationMinutes, linkURL)
		res.Reply = res.Message
	}
	return res, nil
}

func (s *AssistantService) executeCancelBookingAppointment(ctx context.Context, userID string, intent *ai.ParsedIntent, input ai.UserInput, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.Booking == nil || (strings.TrimSpace(intent.Booking.TargetQuery) == "" && strings.TrimSpace(intent.Booking.Title) == "") {
		return clarificationResponse(intent, "Qual agendamento devo cancelar? Me diga o nome do convidado, e-mail ou assunto (ex: 'cancele a Maria')."), nil
	}
	if s.bookingSvc == nil {
		log.Printf("⚠️ [AssistantService] BookingService indisponível para CANCEL_APPOINTMENT (user=%s)", userID)
		res.Message = "Não consegui acessar os agendamentos agora. Nada foi cancelado. Tente novamente em instantes."
		res.Reply = res.Message
		return res, nil
	}
	query := strings.TrimSpace(intent.Booking.TargetQuery)
	if query == "" {
		query = strings.TrimSpace(intent.Booking.Title)
	}
	if query == "" {
		return clarificationResponse(intent, "Qual agendamento devo cancelar? Me diga o nome do convidado, e-mail ou assunto."), nil
	}
	cleanID := normalizeTargetID(query)
	from := input.Now.Add(-30 * 24 * time.Hour)
	to := input.Now.Add(90 * 24 * time.Hour)
	appts, err := s.bookingSvc.ListAppointments(ctx, userID, from, to)
	if err != nil {
		log.Printf("⚠️ [AssistantService] Falha ao listar agendamentos (user=%s): %v", userID, err)
		res.Message = fmt.Sprintf("Não consegui listar seus agendamentos agora (%v). Nada foi cancelado. Tente novamente em instantes.", err)
		res.Reply = res.Message
		return res, nil
	}
	var targetAppt *domain.BookingAppointment
	qLower := strings.ToLower(query)
	for i := range appts {
		a := &appts[i]
		if a.ID == cleanID || a.ID == query ||
			strings.Contains(strings.ToLower(a.GuestName), qLower) ||
			strings.Contains(strings.ToLower(a.GuestEmail), qLower) {
			targetAppt = a
			break
		}
	}
	if targetAppt != nil {
		if err := s.bookingSvc.CancelAppointment(ctx, userID, targetAppt.ID); err != nil {
			log.Printf("⚠️ [AssistantService] Falha ao cancelar agendamento (user=%s, appt=%s): %v", userID, targetAppt.ID, err)
			res.Message = fmt.Sprintf("Não consegui cancelar o agendamento de %s agora (%v). Nada foi alterado. Tente novamente em instantes.", targetAppt.GuestName, err)
			res.Reply = res.Message
			return res, nil
		}
		res.Message = fmt.Sprintf("Cancelei o agendamento de %s e liberei o horário na sua agenda.", targetAppt.GuestName)
		res.Reply = res.Message
	} else {
		res.Message = fmt.Sprintf("Não localizei nenhum agendamento correspondente a '%s'. Me diga o nome do convidado ou e-mail exato?", query)
		res.Reply = res.Message
	}
	return res, nil
}

func (s *AssistantService) executeCreateMeeting(ctx context.Context, userID string, intent *ai.ParsedIntent, input ai.UserInput, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.Meeting == nil || strings.TrimSpace(intent.Meeting.Title) == "" {
		return clarificationResponse(intent, "Qual o assunto ou título da reunião que você deseja agendar? (Ex: 'Reunião de alinhamento com Carlos')"), nil
	}
	if s.meetingSvc == nil {
		log.Printf("⚠️ [AssistantService] MeetingService indisponível para CREATE_MEETING (user=%s)", userID)
		res.Message = "O serviço de reuniões está temporariamente indisponível. Nada foi criado. Tente novamente em instantes."
		res.Reply = res.Message
		return res, nil
	}

	dur := intent.Meeting.DurationMinutes
	if dur <= 0 {
		dur = 45
	}
	mode := intent.Meeting.Mode
	if mode != domain.MeetingModeGroupConsensus {
		mode = domain.MeetingModeOneOnOne
	}

	var slots []MeetingSlotInput
	for _, sl := range intent.Meeting.Slots {
		if !sl.StartAt.IsZero() && !sl.EndAt.IsZero() && sl.EndAt.After(sl.StartAt) {
			slots = append(slots, MeetingSlotInput{
				StartAt: sl.StartAt,
				EndAt:   sl.EndAt,
			})
		}
	}

	if len(slots) == 0 {
		now := input.Now
		loc := now.Location()
		baseDate := now.Add(24 * time.Hour)
		for d := 0; d < 3; d++ {
			slotDate := baseDate.AddDate(0, 0, d)
			hour := 10 + d*3
			st := time.Date(slotDate.Year(), slotDate.Month(), slotDate.Day(), hour, 0, 0, 0, loc)
			et := st.Add(time.Duration(dur) * time.Minute)
			slots = append(slots, MeetingSlotInput{
				StartAt: st,
				EndAt:   et,
			})
		}
	}

	mDetails, err := s.meetingSvc.CreateMeeting(ctx, CreateMeetingRequest{
		UserID:          userID,
		Title:           intent.Meeting.Title,
		Description:     intent.Meeting.Description,
		DurationMinutes: dur,
		Mode:            mode,
		Slots:           slots,
	})
	if err != nil {
		log.Printf("⚠️ [AssistantService] Erro ao criar reunião via chat: %v", err)
		res.Message = fmt.Sprintf("Não consegui criar a reunião no momento (%v). Nada foi criado.", err)
		res.Reply = res.Message
	} else {
		res.Meeting = mDetails
		linkURL := mDetails.ShortURL
		if linkURL == "" {
			linkURL = mDetails.PublicURL
		}
		res.MeetingURL = mDetails.PublicURL
		res.MeetingShort = mDetails.ShortURL

		share, _ := s.meetingSvc.GenerateWhatsAppShare(ctx, userID, mDetails.ID)
		if share != nil {
			res.MeetingWhatsApp = share.WhatsAppDeepLink
		}

		if mode == domain.MeetingModeOneOnOne {
			res.Message = fmt.Sprintf("Criei o link mágico para a reunião '%s' (%d min) com %d opções de horários:\n%s\n\nVocê pode copiar o link ou enviar direto pelo WhatsApp!", mDetails.Title, mDetails.DurationMinutes, len(mDetails.Slots), linkURL)
		} else {
			res.Message = fmt.Sprintf("Criei a votação de consenso em grupo para a reunião '%s' com %d horários disponíveis:\n%s", mDetails.Title, len(mDetails.Slots), linkURL)
		}
		res.Reply = res.Message
	}
	return res, nil
}
