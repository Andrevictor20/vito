package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
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
	cfg          WhatsAppServiceConfig
	repo         domain.WhatsAppRepository
	client       EvolutionAPIClient
	assistantSvc *AssistantService
	notifSender  NotificationSender
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
	}
}

// SetNotificationSender injeta o serviço de notificações push no WhatsAppService.
func (s *WhatsAppService) SetNotificationSender(sender NotificationSender) {
	s.notifSender = sender
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
			} else if strings.EqualFold(connData.State, "close") || strings.EqualFold(connData.State, "refused") {
				_ = s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusDisconnected, nil)
			}
		}
		return nil
	}

	if strings.Contains(event, "messages") {
		var msgData struct {
			Key struct {
				RemoteJid string `json:"remoteJid"`
				FromMe    bool   `json:"fromMe"`
			} `json:"key"`
			Message struct {
				Conversation        string `json:"conversation"`
				ExtendedTextMessage struct {
					Text string `json:"text"`
				} `json:"extendedTextMessage"`
			} `json:"message"`
		}
		if err := json.Unmarshal(base.Data, &msgData); err != nil {
			return err
		}

		rawText := msgData.Message.Conversation
		if rawText == "" {
			rawText = msgData.Message.ExtendedTextMessage.Text
		}
		rawText = strings.TrimSpace(rawText)
		if rawText == "" {
			return nil
		}

		// Anti-loop: se a mensagem começou com a assinatura do Vito, é uma resposta gerada pelo próprio bot
		if strings.HasPrefix(rawText, "🎩 Vito:") || strings.HasPrefix(rawText, "Vito diz:") || strings.HasPrefix(rawText, "Vito:") {
			return nil
		}

		isGroup := strings.HasSuffix(msgData.Key.RemoteJid, "@g.us")
		if isGroup {
			lower := strings.ToLower(rawText)
			if !strings.Contains(lower, "@vito") && !strings.HasPrefix(lower, "vito:") {
				// Privacidade em grupos: ignora conversas onde o Vito não foi mencionado
				return nil
			}
			reVito := regexp.MustCompile(`(?i)@vito\s*|vito:\s*`)
			rawText = strings.TrimSpace(reVito.ReplaceAllString(rawText, ""))
			if rawText == "" {
				return nil
			}
		} else {
			// Em chats privados (1-on-1):
			// Se for o chat consigo mesmo ("Você" / seu próprio número), processa diretamente qualquer mensagem.
			// Se for chat privado com amigos/família/terceiros, só processa se contiver @vito ou vito:
			// (seja enviado pelo usuário ou pelo contato). Isso blinda totalmente as conversas privadas normais.
			integration, err := s.repo.GetByInstanceName(ctx, base.Instance)
			if err != nil || integration == nil {
				return nil
			}
			cleanJid := strings.Split(msgData.Key.RemoteJid, "@")[0]
			isSelfChat := cleanJid == integration.Phone
			hasVitoTrigger := strings.Contains(strings.ToLower(rawText), "@vito") || strings.HasPrefix(strings.ToLower(rawText), "vito:")

			if !isSelfChat && !hasVitoTrigger {
				return nil
			}
			if hasVitoTrigger {
				reVito := regexp.MustCompile(`(?i)@vito\s*|vito:\s*`)
				rawText = strings.TrimSpace(reVito.ReplaceAllString(rawText, ""))
				if rawText == "" {
					return nil
				}
			}
		}

		integration, err := s.repo.GetByInstanceName(ctx, base.Instance)
		if err != nil || integration == nil {
			return nil
		}

		if s.assistantSvc == nil {
			return nil
		}

		resp, err := s.assistantSvc.Process(ctx, integration.UserID, ai.UserInput{
			Text: rawText,
		})
		if err != nil {
			log.Printf("⚠️ [WhatsAppService] Erro ao processar mensagem do WhatsApp: %v", err)
			return nil
		}

		replyText := resp.Reply
		if replyText == "" {
			replyText = resp.Message
		}
		if replyText != "" {
			formattedReply := fmt.Sprintf("🎩 Vito:\n\n%s", replyText)
			_ = s.client.SendText(ctx, base.Instance, msgData.Key.RemoteJid, formattedReply)

			if s.notifSender != nil {
				notifBody := replyText
				if isGroup {
					notifBody = fmt.Sprintf("Respondeu no grupo: %s", replyText)
				}
				if len(notifBody) > 150 {
					notifBody = notifBody[:147] + "..."
				}
				_, _ = s.notifSender.SendPushToUser(integration.UserID, "💬 Vito (WhatsApp)", notifBody, "default", map[string]interface{}{
					"type":      "whatsapp_response",
					"remoteJid": msgData.Key.RemoteJid,
				})
			}
		}
	}

	return nil
}
