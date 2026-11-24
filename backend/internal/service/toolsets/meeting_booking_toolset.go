package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"unicode"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

type BookingServiceContract interface {
	ListBookingTypes(ctx context.Context, userID string) ([]*domain.BookingType, error)
	CreateBookingType(ctx context.Context, userID string, bt *domain.BookingType) (*domain.BookingType, string, error)
}

type MeetingBookingToolset struct {
	svc BookingServiceContract
}

func NewMeetingBookingToolset(svc ...BookingServiceContract) *MeetingBookingToolset {
	if len(svc) > 0 && svc[0] != nil {
		return &MeetingBookingToolset{svc: svc[0]}
	}
	return &MeetingBookingToolset{}
}

func (t *MeetingBookingToolset) Name() domain.ToolsetName {
	return domain.ToolsetMeetingBooking
}

func (t *MeetingBookingToolset) Description() string {
	return "Gerencia links públicos de agendamento (booking) e reuniões presenciais/remotas do usuário."
}

func (t *MeetingBookingToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["list_booking_types", "create_booking_link"],
				"description": "Operação de booking a executar."
			},
			"params": {
				"type": "object",
				"properties": {
					"title": {"type": "string", "description": "Título do tipo de reunião."},
					"duration_minutes": {"type": "integer", "description": "Duração em minutos."}
				}
			}
		},
		"required": ["operation"]
	}`)
}

func (t *MeetingBookingToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	preview := make(map[string]any)
	_ = json.Unmarshal(rawParams, &preview)
	if op == "create_booking_link" {
		return true, false, preview
	}
	return false, false, preview
}

func (t *MeetingBookingToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	if t.svc == nil {
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Serviço de agendamento e booking não configurado.",
		}, nil
	}

	var params struct {
		Title           string `json:"title"`
		DurationMinutes int    `json:"duration_minutes"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	switch op {
	case "create_booking_link":
		duration := params.DurationMinutes
		if duration <= 0 {
			duration = 30
		}
		title := strings.TrimSpace(params.Title)
		if title == "" {
			title = "Conversa com Vito"
		}
		bt := &domain.BookingType{
			Title:           title,
			Slug:            fmt.Sprintf("%s-%s", slugifyBookingTitle(title), uuid.New().String()[:6]),
			DurationMinutes: duration,
			IsActive:        true,
		}
		var saved *domain.BookingType
		var link, shortLink string
		var err error
		if fullSvc, ok := t.svc.(interface {
			CreateBookingTypeWithLinks(ctx context.Context, userID string, bt *domain.BookingType) (*domain.BookingType, string, string, error)
		}); ok {
			saved, link, shortLink, err = fullSvc.CreateBookingTypeWithLinks(ctx, execCtx.UserID, bt)
		} else {
			saved, link, err = t.svc.CreateBookingType(ctx, execCtx.UserID, bt)
			shortLink = link
		}
		if err != nil {
			return nil, err
		}
		return &domain.ToolExecutionResult{
			Status: "COMPLETED",
			Data: map[string]any{
				"booking":           saved,
				"booking_url":       link,
				"booking_short_url": shortLink,
			},
			SummaryForLLM: fmt.Sprintf("Link de agendamento '%s' criado com sucesso: %s", saved.Title, link),
			Cards: []domain.ChatCard{{
				ID:          saved.ID,
				Type:        "booking",
				Title:       saved.Title,
				Subtitle:    fmt.Sprintf("%d minutos", saved.DurationMinutes),
				ActionLabel: "Copiar Link",
				ActionValue: link,
			}},
		}, nil

	default: // "list_booking_types"
		list, err := t.svc.ListBookingTypes(ctx, execCtx.UserID)
		if err != nil {
			return nil, err
		}
		if len(list) == 0 {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "O usuário não possui nenhum link público de agendamento ativo no momento.",
			}, nil
		}
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("O usuário possui %d tipos de agendamento ativos:\n", len(list)))
		var cards []domain.ChatCard
		for _, b := range list {
			sb.WriteString(fmt.Sprintf("- %s (%d min, slug: %s)\n", b.Title, b.DurationMinutes, b.Slug))
			cards = append(cards, domain.ChatCard{
				ID:          b.ID,
				Type:        "booking",
				Title:       b.Title,
				Subtitle:    fmt.Sprintf("%d minutos", b.DurationMinutes),
				ActionLabel: "Ver Link",
			})
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: sb.String(),
			Cards:         cards,
		}, nil
	}
}

func slugifyBookingTitle(title string) string {
	var b strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(strings.TrimSpace(title)) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if r > 127 {
				switch r {
				case 'á', 'à', 'â', 'ã':
					r = 'a'
				case 'é', 'ê':
					r = 'e'
				case 'í':
					r = 'i'
				case 'ó', 'ô', 'õ':
					r = 'o'
				case 'ú':
					r = 'u'
				case 'ç':
					r = 'c'
				default:
					continue
				}
			}
			b.WriteRune(r)
			lastDash = false
		} else if !lastDash && b.Len() > 0 {
			b.WriteByte('-')
			lastDash = true
		}
	}
	res := strings.Trim(b.String(), "-")
	if res == "" {
		return "agendamento"
	}
	return res
}
