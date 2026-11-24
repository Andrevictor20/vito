package adkengine

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// ExtractedToolEntities agrupa entidades tipadas extraídas de ToolExecutionResult.Data.
type ExtractedToolEntities struct {
	ActionPerformed    string
	Event              *domain.Event
	Conflict           *domain.ConflictInfo
	Todo               *domain.Todo
	Trigger            *domain.Trigger
	Pending            *domain.PendingItem
	Booking            *domain.BookingType
	BookingURL         string
	BookingShortURL    string
	Meeting            *domain.MeetingWithDetails
	MeetingURL         string
	MeetingShortURL    string
	MeetingWhatsAppURL string
}

// Merge combina entidades recém-extraídas preservando campos já coletados no turno.
func (e *ExtractedToolEntities) Merge(other ExtractedToolEntities) {
	if other.ActionPerformed != "" {
		e.ActionPerformed = other.ActionPerformed
	}
	if other.Event != nil {
		e.Event = other.Event
	}
	if other.Conflict != nil {
		e.Conflict = other.Conflict
	}
	if other.Todo != nil {
		e.Todo = other.Todo
	}
	if other.Trigger != nil {
		e.Trigger = other.Trigger
	}
	if other.Pending != nil {
		e.Pending = other.Pending
	}
	if other.Booking != nil {
		e.Booking = other.Booking
	}
	if other.BookingURL != "" {
		e.BookingURL = other.BookingURL
	}
	if other.BookingShortURL != "" {
		e.BookingShortURL = other.BookingShortURL
	}
	if other.Meeting != nil {
		e.Meeting = other.Meeting
	}
	if other.MeetingURL != "" {
		e.MeetingURL = other.MeetingURL
	}
	if other.MeetingShortURL != "" {
		e.MeetingShortURL = other.MeetingShortURL
	}
	if other.MeetingWhatsAppURL != "" {
		e.MeetingWhatsAppURL = other.MeetingWhatsAppURL
	}
}

// ApplyToResponse preenche os campos estruturados da resposta unificada do chat.
func (e ExtractedToolEntities) ApplyToResponse(resp *domain.UnifiedAssistantResponse) {
	if resp == nil {
		return
	}
	if e.ActionPerformed != "" {
		resp.ActionPerformed = e.ActionPerformed
	}
	if e.Event != nil {
		resp.Event = e.Event
	}
	if e.Conflict != nil {
		resp.Conflict = e.Conflict
	}
	if e.Todo != nil {
		resp.Todo = e.Todo
	}
	if e.Trigger != nil {
		resp.Trigger = e.Trigger
	}
	if e.Pending != nil {
		resp.Pending = e.Pending
	}
	if e.Booking != nil {
		resp.Booking = e.Booking
	}
	if e.BookingURL != "" {
		resp.BookingURL = e.BookingURL
	}
	if e.BookingShortURL != "" {
		resp.BookingShortURL = e.BookingShortURL
	}
	if e.Meeting != nil {
		resp.Meeting = e.Meeting
	}
	if e.MeetingURL != "" {
		resp.MeetingURL = e.MeetingURL
	}
	if e.MeetingShortURL != "" {
		resp.MeetingShortURL = e.MeetingShortURL
	}
	if e.MeetingWhatsAppURL != "" {
		resp.MeetingWhatsAppURL = e.MeetingWhatsAppURL
	}
}

