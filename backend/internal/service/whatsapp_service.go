package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppServiceConfig armazena parâmetros do serviço de integração com WhatsApp.
type WhatsAppServiceConfig struct {
	WebhookBaseURL  string
	EvolutionAPIURL string
	EvolutionAPIKey string
	HTTPClient      *http.Client
}

// NotificationSender define a interface para despacho de push notifications.
type NotificationSender interface {
	SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error)
}

// WhatsAppService gerencia o pareamento, sincronização de estado e webhook do WhatsApp.
type WhatsAppService struct {
	cfg              WhatsAppServiceConfig
	repo             domain.WhatsAppRepository
	client           EvolutionAPIClient
	assistantSvc     *AssistantService
	notifSender      NotificationSender
	audioTranscriber ai.AudioTranscriber
	userRepo         domain.UserRepository
	memory           *WhatsAppConversationMemory
	contextSvc       *WhatsAppContextService
	groupMeta        *WhatsAppGroupMeta
	ownerCache       *WhatsAppOwnerCache
	contactsCache    *WhatsAppContactsCache
	contextDebugLog  bool
	labelsMu         sync.RWMutex
	chatLabels       map[string]string
}

// NewWhatsAppService instancia o serviço do WhatsApp.
func NewWhatsAppService(
	cfg WhatsAppServiceConfig,
	repo domain.WhatsAppRepository,
	client EvolutionAPIClient,
	assistantSvc *AssistantService,
) *WhatsAppService {
	return &WhatsAppService{
		cfg:          cfg,
		repo:         repo,
		client:       client,
		assistantSvc: assistantSvc,
		memory:       NewWhatsAppConversationMemory(),
	}
}

// SetNotificationSender injeta o serviço de notificações push no WhatsAppService.
func (s *WhatsAppService) SetNotificationSender(sender NotificationSender) {
	s.notifSender = sender
}

// SetAudioTranscriber injeta o transcritor de áudio (Groq Whisper) no WhatsAppService.
func (s *WhatsAppService) SetAudioTranscriber(transcriber ai.AudioTranscriber) {
	s.audioTranscriber = transcriber
}

// SetUserRepo injeta o repositório de usuários para discovery social de contatos.
func (s *WhatsAppService) SetUserRepo(userRepo domain.UserRepository) {
	s.userRepo = userRepo
}

// SetContextService injeta o serviço de contexto conversacional do WhatsApp.
func (s *WhatsAppService) SetContextService(contextSvc *WhatsAppContextService) {
	s.contextSvc = contextSvc
}

// SetGroupMeta injeta o cache de metadados de grupo (participantes e nomes).
func (s *WhatsAppService) SetGroupMeta(groupMeta *WhatsAppGroupMeta) {
	s.groupMeta = groupMeta
}

// SetOwnerCache injeta o cache do JID do owner (número realmente pareado).
func (s *WhatsAppService) SetOwnerCache(ownerCache *WhatsAppOwnerCache) {
	s.ownerCache = ownerCache
}

// SetContactsCache injeta o cache de nomes de contato ( chats @lid chegam sem pushName).
func (s *WhatsAppService) SetContactsCache(cache *WhatsAppContactsCache) {
	s.contactsCache = cache
}

// SetContextDebugLog habilita o log do CONTEÚDO da janela de contexto.
// Opt-in: o conteúdo pode ter dados sensíveis e não deve ir para o log
// de produção sem uma decisão explícita.
func (s *WhatsAppService) SetContextDebugLog(enabled bool) {
	s.contextDebugLog = enabled
}

// SanitizePhoneNumber limpa e normaliza o número para o padrão internacional E.164 sem o '+'.
func SanitizePhoneNumber(raw string) (string, error) {
	re := regexp.MustCompile(`\D+`)
	digits := re.ReplaceAllString(raw, "")

	if len(digits) < 10 {
		return "", domain.ErrWhatsAppInvalidPhone
	}

	// Brasil: 10 ou 11 dígitos sem DDI (ex: 11988887777 ou 1188887777)
	if len(digits) == 10 || len(digits) == 11 {
		digits = "55" + digits
	}

	return digits, nil
}

