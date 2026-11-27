package whatsapp

import (
	"context"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// SetContactRepository injeta o repositório de contatos persistidos.
func (h *WhatsAppHandler) SetContactRepository(repo domain.SyncedContactRepository) {
	h.contactRepo = repo
}

// persistSyncedContacts grava os contatos na tabela relacional synced_contacts.
func (h *WhatsAppHandler) persistSyncedContacts(ctx context.Context, userID string, names []SavedContactName) int64 {
	if h.contactRepo == nil || len(names) == 0 {
		return 0
	}

	synced := make([]domain.SyncedContact, 0, len(names))
	now := time.Now().UTC()
	for _, n := range names {
		phone := strings.TrimSpace(n.Phone)
		name := strings.TrimSpace(n.Name)
		if phone == "" || name == "" {
			continue
		}
		digits := domain.PhoneDigits(phone)
		if digits == "" {
			continue
		}
		synced = append(synced, domain.SyncedContact{
			UserID:      userID,
			Phone:       phone,
			PhoneDigits: digits,
			JID:         digits + "@s.whatsapp.net",
			SavedName:   name,
			Source:      "phonebook",
			CreatedAt:   now,
			UpdatedAt:   now,
		})
	}

	if len(synced) == 0 {
		return 0
	}
	n, err := h.contactRepo.UpsertBatch(ctx, synced)
	if err != nil {
		return 0
	}
	return n
}

// RegisterWebhookRoutes registra os webhooks da Evolution API (montados fora do apiLimiter).
func (h *WhatsAppHandler) RegisterWebhookRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Post("/integrations/whatsapp/webhook", h.Webhook)
	r.Post("/integrations/whatsapp/webhook/{event}", h.Webhook)
}

// RegisterRoutes registra os endpoints protegidos da integração com WhatsApp.
func (h *WhatsAppHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/integrations/whatsapp", func(wr chi.Router) {
		wr.Get("/status", h.GetStatus)
		wr.Post("/pairing-code", h.RequestPairingCode)
		wr.Delete("/disconnect", h.Disconnect)
		wr.Get("/contacts", h.GetContacts)
		wr.Get("/context-settings", h.GetContextSettings)
		wr.Put("/context-settings", h.UpdateContextSettings)
		wr.Get("/context-preview", h.GetContextPreview)
		wr.Get("/context-directory", h.GetContextDirectory)
		wr.Get("/media-status", h.GetMediaStatus)
		wr.Get("/contacts-cache", h.GetContactsCache)
		wr.Put("/contact-profile", h.UpdateContactProfile)
		wr.Post("/contact-names", h.ImportContactNames)
		wr.Post("/media-process", h.ProcessMedia)
		wr.Delete("/context-messages", h.PurgeContextMessages)
	})
}