// ExtractToolEntities converte res.Data de qualquer toolset nas entidades tipadas do chat.
func ExtractToolEntities(operation string, data any) ExtractedToolEntities {
	out := ExtractedToolEntities{ActionPerformed: operation}
	if data == nil {
		return out
	}

	switch v := data.(type) {
	case *domain.Todo:
		out.Todo = v
		return out
	case domain.Todo:
		c := v
		out.Todo = &c
		return out
	case *domain.Event:
		out.Event = v
		return out
	case domain.Event:
		c := v
		out.Event = &c
		return out
	case *domain.Trigger:
		out.Trigger = v
		return out
	case domain.Trigger:
		c := v
		out.Trigger = &c
		return out
	case *domain.PendingItem:
		out.Pending = v
		return out
	case domain.PendingItem:
		c := v
		out.Pending = &c
		return out
	case *domain.BookingType:
		out.Booking = v
		return out
	case domain.BookingType:
		c := v
		out.Booking = &c
		return out
	case *domain.MeetingWithDetails:
		out.Meeting = v
		return out
	case *domain.ConflictInfo:
		out.Conflict = v
		return out
	}

	raw, err := json.Marshal(data)
	if err != nil {
		return out
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return out
	}

	if b, ok := m["booking"]; ok {
		var bk domain.BookingType
		if json.Unmarshal(b, &bk) == nil && bk.ID != "" {
			out.Booking = &bk
		}
		if u, ok := m["booking_url"]; ok {
			_ = json.Unmarshal(u, &out.BookingURL)
		}
		if su, ok := m["booking_short_url"]; ok {
			_ = json.Unmarshal(su, &out.BookingShortURL)
		}
	}
	if eRaw, ok := m["event"]; ok {
		var ev domain.Event
		if json.Unmarshal(eRaw, &ev) == nil && ev.ID != "" {
			out.Event = &ev
		}
	}
	if cRaw, ok := m["conflict"]; ok {
		var cf domain.ConflictInfo
		if json.Unmarshal(cRaw, &cf) == nil && cf.HasConflict {
			out.Conflict = &cf
		}
	}
	if mRaw, ok := m["meeting"]; ok {
		var mt domain.MeetingWithDetails
		if json.Unmarshal(mRaw, &mt) == nil && mt.ID != "" {
			out.Meeting = &mt
		}
		if u, ok := m["meeting_url"]; ok {
			_ = json.Unmarshal(u, &out.MeetingURL)
		}
		if su, ok := m["meeting_short_url"]; ok {
			_ = json.Unmarshal(su, &out.MeetingShortURL)
		}
		if wu, ok := m["meeting_whatsapp_url"]; ok {
			_ = json.Unmarshal(wu, &out.MeetingWhatsAppURL)
		}
	}
	if pRaw, ok := m["pending"]; ok {
		var pd domain.PendingItem
		if json.Unmarshal(pRaw, &pd) == nil && pd.ID != "" {
			out.Pending = &pd
		}
	}

	switch operation {
	case "create_todo", "update_todo", "complete_todo":
		if out.Todo == nil {
			var td domain.Todo
			if json.Unmarshal(raw, &td) == nil && td.ID != "" {
				out.Todo = &td
			}
		}
	case "create_event", "update_event":
		if out.Event == nil {
			var ev domain.Event
			if json.Unmarshal(raw, &ev) == nil && ev.ID != "" {
				out.Event = &ev
			}
		}
	case "create_bot", "create_trigger":
		if out.Trigger == nil {
			var tr domain.Trigger
			if json.Unmarshal(raw, &tr) == nil && tr.ID != "" {
				out.Trigger = &tr
			}
		}
	case "create_booking_link":
		if out.Booking == nil {
			var bk domain.BookingType
			if json.Unmarshal(raw, &bk) == nil && bk.ID != "" {
				out.Booking = &bk
			}
		}
	}
	return out
}

func previewString(preview map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := preview[k].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func joinPreviewParts(parts ...string) string {
	var clean []string
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			clean = append(clean, t)
		}
	}
	return strings.Join(clean, " · ")
}

