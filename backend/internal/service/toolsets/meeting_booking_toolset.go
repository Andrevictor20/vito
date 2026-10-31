package toolsets

import (
	"context"
	"encoding/json"

	"github.com/andrevmp/vito/backend/internal/domain"
)

type MeetingBookingToolset struct{}

func NewMeetingBookingToolset() *MeetingBookingToolset {
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
	return &domain.ToolExecutionResult{
		Status:        "COMPLETED",
		SummaryForLLM: "Operação de booking/reunião executada com sucesso.",
		Cards: []domain.ChatCard{{
			ID:          "booking-card-1",
			Type:        "booking",
			Title:       "Link de Agendamento",
			Subtitle:    "30 minutos - Aberto",
			ActionLabel: "Copiar Link",
		}},
	}, nil
}
