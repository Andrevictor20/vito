package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/crypto"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/integrations/calendar"
)

// CalendarSyncService orquestra integrações bidirecionais com calendários remotos.
type CalendarSyncService struct {
	syncRepo  domain.CalendarSyncRepository
	eventRepo domain.EventRepository
	encKey    string
	providers map[string]calendar.Provider
	mu        sync.RWMutex
}

// NewCalendarSyncService instancia o serviço de sincronização.
func NewCalendarSyncService(syncRepo domain.CalendarSyncRepository, eventRepo domain.EventRepository, encKey string) *CalendarSyncService {
	return &CalendarSyncService{
		syncRepo:  syncRepo,
		eventRepo: eventRepo,
		encKey:    encKey,
		providers: make(map[string]calendar.Provider),
	}
}

// RegisterProvider registra um adaptador de provedor de calendário (Google, Apple, etc).
func (s *CalendarSyncService) RegisterProvider(p calendar.Provider) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.providers[p.Name()] = p
}

func (s *CalendarSyncService) getProvider(name string) (calendar.Provider, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.providers[name]
	if !ok {
		return nil, domain.ErrInvalidProvider
	}
	return p, nil
}

// ComputeContentHash gera um hash SHA-256 estável baseado nos campos centrais do evento para supressão de eco.
func ComputeContentHash(title, description, location string, startAt, endAt time.Time) string {
	payload := fmt.Sprintf("%s|%s|%s|%d|%d",
		strings.TrimSpace(title),
		strings.TrimSpace(description),
		strings.TrimSpace(location),
		startAt.UTC().Unix(),
		endAt.UTC().Unix(),
	)
	hash := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(hash[:])
}