// FormatSuspendedAction formata a resposta em PT-BR e ChatCard para uma ferramenta suspensa no ConfirmationGate.
func FormatSuspendedAction(
	operation string,
	pendingID string,
	reason string,
	preview map[string]any,
) (finalAnswer string, card domain.ChatCard, waMsg *domain.ChatWhatsAppMessage, gmailMsg *domain.ChatGmailMessage) {
	switch operation {
	case "send_message":
		rec := previewString(preview, "recipient")
		msg := previewString(preview, "message")
		if rec == "" {
			rec = "o destinatário"
		}
		finalAnswer = fmt.Sprintf("Preparei a mensagem para %s:\n\n\"%s\"\n\nPosso enviar?", rec, msg)
		card = domain.ChatCard{
			ID:          pendingID,
			Type:        "whatsapp",
			Title:       fmt.Sprintf("WhatsApp para %s", rec),
			Subtitle:    msg,
			ActionLabel: "Confirmar Envio",
			Confirm:     true,
			Dismiss:     true,
		}
		waMsg = &domain.ChatWhatsAppMessage{
			ID:            pendingID,
			RecipientName: rec,
			Message:       msg,
			Status:        "ready",
		}
	case "send_email":
		to := previewString(preview, "to")
		subj := previewString(preview, "subject")
		body := previewString(preview, "body")
		if subj == "" {
			subj = "Mensagem do Vito"
		}
		if to == "" {
			to = "o destinatário"
		}
		finalAnswer = fmt.Sprintf("Preparei o e-mail para %s (Assunto: \"%s\"):\n\n\"%s\"\n\nPosso enviar?", to, subj, body)
		card = domain.ChatCard{
			ID:          pendingID,
			Type:        "gmail",
			Title:       subj,
			Subtitle:    fmt.Sprintf("Para: %s", to),
			ActionLabel: "Confirmar Envio",
			Confirm:     true,
			Dismiss:     true,
		}
		gmailMsg = &domain.ChatGmailMessage{
			ID:             pendingID,
			RecipientEmail: to,
			Subject:        subj,
			Body:           body,
			Status:         "ready",
		}
	case "create_todo":
		title := previewString(preview, "title")
		due := previewString(preview, "due_date", "due")
		cat := previewString(preview, "category")
		if title == "" {
			title = "Nova tarefa"
		}
		if due != "" {
			finalAnswer = fmt.Sprintf("Preparei a tarefa **\"%s\"** (para %s). Deseja confirmar a criação?", title, due)
		} else {
			finalAnswer = fmt.Sprintf("Preparei a tarefa **\"%s\"**. Deseja confirmar a criação?", title)
		}
		subtitle := joinPreviewParts(title, due, cat)
		card = domain.ChatCard{
			ID: pendingID, Type: "confirm", Title: "Criar tarefa",
			Subtitle: subtitle, ActionLabel: "Confirmar", Confirm: true, Dismiss: true,
		}
	case "create_event":
		title := previewString(preview, "title")
		start := previewString(preview, "start_time", "start_at")
		loc := previewString(preview, "location")
		if title == "" {
			title = "Novo evento"
		}
		if start != "" {
			finalAnswer = fmt.Sprintf("Preparei o evento **\"%s\"** em %s. Deseja confirmar?", title, start)
		} else {
			finalAnswer = fmt.Sprintf("Preparei o evento **\"%s\"**. Deseja confirmar?", title)
		}
		subtitle := joinPreviewParts(title, start, loc)
		card = domain.ChatCard{
			ID: pendingID, Type: "confirm", Title: "Agendar evento",
			Subtitle: subtitle, ActionLabel: "Confirmar", Confirm: true, Dismiss: true,
		}
	case "delete_todo", "delete_event", "delete_events_batch":
		target := previewString(preview, "title", "todo_id", "event_id", "target_title")
		if target != "" {
			finalAnswer = fmt.Sprintf("Preparei a exclusão de **\"%s\"**. Deseja confirmar?", target)
		} else {
			finalAnswer = "Preparei a exclusão solicitada. Deseja confirmar?"
		}
		subtitle := joinPreviewParts(target, reason)
		card = domain.ChatCard{
			ID: pendingID, Type: "confirm", Title: "Confirmar exclusão",
			Subtitle: subtitle, ActionLabel: "Confirmar", Confirm: true, Dismiss: true,
		}
	case "update_todo", "complete_todo", "update_event":
		target := previewString(preview, "title", "todo_id", "event_id")
		if target != "" {
			finalAnswer = fmt.Sprintf("Preparei a atualização de **\"%s\"**. Deseja confirmar?", target)
		} else {
			finalAnswer = "Preparei a atualização solicitada. Deseja confirmar?"
		}
		card = domain.ChatCard{
			ID: pendingID, Type: "confirm", Title: "Confirmar alteração",
			Subtitle: joinPreviewParts(target, reason), ActionLabel: "Confirmar", Confirm: true, Dismiss: true,
		}
	case "create_trigger", "create_bot":
		title := previewString(preview, "title", "goal", "user_intent")
		if title == "" {
			title = "Novo bot"
		}
		finalAnswer = fmt.Sprintf("Preparei o bot **\"%s\"**. Deseja confirmar a criação?", title)
		card = domain.ChatCard{
			ID: pendingID, Type: "confirm", Title: "Criar bot",
			Subtitle: joinPreviewParts(title, previewString(preview, "goal")), ActionLabel: "Confirmar", Confirm: true, Dismiss: true,
		}
	case "create_booking_link":
		title := previewString(preview, "title")
		if title == "" {
			title = "Link de agendamento"
		}
		finalAnswer = fmt.Sprintf("Preparei o link de agendamento **\"%s\"**. Deseja confirmar a criação?", title)
		card = domain.ChatCard{
			ID: pendingID, Type: "confirm", Title: "Criar link de agendamento",
			Subtitle: title, ActionLabel: "Confirmar", Confirm: true, Dismiss: true,
		}
	default:
		title := previewString(preview, "title")
		subtitle := joinPreviewParts(title, reason)
		if subtitle == "" {
			subtitle = "Confirme para prosseguir com a execução."
		}
		finalAnswer = "Preparei a ação solicitada. Deseja confirmar a execução?"
		card = domain.ChatCard{
			ID:          pendingID,
			Type:        "confirm",
			Title:       "Confirmar ação",
			Subtitle:    subtitle,
			ActionLabel: "Confirmar",
			Confirm:     true,
			Dismiss:     true,
		}
	}
	return
}

// FormatCancelledAction gera resposta amigável em PT-BR quando o usuário cancela uma ação pendente.
func FormatCancelledAction(operation string) string {
	switch operation {
	case "send_message":
		return "Envio da mensagem cancelado. Nada foi enviado."
	case "send_email":
		return "Envio do e-mail cancelado. Nada foi enviado."
	case "create_todo":
		return "Criação da tarefa cancelada. Nada foi criado."
	case "create_event":
		return "Agendamento cancelado. Nenhum evento foi criado."
	case "create_booking_link":
		return "Criação do link de agendamento cancelada."
	case "create_bot", "create_trigger":
		return "Criação do bot cancelada."
	case "delete_todo", "delete_event", "delete_events_batch":
		return "Exclusão cancelada. Seus itens foram mantidos."
	default:
		return "Ação cancelada. Nenhuma alteração foi feita."
	}
}

// FormatActionError gera resposta amigável em PT-BR quando uma ação confirmada falha.
func FormatActionError(operation string, err error) string {
	switch operation {
	case "send_message", "send_email":
		return fmt.Sprintf("Não consegui concluir o envio: %v", err)
	default:
		return fmt.Sprintf("Não consegui concluir a ação solicitada: %v", err)
	}
}
