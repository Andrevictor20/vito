package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

var (
	ErrTokenEmpty = errors.New("token não pode ser vazio")
)

// PushMessage define o payload enviado para o serviço Expo Push API.
type PushMessage struct {
	To        string                 `json:"to"`
	Title     string                 `json:"title"`
	Body      string                 `json:"body"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Sound     string                 `json:"sound,omitempty"`
	ChannelID string                 `json:"channelId,omitempty"`
	Priority  string                 `json:"priority,omitempty"` // "default" | "normal" | "high"
}

// NotificationService gerencia registro de tokens e despacho de notificações.
type NotificationService struct {
	tokenRepo  domain.DeviceTokenRepository
	httpClient *http.Client
	expoAPIURL string
}

// NewNotificationService inicializa o serviço de notificações.
func NewNotificationService(tokenRepo domain.DeviceTokenRepository, httpClient ...*http.Client) *NotificationService {
	client := &http.Client{Timeout: 10 * time.Second}
	if len(httpClient) > 0 && httpClient[0] != nil {
		client = httpClient[0]
	}
	return &NotificationService{
		tokenRepo:  tokenRepo,
		httpClient: client,
		expoAPIURL: "https://exp.host/--/api/v2/push/send",
	}
}

// SetExpoAPIURL permite configurar a URL da API (útil para testes unitários com httptest).
func (s *NotificationService) SetExpoAPIURL(url string) {
	s.expoAPIURL = url
}

// RegisterDeviceToken salva ou atualiza o token de push do usuário.
func (s *NotificationService) RegisterDeviceToken(userID, token, platform string) (*domain.DeviceToken, error) {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" {
		return nil, ErrTokenEmpty
	}

	if platform == "" {
		platform = "expo"
	}

	dt := &domain.DeviceToken{
		ID:        uuid.New().String(),
		UserID:    userID,
		Token:     trimmedToken,
		Platform:  platform,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	if err := s.tokenRepo.Save(dt); err != nil {
		return nil, fmt.Errorf("falha ao persistir token de dispositivo: %w", err)
	}

	return dt, nil
}

// GetUserTokens retorna os tokens associados ao usuário.
func (s *NotificationService) GetUserTokens(userID string) ([]domain.DeviceToken, error) {
	return s.tokenRepo.FindByUserID(userID)
}

// UnregisterDeviceToken remove o token de push do usuário no logout ou desativação.
func (s *NotificationService) UnregisterDeviceToken(userID, token string) error {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" {
		return ErrTokenEmpty
	}
	return s.tokenRepo.Delete(userID, trimmedToken)
}


// SendPushToUser despacha uma notificação push para todos os dispositivos registrados do usuário.
func (s *NotificationService) SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error) {
	tokens, err := s.tokenRepo.FindByUserID(userID)
	if err != nil {
		return 0, fmt.Errorf("falha ao buscar tokens do usuário: %w", err)
	}

	if len(tokens) == 0 {
		return 0, nil
	}

	channelID := "vito_default"
	expoPriority := "high"
	sound := "default"

	switch priority {
	case "wakeup":
		channelID = "vito_wakeup"
		expoPriority = "high"
	case "urgent":
		channelID = "vito_urgent"
		expoPriority = "high"
	case "silent":
		channelID = "vito_silent"
		sound = ""
		expoPriority = "normal"
	}

	var messages []PushMessage
	for _, t := range tokens {
		messages = append(messages, PushMessage{
			To:        t.Token,
			Title:     title,
			Body:      body,
			Data:      data,
			Sound:     sound,
			ChannelID: channelID,
			Priority:  expoPriority,
		})
	}

	payloadBytes, err := json.Marshal(messages)
	if err != nil {
		return 0, fmt.Errorf("falha ao serializar mensagens push: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, s.expoAPIURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return 0, fmt.Errorf("falha ao criar requisição push: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("falha na conexão com Expo Push API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return 0, fmt.Errorf("expo push API retornou status de erro: %d", resp.StatusCode)
	}

	return len(messages), nil
}
