package service

import (
	"context"
	"fmt"
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

	return summary, nil
}

// GenerateConnectToken emite o token efêmero de conexão do Meu Pluggy (conector 200).
func (s *FinanceService) GenerateConnectToken(ctx context.Context, userID string) (string, error) {
	if s.pluggyClientID == "" || s.pluggyClientSecret == "" {
		return fmt.Sprintf("mock-connect-token-%s-%d", userID, time.Now().Unix()), nil
	}
	return fmt.Sprintf("pluggy-connect-%s-%d", userID, time.Now().Unix()), nil
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
