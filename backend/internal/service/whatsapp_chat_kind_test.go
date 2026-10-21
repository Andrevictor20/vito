package service_test

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// AC-F15/AC-F16/AC-F17/AC-F18 — classificação de chat e escopo do contexto cross-chat.
func TestClassifyChat_SelfDetectedByPhone(t *testing.T) {
	kind := service.ClassifyChat("5511999998888@s.whatsapp.net", "5511999998888", 0, false)
	if kind != domain.WhatsAppChatKindSelf {
		t.Errorf("esperava %q, obteve %q", domain.WhatsAppChatKindSelf, kind)
	}
}

func TestClassifyChat_SelfGroupOnlyWhenSingleParticipantIsFresh(t *testing.T) {
	cases := []struct {
		name         string
		participants int
		fresh        bool
		expected     string
	}{
		{"grupo so com eu, dados frescos", 1, true, domain.WhatsAppChatKindSelfGroup},
		{"grupo so com eu, dados obsoletos", 1, false, domain.WhatsAppChatKindGroup},
		{"grupo com outras pessoas", 4, true, domain.WhatsAppChatKindGroup},
		{"grupo sem dados de participantes", 0, false, domain.WhatsAppChatKindGroup},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			kind := service.ClassifyChat("12036300112233@g.us", "5511999998888", tc.participants, tc.fresh)
			if kind != tc.expected {
				t.Errorf("esperava %q, obteve %q", tc.expected, kind)
			}
		})
	}
}

func TestClassifyChat_DirectWithThirdParty(t *testing.T) {
	kind := service.ClassifyChat("5511888887777@s.whatsapp.net", "5511999998888", 0, false)
	if kind != domain.WhatsAppChatKindDirect {
		t.Errorf("esperava %q, obteve %q", domain.WhatsAppChatKindDirect, kind)
	}
}

func TestAllowsCrossChat_OnlyPersonalChats(t *testing.T) {
	allowed := map[string]bool{
		domain.WhatsAppChatKindSelf:      true,
		domain.WhatsAppChatKindSelfGroup: true,
		domain.WhatsAppChatKindGroup:     false,
		domain.WhatsAppChatKindDirect:    false,
	}
	for kind, expected := range allowed {
		if got := service.AllowsCrossChat(kind); got != expected {
			t.Errorf("AllowsCrossChat(%q) = %v, esperava %v", kind, got, expected)
		}
	}
}

func TestRequiresTrigger_OnlyChatsWithThirdParties(t *testing.T) {
	required := map[string]bool{
		domain.WhatsAppChatKindSelf:      false,
		domain.WhatsAppChatKindSelfGroup: false,
		domain.WhatsAppChatKindGroup:     true,
		domain.WhatsAppChatKindDirect:    true,
	}
	for kind, expected := range required {
		if got := service.RequiresTrigger(kind); got != expected {
			t.Errorf("RequiresTrigger(%q) = %v, esperava %v", kind, got, expected)
		}
	}
}
