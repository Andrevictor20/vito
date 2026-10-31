package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// nudgeCollector captura os pushes do Radar.
type nudgeCollector struct {
	pushes []struct {
		UserID string
		Title  string
		Body   string
	}
}

func (n *nudgeCollector) SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error) {
	n.pushes = append(n.pushes, struct {
		UserID string
		Title  string
		Body   string
	}{UserID: userID, Title: title, Body: body})
	return 1, nil
}

// stubRepo devolve uma integração conectada.
type stubRepo struct {
	domain.WhatsAppRepository
	integrations []domain.WhatsAppIntegration
}

func (s *stubRepo) ListAll(ctx context.Context) ([]domain.WhatsAppIntegration, error) {
	return s.integrations, nil
}

// Notificações automáticas de cobrança de contatos sem resposta no WhatsApp foram removidas.
func TestWhatsAppReplyNudgeWorker_OnlyNudgesOldPendingOnce(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()

	archiveChat(t, fx, "n1", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "me ajuda com o contrato", false, now.Add(-30*time.Hour))
	archiveChat(t, fx, "n2", "5511888887778@s.whatsapp.net", domain.WhatsAppChatKindDirect, "João", "oi", false, now.Add(-2*time.Hour))

	dir := service.NewWhatsAppDirectoryService(fx.repo, service.DefaultWhatsAppContextConfig(), nil)
	notif := &nudgeCollector{}
	repo := &stubRepo{integrations: []domain.WhatsAppIntegration{{
		UserID:       "user-ctx-1",
		InstanceName: "vito_ctx_user",
		Status:       domain.WhatsAppStatusConnected,
	}}}

	worker := service.NewWhatsAppReplyNudgeWorker(dir, repo, notif, 24*time.Hour, 24*time.Hour)
	worker.RunOnce()

	if len(notif.pushes) != 0 {
		t.Fatalf("não deveria enviar notificações de cobrança de resposta no WhatsApp, obteve %d: %+v", len(notif.pushes), notif.pushes)
	}
}

// contains é um helper simples de substring.
func contains(haystack, needle string) bool {
	return len(needle) == 0 || (len(haystack) >= len(needle) && indexOf(haystack, needle) >= 0)
}

func indexOf(haystack, needle string) int {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}
