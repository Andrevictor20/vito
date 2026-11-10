package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/google/uuid"
)

var (
	rePromptInjectionPatterns = regexp.MustCompile(`(?i)(ignore\s+(all\s+)?previous\s+instructions|system\s*:|assistant\s*:|developer\s*:|<script>|\[INST\]|\[\/INST\])`)
	reSanitizeControls        = regexp.MustCompile(`[\r\n\t]+`)
)

// FinanceService gerencia regras de negócio, ingestão edge-sync, segurança e emissão de tokens.
type FinanceService struct {
	repo               repository.FinanceRepository
	pluggyClientID     string
	pluggyClientSecret string
}

// NewFinanceService instancia o serviço financeiro.
func NewFinanceService(repo repository.FinanceRepository, pluggyClientID, pluggyClientSecret string) *FinanceService {
	return &FinanceService{
		repo:               repo,
		pluggyClientID:     pluggyClientID,
		pluggyClientSecret: pluggyClientSecret,
	}
}

// IngestSyncPayload processa o lote de contas e transações enviado pelo Edge-Sync mobile.
func (s *FinanceService) IngestSyncPayload(ctx context.Context, userID string, payload *domain.FinanceSyncPayload) error {
	if payload == nil {
		return domain.ErrFinanceInvalidPayload
	}

	// 1. Atualizar ou registrar conexão se houver itemId
	connID := payload.ConnectionID
	if payload.PluggyItemID != "" {
		if connID == "" {
			existing, err := s.repo.GetConnectionByPluggyItemID(ctx, userID, payload.PluggyItemID)
			if err == nil && existing != nil {
				connID = existing.ID
			} else {
				connID = uuid.NewString()
			}
			payload.ConnectionID = connID
		}
		now := time.Now().UTC()
		_ = s.repo.UpsertConnection(ctx, &domain.FinanceConnection{
			ID:           connID,
			UserID:       userID,
			PluggyItemID: payload.PluggyItemID,
			LastSyncAt:   &now,
			Status:       domain.ConnectionStatusUpdated,
		})
	}

	// 2. Persistir contas em lote
	if len(payload.Accounts) > 0 {
		for i := range payload.Accounts {
			payload.Accounts[i].UserID = userID
			if payload.Accounts[i].ID == "" {
				payload.Accounts[i].ID = uuid.NewString()
			}
			if payload.Accounts[i].ConnectionID == "" && connID != "" {
				payload.Accounts[i].ConnectionID = connID
			}
		}
		if err := s.repo.UpsertAccountsBatch(ctx, userID, payload.Accounts); err != nil {
			return fmt.Errorf("falha ao persistir contas: %w", err)
		}
	}

	// 3. Sanitizar descrições de transações contra Prompt Injection e persistir
	if len(payload.Transactions) > 0 {
		for i := range payload.Transactions {
			payload.Transactions[i].UserID = userID
			if payload.Transactions[i].ID == "" {
				payload.Transactions[i].ID = uuid.NewString()
			}
			payload.Transactions[i].Description = SanitizeFinancialDescription(payload.Transactions[i].Description)
			payload.Transactions[i].CleanMerchantName = SanitizeFinancialDescription(payload.Transactions[i].CleanMerchantName)
		}
		if err := s.repo.UpsertTransactionsBatch(ctx, userID, payload.Transactions); err != nil {
			return fmt.Errorf("falha ao persistir transações: %w", err)
		}
	}

	return nil
}

// GetFinancialSummary obtém o raio-x financeiro enriquecido com alertas proativos.
func (s *FinanceService) GetFinancialSummary(ctx context.Context, userID string) (*domain.FinancialSummary, error) {
	summary, err := s.repo.GetFinancialSummary(ctx, userID, time.Now().UTC())
	if err != nil {
		return nil, err
	}

	// Geração de Alertas Proativos
	if summary.OpenInvoicesTotal > 0 && summary.ConsolidatedBalance < summary.OpenInvoicesTotal {
		deficit := summary.OpenInvoicesTotal - summary.ConsolidatedBalance
		summary.Alerts = append(summary.Alerts, domain.FinanceAlert{
			ID:           "alert-invoice-deficit",
			Kind:         "INVOICE_EXCEEDS_BALANCE",
			Title:        "Atenção com Faturas de Cartão",
			Message:      fmt.Sprintf("Suas faturas abertas superam o saldo em conta em R$ %.2f.", deficit),
			Severity:     "critical",
			ActionLabel:  "Ver Contas",
			ActionPrompt: "Quanto falta para cobrir a fatura do cartão?",
		})
	}

	if summary.SafeToSpendDaily > 0 && summary.SafeToSpendDaily < 30.0 {
		summary.Alerts = append(summary.Alerts, domain.FinanceAlert{
			ID:           "alert-safe-to-spend-low",
			Kind:         "SAFE_TO_SPEND_LOW",
			Title:        "Ritmo de Gastos Apertado",
			Message:      fmt.Sprintf("Seu Safe-to-Spend diário é de apenas R$ %.2f até o fim do mês.", summary.SafeToSpendDaily),
			Severity:     "warning",
			ActionLabel:  "Ajustar Gastos",
			ActionPrompt: "Como posso economizar até o fim do mês?",
		})
	}

	summary.AttentionAlerts = summary.Alerts
	return summary, nil
}