// isMatchingPhone compara dois números considerando possíveis variações do 9º dígito brasileiro (DDI 55).
func isMatchingPhone(a, b string) bool {
	if a == b {
		return true
	}
	re := regexp.MustCompile(`\D+`)
	da := re.ReplaceAllString(a, "")
	db := re.ReplaceAllString(b, "")
	if da == db {
		return true
	}
	if strings.HasPrefix(da, "55") && strings.HasPrefix(db, "55") {
		if len(da) == 13 && len(db) == 12 && da[:4] == db[:4] && da[5:] == db[4:] {
			return true
		}
		if len(db) == 13 && len(da) == 12 && db[:4] == da[:4] && db[5:] == da[4:] {
			return true
		}
	}
	return false
}

// MakeInstanceName gera o identificador único da instância para a Evolution API.
func MakeInstanceName(userID string) string {
	clean := strings.ReplaceAll(userID, "-", "_")
	return fmt.Sprintf("vito_user_%s", clean)
}

// RequestPairingCode inicia a criação da instância e obtém o código de pareamento de 8 dígitos.
func (s *WhatsAppService) RequestPairingCode(ctx context.Context, userID, rawPhone string) (string, error) {
	phone, err := SanitizePhoneNumber(rawPhone)
	if err != nil {
		return "", err
	}

	instanceName := MakeInstanceName(userID)

	// Se a instância já existe mas não está conectada ("open"), remove a instância anterior
	// para evitar que um socket zumbi ou estado "connecting" com count:0 bloqueie o novo código.
	state, _ := s.client.GetConnectionState(ctx, instanceName)
	if !strings.EqualFold(state, "open") {
		_ = s.client.DeleteInstance(ctx, instanceName)
	}

	if err := s.client.CreateInstance(ctx, instanceName, phone); err != nil {
		log.Printf("⚠️ [WhatsAppService] Erro ao criar instância %s: %v", instanceName, err)
	}

	webhookURL := fmt.Sprintf("%s/api/v1/integrations/whatsapp/webhook", strings.TrimRight(s.cfg.WebhookBaseURL, "/"))
	if err := s.client.SetWebhook(ctx, instanceName, webhookURL); err != nil {
		log.Printf("⚠️ [WhatsAppService] Aviso ao configurar webhook para %s: %v", instanceName, err)
	}

	_ = s.client.SetSettings(ctx, instanceName, map[string]interface{}{
		"rejectCall":      false,
		"groupsIgnore":    false,
		"alwaysOnline":    false,
		"readMessages":    false,
		"readStatus":      false,
		"syncFullHistory": false,
	})

	code, err := s.client.GetPairingCode(ctx, instanceName, phone)
	if err != nil {
		// Tolerância para o Baileys inicializar pre-keys caso o primeiro GET ocorra durante o boot da instância
		time.Sleep(1 * time.Second)
		code, err = s.client.GetPairingCode(ctx, instanceName, phone)
		if err != nil {
			return "", fmt.Errorf("falha ao gerar código de pareamento: %w", err)
		}
	}

	existing, err := s.repo.GetByUserID(ctx, userID)
	integrationID := uuid.New().String()
	if err == nil && existing != nil {
		integrationID = existing.ID
	}

	integration := &domain.WhatsAppIntegration{
		ID:           integrationID,
		UserID:       userID,
		InstanceName: instanceName,
		Phone:        phone,
		Status:       domain.WhatsAppStatusConnecting,
		PairingCode:  code,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	if err := s.repo.Upsert(ctx, integration); err != nil {
		return "", fmt.Errorf("falha ao persistir sessão whatsapp: %w", err)
	}

	// Vincula o número de telefone à conta do usuário autenticado (Account Linking)
	if s.userRepo != nil && phone != "" {
		if existingUser, err := s.userRepo.GetByPhone(phone); err == nil && existingUser != nil {
			if existingUser.ID != userID && strings.HasSuffix(strings.ToLower(existingUser.Email), "@vito.local") {
				_ = s.userRepo.UpdatePhone(existingUser.ID, "")
			}
		}
		_ = s.userRepo.UpdatePhone(userID, phone)
	}

	return code, nil
}

// GetStatus retorna a sessão atual do WhatsApp sincronizando com a Evolution API se necessário.
func (s *WhatsAppService) GetStatus(ctx context.Context, userID string) (*domain.WhatsAppIntegration, error) {
	integration, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	state, err := s.client.GetConnectionState(ctx, integration.InstanceName)
	if err == nil && state != "" {
		if strings.EqualFold(state, "open") && integration.Status != domain.WhatsAppStatusConnected {
			now := time.Now().UTC()
			integration.Status = domain.WhatsAppStatusConnected
			integration.LastConnectedAt = &now
			_ = s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusConnected, &now)
		} else if (strings.EqualFold(state, "close") || strings.EqualFold(state, "refused")) && integration.Status == domain.WhatsAppStatusConnected {
			integration.Status = domain.WhatsAppStatusDisconnected
			_ = s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusDisconnected, nil)
		}
	}

	return integration, nil
}

