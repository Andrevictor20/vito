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

// O JID do chat "Você" carrega um prefixo sobre o número (observado em produção:
// "047559884097322@s.whatsapp.net" para o número "559884097322").
func TestClassifyChat_SelfChatWithPrefixedJID(t *testing.T) {
	cases := []struct {
		name  string
		jid   string
		phone string
	}{
		{"prefixo do note-to-self", "047559884097322@s.whatsapp.net", "559884097322"},
		{"prefixo + 9o digito no telefone", "047559884097322@s.whatsapp.net", "5598984097322"},
		{"numero com 9o digito", "5598984097322@s.whatsapp.net", "559884097322"},
		{"numero simples", "559884097322@s.whatsapp.net", "559884097322"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			kind := service.ClassifyChat(tc.jid, tc.phone, 0, false)
			if kind != domain.WhatsAppChatKindSelf {
				t.Errorf("esperava %q, obteve %q", domain.WhatsAppChatKindSelf, kind)
			}
		})
	}
}

// Um contato cujo número NÃO é o do usuário nunca pode ser classificado como "self".
func TestClassifyChat_ThirdPartyIsNeverSelf(t *testing.T) {
	cases := []string{
		"5511888887777@s.whatsapp.net",
		"471331507024120@lid",
		"276041859870765@lid",
	}
	for _, jid := range cases {
		kind := service.ClassifyChat(jid, "559884097322", 0, false)
		if kind == domain.WhatsAppChatKindSelf {
			t.Errorf("JID de terceiro %q foi classificado como self", jid)
		}
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

func TestClassifyChat_BroadcastAndNewsletter(t *testing.T) {
	cases := []struct {
		name     string
		jid      string
		expected string
	}{
		{"status do WhatsApp", "status@broadcast", domain.WhatsAppChatKindBroadcast},
		{"lista de transmissao", "123456789@broadcast", domain.WhatsAppChatKindBroadcast},
		{"canal newsletter", "120363123456789@newsletter", domain.WhatsAppChatKindNewsletter},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			kind := service.ClassifyChat(tc.jid, "5511999998888", 0, false)
			if kind != tc.expected {
				t.Errorf("esperava %q para %s, obteve %q", tc.expected, tc.jid, kind)
			}
		})
	}
}