// GenerateConnectToken emite o token efêmero oficial da Pluggy para o widget de conexão.
func (s *FinanceService) GenerateConnectToken(ctx context.Context, userID string) (string, error) {
	if s.pluggyClientID == "" || s.pluggyClientSecret == "" {
		return "", domain.ErrPluggyCredentialsMissing
	}

	apiKey, err := s.fetchPluggyAPIKey(ctx)
	if err != nil {
		return "", err
	}

	return s.fetchPluggyConnectToken(ctx, apiKey, userID)
}

// GetSessionToken emite uma apiKey efêmera da Pluggy para o cliente móvel realizar o Edge-Sync.
func (s *FinanceService) GetSessionToken(ctx context.Context) (string, error) {
	if s.pluggyClientID == "" || s.pluggyClientSecret == "" {
		return "", domain.ErrPluggyCredentialsMissing
	}
	return s.fetchPluggyAPIKey(ctx)
}

func (s *FinanceService) fetchPluggyAPIKey(ctx context.Context) (string, error) {
	authBody, _ := json.Marshal(map[string]string{
		"clientId":     s.pluggyClientID,
		"clientSecret": s.pluggyClientSecret,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.pluggy.ai/auth", bytes.NewReader(authBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("falha ao conectar na API da Pluggy: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("autenticação na Pluggy rejeitada (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var authRes struct {
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(bodyBytes, &authRes); err != nil || authRes.APIKey == "" {
		return "", fmt.Errorf("resposta inválida de autenticação da Pluggy: %s", string(bodyBytes))
	}

	return authRes.APIKey, nil
}

func (s *FinanceService) fetchPluggyConnectToken(ctx context.Context, apiKey, userID string) (string, error) {
	tokenReqBody, _ := json.Marshal(map[string]any{
		"options": map[string]any{
			"clientUserId": userID,
		},
	})

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.pluggy.ai/connect_token", bytes.NewReader(tokenReqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-KEY", apiKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("falha ao solicitar connect_token na Pluggy: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("emissão de connect_token na Pluggy rejeitada (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var tokenRes struct {
		AccessToken  string `json:"accessToken"`
		ConnectToken string `json:"connectToken"`
	}
	if err := json.Unmarshal(bodyBytes, &tokenRes); err != nil {
		return "", fmt.Errorf("resposta inválida de connect_token da Pluggy: %s", string(bodyBytes))
	}

	token := tokenRes.AccessToken
	if token == "" {
		token = tokenRes.ConnectToken
	}
	if token == "" {
		return "", fmt.Errorf("connect_token vazio retornado pela Pluggy: %s", string(bodyBytes))
	}

	return token, nil
}

// CreateConnection cadastra uma nova conexão manualmente.
func (s *FinanceService) CreateConnection(ctx context.Context, conn *domain.FinanceConnection) error {
	return s.repo.UpsertConnection(ctx, conn)
}

// ListConnections retorna todas as instituições conectadas do usuário.
func (s *FinanceService) ListConnections(ctx context.Context, userID string) ([]domain.FinanceConnection, error) {
	return s.repo.ListConnections(ctx, userID)
}

// DeleteConnection desconecta e expurga os dados de uma instituição.
func (s *FinanceService) DeleteConnection(ctx context.Context, userID, connectionID string) error {
	return s.repo.DeleteConnection(ctx, userID, connectionID)
}

// ListAccounts lista todas as contas bancárias do usuário.
func (s *FinanceService) ListAccounts(ctx context.Context, userID string) ([]domain.FinanceAccount, error) {
	return s.repo.ListAccounts(ctx, userID)
}

// ListTransactions lista transações com paginação.
func (s *FinanceService) ListTransactions(ctx context.Context, userID string, limit, offset int) ([]domain.FinanceTransaction, error) {
	return s.repo.ListTransactions(ctx, userID, limit, offset)
}

// SanitizeFinancialDescription neutraliza tentativas de prompt injection em extratos bancários.
func SanitizeFinancialDescription(raw string) string {
	if raw == "" {
		return ""
	}
	clean := reSanitizeControls.ReplaceAllString(raw, " ")
	clean = rePromptInjectionPatterns.ReplaceAllLiteralString(clean, "[REDACTED]")
	return strings.TrimSpace(clean)
}