// Disconnect desvincula a conta do WhatsApp deslogando da Evolution API.
func (s *WhatsAppService) Disconnect(ctx context.Context, userID string) error {
	integration, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return err
	}

	_ = s.client.Logout(ctx, integration.InstanceName)
	return s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusDisconnected, nil)
}

// MatchWhatsAppContacts consulta os contatos da Evolution API e cruza com a base de usuários do Vito.
func (s *WhatsAppService) MatchWhatsAppContacts(ctx context.Context, userID string) ([]domain.ContactMatchResult, error) {
	integration, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if err == domain.ErrWhatsAppIntegrationNotFound {
			return []domain.ContactMatchResult{}, nil
		}
		return nil, err
	}
	if integration == nil || integration.Status != domain.WhatsAppStatusConnected {
		return []domain.ContactMatchResult{}, nil
	}

	contacts, err := s.client.FindContacts(ctx, integration.InstanceName)
	if err != nil {
		return nil, err
	}

	var results []domain.ContactMatchResult
	seenUserIDs := make(map[string]bool)

	for _, contact := range contacts {
		cleanPhone, err := SanitizePhoneNumber(contact.Number)
		if err != nil {
			cleanPhone, err = SanitizePhoneNumber(contact.ID)
		}
		if err != nil || cleanPhone == "" {
			continue
		}

		if s.userRepo != nil {
			user, err := s.userRepo.GetByPhone(cleanPhone)
			if err == nil && user != nil && user.ID != userID && !seenUserIDs[user.ID] {
				seenUserIDs[user.ID] = true
				contactName := contact.Name
				if contactName == "" {
					contactName = contact.PushName
				}
				if contactName == "" {
					contactName = user.Name
				}
				results = append(results, domain.ContactMatchResult{
					UserID: user.ID,
					Name:   contactName,
					Phone:  cleanPhone,
					Email:  user.Email,
				})
			}
		}
	}

	if results == nil {
		results = []domain.ContactMatchResult{}
	}
	return results, nil
}

// HandleWebhook processa eventos de atualização de conexão e mensagens recebidas.
func (s *WhatsAppService) HandleWebhook(ctx context.Context, eventType string, payload []byte) error {
	var base struct {
		Event    string          `json:"event"`
		Instance string          `json:"instance"`
		Data     json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(payload, &base); err != nil {
		return err
	}

	event := strings.ToLower(base.Event)
	if event == "" {
		event = strings.ToLower(eventType)
	}

	if strings.Contains(event, "connection") {
		var connData struct {
			State string `json:"state"`
		}
		_ = json.Unmarshal(base.Data, &connData)

		integration, err := s.repo.GetByInstanceName(ctx, base.Instance)
		if err == nil && integration != nil {
			if strings.EqualFold(connData.State, "open") {
				now := time.Now().UTC()
				_ = s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusConnected, &now)
				if s.userRepo != nil && integration.Phone != "" {
					if existingUser, err := s.userRepo.GetByPhone(integration.Phone); err == nil && existingUser != nil {
						if existingUser.ID != integration.UserID && strings.HasSuffix(strings.ToLower(existingUser.Email), "@vito.local") {
							_ = s.userRepo.UpdatePhone(existingUser.ID, "")
						}
					}
					_ = s.userRepo.UpdatePhone(integration.UserID, integration.Phone)
				}
			} else if strings.EqualFold(connData.State, "close") || strings.EqualFold(connData.State, "refused") {
				_ = s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusDisconnected, nil)
			}
		}
		return nil
	}

	if strings.Contains(event, "messages") {
		return s.handleMessagesEvent(ctx, base.Instance, base.Data)
	}

	return nil
}
