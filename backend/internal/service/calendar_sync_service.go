package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
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

// ClassifyEvent infere a categoria e cor semântica a partir de palavras-chave no título e descrição.
func ClassifyEvent(title, description string) (string, string) {
	text := strings.ToLower(title + " " + description)

	// Trabalho / Reuniões (#38BDF8)
	workTerms := []string{"reunião", "reuniao", "daily", "align", "alinhamento", "1:1", "review", "sprint", "meet", "call", "apresentação", "apresentacao", "entrevista", "cliente", "projeto", "demo", "deploy"}
	for _, term := range workTerms {
		if strings.Contains(text, term) {
			return "work", "#38BDF8"
		}
	}

	// Saúde / Bem-Estar (#34D399)
	healthTerms := []string{"médico", "medico", "consulta", "exame", "dentista", "academia", "treino", "pilates", "fisio", "terapia", "remédio", "remedio", "oftalmo", "psicolog", "nutri", "corrida"}
	for _, term := range healthTerms {
		if strings.Contains(text, term) {
			return "health", "#34D399"
		}
	}

	// Finanças (#F87171)
	financeTerms := []string{"fatura", "pagar", "pagamento", "imposto", "banco", "conta", "boleto", "salário", "salario", "aluguel", "irpf", "darf"}
	for _, term := range financeTerms {
		if strings.Contains(text, term) {
			return "finance", "#F87171"
		}
	}

	// Estudo / Educação (#818CF8)
	studyTerms := []string{"aula", "curso", "faculdade", "prova", "seminário", "seminario", "workshop", "mentoria", "estudo", "tcc", "palestra"}
	for _, term := range studyTerms {
		if strings.Contains(text, term) {
			return "study", "#818CF8"
		}
	}

	// Lazer / Social (#FBBF24)
	leisureTerms := []string{"churrasco", "chopp", "cerveja", "bar", "festa", "cinema", "show", "viagem", "praia", "jogo", "jantar", "aniversário", "aniversario", "parabéns", "parabens"}
	for _, term := range leisureTerms {
		if strings.Contains(text, term) {
			return "leisure", "#FBBF24"
		}
	}

	// Pessoal / Família (#D0BCFF)
	personalTerms := []string{"família", "familia", "mãe", "mae", "pai", "filho", "filha", "casa", "compras", "mercado", "levar", "buscar"}
	for _, term := range personalTerms {
		if strings.Contains(text, term) {
			return "personal", "#D0BCFF"
		}
	}

	return "general", "#94A3B8"
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
	from := now.Add(-60 * 24 * time.Hour) // 60 dias atrás
	to := now.Add(180 * 24 * time.Hour)   // 6 meses à frente

	// Se o usuário ainda não possui nenhum evento sincronizado desta integração no banco local,
	// força uma sincronização completa (syncToken = "") para garantir a carga inicial de eventos
	syncToken := integration.SyncToken
	existingEvents, _ := s.eventRepo.ListByUser(userID, from, to)
	hasSyncedEvents := false
	for _, ev := range existingEvents {
		if ev.Source == providerName {
			hasSyncedEvents = true
			break
		}
	}
	if !hasSyncedEvents {
		syncToken = ""
	}

	// 1. Inbound Fetch com auto-refresh de credenciais em caso de 401
	res, err := p.FetchEvents(ctx, creds, integration.CalendarID, syncToken, from, to)
	if err != nil && (strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "expired") || strings.Contains(err.Error(), "invalid_token")) {
		newCreds, refreshErr := p.RefreshToken(ctx, creds)
		if refreshErr == nil && newCreds != "" {
			creds = newCreds
			if enc, encErr := crypto.Encrypt(newCreds, s.encKey); encErr == nil {
				integration.EncryptedCredentials = enc
				_ = s.syncRepo.UpsertIntegration(integration)
			}
			res, err = p.FetchEvents(ctx, creds, integration.CalendarID, syncToken, from, to)
		}
	}
	if err != nil {
		log.Printf("[CalendarSync] Erro no FetchEvents para usuário %s: %v", userID, err)
		return err
	}

	// Trata expiração do token de sync remoto ou fallback para sync completo se syncToken delta estiver vazio
	if res.FullSyncReq || (syncToken != "" && len(res.Items) == 0) {
		fullRes, fullErr := p.FetchEvents(ctx, creds, integration.CalendarID, "", from, to)
		if fullErr == nil && len(fullRes.Items) > 0 {
			res = fullRes
		} else if res.FullSyncReq {
			return fullErr
		}
	}

	log.Printf("[CalendarSync] Processando %d eventos para usuário %s (provedor %s)", len(res.Items), userID, providerName)

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

		cat := item.Category
		col := item.Color
		if cat == "" || col == "" {
			cat, col = ClassifyEvent(item.Title, item.Description)
		}

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
				evt.Category = cat
				evt.Color = col
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
				Category:    cat,
				Color:       col,
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
			} else {
				log.Printf("[CalendarSync] Falha ao persistir evento '%s' no SQLite: %v", item.Title, err)
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