// ConnectIntegration armazena de forma criptografada as credenciais e ativa a integração.
func (s *CalendarSyncService) ConnectIntegration(ctx context.Context, userID, provider, email, rawCredentials, calendarID, calendarName string) (*domain.CalendarIntegration, error) {
	encrypted, err := crypto.Encrypt(rawCredentials, s.encKey)
	if err != nil {
		return nil, fmt.Errorf("falha ao criptografar credenciais: %w", err)
	}

	if calendarID == "" {
		calendarID = "primary"
	}

	now := time.Now().UTC()
	integration := &domain.CalendarIntegration{
		ID:                   uuid.New().String(),
		UserID:               userID,
		Provider:             provider,
		AccountEmail:         email,
		EncryptedCredentials: encrypted,
		CalendarID:           calendarID,
		CalendarName:         calendarName,
		Status:               domain.IntegrationStatusActive,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if err := s.syncRepo.UpsertIntegration(integration); err != nil {
		return nil, err
	}

	return integration, nil
}

// DisconnectIntegration desativa a integração e remove credenciais locais.
func (s *CalendarSyncService) DisconnectIntegration(ctx context.Context, userID, provider string) error {
	return s.syncRepo.DeleteIntegration(userID, provider)
}

// ListIntegrations lista as contas ativas do usuário.
func (s *CalendarSyncService) ListIntegrations(ctx context.Context, userID string) ([]domain.CalendarIntegration, error) {
	return s.syncRepo.ListIntegrationsByUser(userID)
}

// GetIntegration busca uma integração específica.
func (s *CalendarSyncService) GetIntegration(ctx context.Context, userID, provider string) (*domain.CalendarIntegration, error) {
	return s.syncRepo.GetIntegration(userID, provider)
}

// SyncIntegration executa o ciclo de sincronização Inbound e Outbound para um provedor específico.
func (s *CalendarSyncService) SyncIntegration(ctx context.Context, userID, providerName string) error {
	integration, err := s.syncRepo.GetIntegration(userID, providerName)
	if err != nil {
		return err
	}

	p, err := s.getProvider(providerName)
	if err != nil {
		return err
	}

	creds, err := crypto.Decrypt(integration.EncryptedCredentials, s.encKey)
	if err != nil {
		return fmt.Errorf("falha ao descriptografar credenciais para sync: %w", err)
	}

	now := time.Now().UTC()
	from := now.Add(-30 * 24 * time.Hour)
	to := now.Add(90 * 24 * time.Hour)

	// 1. Inbound Fetch
	res, err := p.FetchEvents(ctx, creds, integration.CalendarID, integration.SyncToken, from, to)
	if err != nil {
		return err
	}

	// Trata expiração do token de sync remoto
	if res.FullSyncReq {
		res, err = p.FetchEvents(ctx, creds, integration.CalendarID, "", from, to)
		if err != nil {
			return err
		}
	}

	// Processa eventos retornados
	for _, item := range res.Items {
		mapping, err := s.syncRepo.GetMappingByExternalID(userID, providerName, item.ExternalID)

		if item.Status == "cancelled" {
			if err == nil && mapping != nil {
				_ = s.eventRepo.Delete(mapping.EventID, userID)
				_ = s.syncRepo.DeleteMapping(mapping.ID)
			}
			continue
		}

		itemHash := ComputeContentHash(item.Title, item.Description, item.Location, item.StartAt, item.EndAt)

		if err == nil && mapping != nil {
			// Prevenção de loop (Echo Suppression): Se o hash for idêntico ao já gravado, descarta o ciclo
			if mapping.ContentHash == itemHash {
				continue
			}

			// Modificação remota real: atualiza evento no Vito
			evt, getErr := s.eventRepo.GetByID(mapping.EventID, userID)
			if getErr == nil && evt != nil {
				evt.Title = item.Title
				evt.Description = item.Description
				evt.Location = item.Location
				evt.StartAt = item.StartAt
				evt.EndAt = item.EndAt
				evt.UpdatedAt = now
				_ = s.eventRepo.Create(evt) // Inserção/atualização por ID
			}

			mapping.ContentHash = itemHash
			mapping.ExternalETag = item.ETag
			mapping.LastSyncedAt = now
			_ = s.syncRepo.UpsertMapping(mapping)
		} else {
			// Evento novo originado na nuvem: cadastra no Vito
			newID := uuid.New().String()
			newEvent := &domain.Event{
				ID:          newID,
				UserID:      userID,
				Title:       item.Title,
				Description: item.Description,
				Location:    item.Location,
				StartAt:     item.StartAt,
				EndAt:       item.EndAt,
				Source:      providerName,
				CreatedAt:   now,
				UpdatedAt:   now,
			}

			if err := s.eventRepo.Create(newEvent); err == nil {
				newMap := &domain.ExternalEventMapping{
					ID:              uuid.New().String(),
					EventID:         newID,
					UserID:          userID,
					Provider:        providerName,
					ExternalEventID: item.ExternalID,
					ExternalETag:    item.ETag,
					ContentHash:     itemHash,
					LastSyncedAt:    now,
					Status:          "synced",
				}
				_ = s.syncRepo.UpsertMapping(newMap)
			}
		}
	}

	// 2. Outbound Tombstones
	tombstones, _ := s.syncRepo.ListTombstones(userID, providerName)
	for _, t := range tombstones {
		if delErr := p.DeleteEvent(ctx, creds, integration.CalendarID, t.ExternalEventID); delErr == nil {
			_ = s.syncRepo.DeleteTombstone(t.ID)
		}
	}

	// 3. Atualiza estado da integração
	if res.NewSyncToken != "" {
		integration.SyncToken = res.NewSyncToken
	}
	integration.LastSyncedAt = &now
	integration.UpdatedAt = now
	return s.syncRepo.UpsertIntegration(integration)
}

// PushEvent propaga um evento do Vito para todas as integrações ativas do usuário.
func (s *CalendarSyncService) PushEvent(ctx context.Context, userID string, event *domain.Event) error {
	integrations, err := s.syncRepo.ListIntegrationsByUser(userID)
	if err != nil || len(integrations) == 0 {
		return nil
	}

	hash := ComputeContentHash(event.Title, event.Description, event.Location, event.StartAt, event.EndAt)
	now := time.Now().UTC()

	for _, integ := range integrations {
		if integ.Status != domain.IntegrationStatusActive {
			continue
		}

		p, err := s.getProvider(integ.Provider)
		if err != nil {
			continue
		}

		creds, err := crypto.Decrypt(integ.EncryptedCredentials, s.encKey)
		if err != nil {
			continue
		}

		mapping, err := s.syncRepo.GetMappingByEventID(event.ID, integ.Provider)
		if err == nil && mapping != nil {
			if mapping.ContentHash == hash {
				continue // Já sincronizado com mesmo hash
			}

			updated, err := p.UpdateEvent(ctx, creds, integ.CalendarID, mapping.ExternalEventID, event)
			if err == nil && updated != nil {
				mapping.ContentHash = hash
				mapping.ExternalETag = updated.ETag
				mapping.LastSyncedAt = now
				_ = s.syncRepo.UpsertMapping(mapping)
			}
		} else {
			created, err := p.CreateEvent(ctx, creds, integ.CalendarID, event)
			if err == nil && created != nil {
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
			}
		}
	}

	return nil
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
