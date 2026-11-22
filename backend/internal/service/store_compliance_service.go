package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// StoreComplianceService gerencia assinaturas (#s-store), privacidade, LGPD e suporte.
type StoreComplianceService struct {
	repo domain.StoreComplianceRepository
}

// NewStoreComplianceService instancia o serviço de loja e conformidade LGPD.
func NewStoreComplianceService(repo domain.StoreComplianceRepository) *StoreComplianceService {
	return &StoreComplianceService{repo: repo}
}

// GetSubscription retorna a assinatura atual do usuário.
func (s *StoreComplianceService) GetSubscription(ctx context.Context, userID string) (*domain.UserSubscription, error) {
	return s.repo.GetSubscription(ctx, userID)
}

// SubscriptionUpdateInput encapsula a atualização ou início de trial de assinatura.
type SubscriptionUpdateInput struct {
	Plan         string `json:"plan"`
	BillingCycle string `json:"billing_cycle"`
	StoreToken   string `json:"store_token"`
	StartTrial   *bool  `json:"start_trial"`
}

// UpsertSubscription ativa trial de 7 dias ou registra assinatura paga com hash do token da loja.
func (s *StoreComplianceService) UpsertSubscription(
	ctx context.Context,
	userID string,
	in SubscriptionUpdateInput,
) (*domain.UserSubscription, error) {
	plan, ok := normalizeSubscriptionPlan(in.Plan)
	if !ok {
		return nil, domain.ErrInvalidPlan
	}
	cycle, ok := normalizeBillingCycle(in.BillingCycle)
	if !ok {
		return nil, domain.ErrInvalidBillingCycle
	}

	now := time.Now().UTC()
	sub := &domain.UserSubscription{
		UserID:       userID,
		Plan:         plan,
		BillingCycle: cycle,
		UpdatedAt:    now,
	}

	if plan == domain.PlanFree {
		sub.Status = "inactive"
		if err := s.repo.UpsertSubscription(ctx, sub); err != nil {
			return nil, err
		}
		return s.repo.GetSubscription(ctx, userID)
	}

	token := strings.TrimSpace(in.StoreToken)
	if token != "" {
		sub.StoreTokenHash = hashStoreToken(token)
		sub.HasStoreToken = true
	}

	startTrial := token == ""
	if in.StartTrial != nil {
		startTrial = *in.StartTrial
	}

	if startTrial {
		trialEnd := now.Add(7 * 24 * time.Hour)
		sub.Status = "trialing"
		sub.TrialEndsAt = &trialEnd
		sub.RenewsAt = &trialEnd
	} else {
		renews := now.Add(30 * 24 * time.Hour)
		if cycle == domain.BillingCycleYear {
			renews = now.Add(365 * 24 * time.Hour)
		}
		sub.Status = "active"
		sub.RenewsAt = &renews
	}

	if err := s.repo.UpsertSubscription(ctx, sub); err != nil {
		return nil, err
	}
	return s.repo.GetSubscription(ctx, userID)
}

// RestoreSubscription verifica compras restauráveis do usuário autenticado.
func (s *StoreComplianceService) RestoreSubscription(
	ctx context.Context,
	userID, storeToken string,
) (bool, *domain.UserSubscription, error) {
	sub, err := s.repo.GetSubscription(ctx, userID)
	if err != nil {
		return false, nil, err
	}
	if sub.Plan == domain.PlanFree || sub.Status == "inactive" {
		return false, sub, nil
	}
	trimmed := strings.TrimSpace(storeToken)
	if trimmed != "" && sub.StoreTokenHash != "" && hashStoreToken(trimmed) != sub.StoreTokenHash {
		return false, sub, nil
	}
	return true, sub, nil
}

// GetPrivacySettings retorna as preferências de privacidade do usuário.
func (s *StoreComplianceService) GetPrivacySettings(ctx context.Context, userID string) (*domain.PrivacySettings, error) {
	return s.repo.GetPrivacySettings(ctx, userID)
}

