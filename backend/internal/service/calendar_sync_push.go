package service

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/crypto"
	"github.com/andrevmp/vito/backend/internal/domain"
)

func isAuthError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "401") ||
		strings.Contains(msg, "403") ||
		strings.Contains(msg, "expired") ||
		strings.Contains(msg, "invalid_token") ||
		strings.Contains(msg, "invalid_grant") ||
		strings.Contains(msg, "unauthorized") ||
		strings.Contains(msg, "autherror") ||
		strings.Contains(msg, "credentials")
}

// PushEvent propaga um evento do Vito para todas as integrações ativas do usuário.
func (s *CalendarSyncService) PushEvent(ctx context.Context, userID string, event *domain.Event) error {
	integrations, err := s.syncRepo.ListIntegrationsByUser(userID)
	if err != nil || len(integrations) == 0 {
		return nil
	}

	hash := ComputeContentHash(event.Title, event.Description, event.Location, event.StartAt, event.EndAt)
	now := time.Now().UTC()
	var lastErr error

	for _, integ := range integrations {
		if integ.Status != domain.IntegrationStatusActive {
			continue
		}

		p, err := s.getProvider(integ.Provider)
		if err != nil {
			lastErr = err
			log.Printf("[CalendarSync] Provedor '%s' não encontrado para usuário %s: %v", integ.Provider, userID, err)
			continue
		}

		creds, err := crypto.Decrypt(integ.EncryptedCredentials, s.encKey)
		if err != nil {
			lastErr = err
			log.Printf("[CalendarSync] Falha ao descriptografar credenciais para %s (usuário %s): %v", integ.Provider, userID, err)
			continue
		}

		mapping, err := s.syncRepo.GetMappingByEventID(event.ID, integ.Provider)
		if err == nil && mapping != nil {
			if mapping.ContentHash == hash {
				continue // Já sincronizado com mesmo hash
			}

			updated, err := p.UpdateEvent(ctx, creds, integ.CalendarID, mapping.ExternalEventID, event)
			if err != nil && isAuthError(err) {
				if newCreds, rErr := p.RefreshToken(ctx, creds); rErr == nil && newCreds != "" {
					creds = newCreds
					if enc, encErr := crypto.Encrypt(newCreds, s.encKey); encErr == nil {
						integ.EncryptedCredentials = enc
						_ = s.syncRepo.UpsertIntegration(&integ)
					}
					updated, err = p.UpdateEvent(ctx, creds, integ.CalendarID, mapping.ExternalEventID, event)
				}
			}
			if err != nil {
				lastErr = err
				log.Printf("[CalendarSync] Falha ao atualizar evento '%s' em %s (%s): %v", event.Title, integ.Provider, integ.AccountEmail, err)
			} else if updated != nil {
				mapping.ContentHash = hash
				mapping.ExternalETag = updated.ETag
				mapping.LastSyncedAt = now
				_ = s.syncRepo.UpsertMapping(mapping)
				log.Printf("[CalendarSync] Evento '%s' atualizado com sucesso em %s (%s)", event.Title, integ.Provider, integ.AccountEmail)
			}
		} else {
			created, err := p.CreateEvent(ctx, creds, integ.CalendarID, event)
			if err != nil && isAuthError(err) {
				if newCreds, rErr := p.RefreshToken(ctx, creds); rErr == nil && newCreds != "" {
					creds = newCreds
					if enc, encErr := crypto.Encrypt(newCreds, s.encKey); encErr == nil {
						integ.EncryptedCredentials = enc
						_ = s.syncRepo.UpsertIntegration(&integ)
					}
					created, err = p.CreateEvent(ctx, creds, integ.CalendarID, event)
				}
			}
			if err != nil {
				lastErr = err
				log.Printf("[CalendarSync] Falha ao propagar evento '%s' para %s (%s): %v", event.Title, integ.Provider, integ.AccountEmail, err)
			} else if created != nil {
				newMap := &domain.ExternalEventMapping{
					ID:              uuid.New().String(),
					EventID:         event.ID,
					UserID:          userID,
					Provider:        integ.Provider,
					ExternalEventID: created.ExternalID,
					ExternalETag:    created.ETag,
					ContentHash:     hash,
					LastSyncedAt:    now,
					Status:          "synced",
				}
				_ = s.syncRepo.UpsertMapping(newMap)
				log.Printf("[CalendarSync] Evento '%s' criado com sucesso em %s (%s, extID %s)", event.Title, integ.Provider, integ.AccountEmail, created.ExternalID)
			}
		}
	}

	return lastErr
}

// DeleteEvent remove um evento do Vito e propaga a exclusão para as agendas remotas.
func (s *CalendarSyncService) DeleteEvent(ctx context.Context, userID, eventID string) error {
	integrations, err := s.syncRepo.ListIntegrationsByUser(userID)
	if err == nil {
		for _, integ := range integrations {
			mapping, mErr := s.syncRepo.GetMappingByEventID(eventID, integ.Provider)
			if mErr == nil && mapping != nil {
				p, pErr := s.getProvider(integ.Provider)
				if pErr == nil {
					creds, cErr := crypto.Decrypt(integ.EncryptedCredentials, s.encKey)
					if cErr == nil {
						_ = p.DeleteEvent(ctx, creds, integ.CalendarID, mapping.ExternalEventID)
					}
				}
				_ = s.syncRepo.DeleteMapping(mapping.ID)
			}
		}
	}

	return s.eventRepo.Delete(eventID, userID)
}