// UpdatePrivacySettings atualiza compartilhamento de IA, diagnósticos e permissões do dispositivo.
func (s *StoreComplianceService) UpdatePrivacySettings(
	ctx context.Context,
	userID string,
	upd domain.PrivacySettingsUpdate,
) (*domain.PrivacySettings, error) {
	cur, err := s.repo.GetPrivacySettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	if upd.AIProcessingEnabled != nil {
		cur.AIProcessingEnabled = *upd.AIProcessingEnabled
	}
	if upd.AnalyticsEnabled != nil {
		cur.AnalyticsEnabled = *upd.AnalyticsEnabled
	}
	if upd.Permissions != nil {
		cur.Permissions = *upd.Permissions
	}
	if err := s.repo.UpsertPrivacySettings(ctx, cur); err != nil {
		return nil, err
	}
	return cur, nil
}

// ExportAccountJSON gera o pacote LGPD completo do usuário autenticado e registra a solicitação.
func (s *StoreComplianceService) ExportAccountJSON(ctx context.Context, userID string) (*domain.LGPDExportBundle, error) {
	now := time.Now().UTC()
	req := &domain.AccountComplianceRequest{
		ID:          uuid.NewString(),
		UserID:      userID,
		Kind:        domain.ComplianceKindExportJSON,
		Status:      "completed",
		RequestedAt: now,
	}
	if err := s.repo.CreateComplianceRequest(ctx, req); err != nil {
		return nil, err
	}
	data, err := s.repo.CollectLGPDExportData(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &domain.LGPDExportBundle{
		RequestID:  req.ID,
		Kind:       req.Kind,
		Status:     req.Status,
		ExportedAt: now,
		Data:       *data,
	}, nil
}

// ScheduleAccountDeletion exige confirmação explícita "EXCLUIR" e agenda remoção definitiva em 30 dias.
func (s *StoreComplianceService) ScheduleAccountDeletion(
	ctx context.Context,
	userID, confirmation string,
) (*domain.AccountComplianceRequest, error) {
	if strings.ToUpper(strings.TrimSpace(confirmation)) != "EXCLUIR" {
		return nil, domain.ErrInvalidDeleteConfirm
	}
	now := time.Now().UTC()
	scheduledFor := now.Add(30 * 24 * time.Hour)
	req := &domain.AccountComplianceRequest{
		ID:           uuid.NewString(),
		UserID:       userID,
		Kind:         domain.ComplianceKindDeleteAccount,
		Status:       "scheduled",
		RequestedAt:  now,
		ScheduledFor: &scheduledFor,
	}
	if err := s.repo.CreateComplianceRequest(ctx, req); err != nil {
		return nil, err
	}
	return req, nil
}

// SubmitSupportContact registra uma solicitação de suporte do usuário.
func (s *StoreComplianceService) SubmitSupportContact(
	ctx context.Context,
	userID, subject, message string,
) (*domain.SupportRequest, error) {
	msg := strings.TrimSpace(message)
	if msg == "" {
		return nil, domain.ErrInvalidSupportMsg
	}
	subj := strings.TrimSpace(subject)
	if subj == "" {
		subj = "Suporte Vito"
	}
	req := &domain.SupportRequest{
		ID:        uuid.NewString(),
		UserID:    userID,
		Subject:   subj,
		Message:   msg,
		Status:    "received",
		CreatedAt: time.Now().UTC(),
	}
	if err := s.repo.CreateSupportRequest(ctx, req); err != nil {
		return nil, err
	}
	return req, nil
}

// ReportAIContent registra uma denúncia de resposta da IA.
func (s *StoreComplianceService) ReportAIContent(
	ctx context.Context,
	userID, threadID, reason string,
) (*domain.AIContentReport, error) {
	r := strings.TrimSpace(reason)
	if r == "" {
		return nil, domain.ErrInvalidReportReason
	}
	rep := &domain.AIContentReport{
		ID:        uuid.NewString(),
		UserID:    userID,
		ThreadID:  strings.TrimSpace(threadID),
		Reason:    r,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.repo.CreateAIReport(ctx, rep); err != nil {
		return nil, err
	}
	return rep, nil
}

func normalizeSubscriptionPlan(raw string) (domain.SubscriptionPlan, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "free":
		return domain.PlanFree, true
	case "pro":
		return domain.PlanPro, true
	case "ultra":
		return domain.PlanUltra, true
	default:
		return "", false
	}
}

func normalizeBillingCycle(raw string) (domain.BillingCycle, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "month", "monthly", "mensal":
		return domain.BillingCycleMonth, true
	case "year", "yearly", "annual", "anual":
		return domain.BillingCycleYear, true
	default:
		return "", false
	}
}

func hashStoreToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
