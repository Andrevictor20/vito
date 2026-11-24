package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// NotificationActionResult descreve o desfecho de uma ação executada na central de notificações.
type NotificationActionResult struct {
	Status           string `json:"status"`
	NotificationID   string `json:"notification_id"`
	SourceDomain     string `json:"source_domain"`
	SourceID         string `json:"source_id,omitempty"`
	Decision         string `json:"decision,omitempty"`
	ActionKey        string `json:"action_key,omitempty"`
	NavigateTo       string `json:"navigate_to,omitempty"`
	RescheduledCount int64  `json:"rescheduled_count,omitempty"`
}

// BotActionPolicyUpdater permite gravar políticas always_allow em bots ao aprovar na central.
type BotActionPolicyUpdater interface {
	GetByID(ctx context.Context, botID, userID string) (*domain.Bot, error)
	UpsertAction(ctx context.Context, action *domain.BotAction) error
}

// NotificationsInboxService orquestra a caixa de notificações (#s-notifs) com AttentionBudgetService e ações cross-domain.
type NotificationsInboxService struct {
	repo            *repository.NotificationsInboxRepositorySQLite
	attentionBudget *AttentionBudgetService
	confGate        *ConfirmationGateService
	botRepo         BotActionPolicyUpdater
	todoRepo        domain.TodoRepository
}

// NewNotificationsInboxService instancia o serviço da central de notificações.
func NewNotificationsInboxService(repo *repository.NotificationsInboxRepositorySQLite) *NotificationsInboxService {
	return &NotificationsInboxService{repo: repo}
}

func (s *NotificationsInboxService) SetAttentionBudget(ab *AttentionBudgetService) {
	s.attentionBudget = ab
	if ab != nil {
		ab.SetInboxRecorder(s)
	}
}

func (s *NotificationsInboxService) SetConfirmationGate(cg *ConfirmationGateService) {
	s.confGate = cg
}

func (s *NotificationsInboxService) SetBotRepository(br BotActionPolicyUpdater) {
	s.botRepo = br
}

func (s *NotificationsInboxService) SetTodoRepository(tr domain.TodoRepository) {
	s.todoRepo = tr
}

// RecordDeliveredCandidate implementa InboxNotificationRecorder para persistir alertas entregues pelo AttentionBudgetService.
func (s *NotificationsInboxService) RecordDeliveredCandidate(ctx context.Context, cand AttentionCandidate) error {
	if s.repo == nil || strings.TrimSpace(cand.UserID) == "" {
		return nil
	}
	now := cand.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}
	cat := strings.ToLower(strings.TrimSpace(cand.Category))
	if cat == "" {
		cat = "sistema"
	}
	nType := domain.NotificationTypeAlert
	if cat == "resumo" || cat == "promo" {
		nType = domain.NotificationTypeInfo
	}
	sourceID := strings.TrimSpace(cand.DedupKey)
	if sourceID == "" {
		sourceID = uuid.NewString()
	}
	var actions []domain.NotificationAction
	switch cat {
	case "tarefas":
		actions = []domain.NotificationAction{
			{ID: "view_tasks", Label: "Ver tarefas", Style: "secondary"},
		}
	case "financas":
		actions = []domain.NotificationAction{
			{ID: "view_cards", Label: "Ver finanças", Style: "primary"},
		}
	case "agenda":
		actions = []domain.NotificationAction{
			{ID: "open", Label: "Ver agenda", Style: "secondary"},
		}
	}

	return s.repo.UpsertBySource(ctx, &domain.UserNotification{
		UserID:       cand.UserID,
		GroupKey:     "Agora",
		Type:         nType,
		SourceDomain: cat,
		SourceID:     sourceID,
		Title:        strings.TrimSpace(cand.Title),
		Body:         strings.TrimSpace(cand.Body),
		Actions:      actions,
		IsUnread:     true,
		CreatedAt:    now.UTC(),
	})
}

// ListNotifications sincroniza pendências ativas de bots/tarefas e retorna os itens filtrados do usuário.
func (s *NotificationsInboxService) ListNotifications(
	ctx context.Context,
	userID string,
	filter domain.NotificationInboxFilter,
) ([]domain.UserNotification, domain.NotificationInboxCounts, error) {
	if s.repo == nil {
		return []domain.UserNotification{}, domain.NotificationInboxCounts{}, nil
	}
	now := time.Now().UTC()
	_ = s.repo.SyncBotPendingNotifications(ctx, userID)
	_ = s.repo.SyncOverdueTodoNotifications(ctx, userID, now)
	items, counts, err := s.repo.ListByUser(ctx, userID, filter)
	if err != nil {
		return items, counts, err
	}
	for i := range items {
		items[i].GroupKey = repository.ComputeGroupKey(items[i].CreatedAt, now, nil)
	}
	return items, counts, nil
}

// MarkAllRead marca todas as notificações ativas do usuário como lidas.
func (s *NotificationsInboxService) MarkAllRead(ctx context.Context, userID string) (int64, error) {
	return s.repo.MarkAllRead(ctx, userID)
}

// GetPreferences retorna as preferências de notificação do usuário.
func (s *NotificationsInboxService) GetPreferences(ctx context.Context, userID string) (*domain.NotificationPreferences, error) {
	return s.repo.GetPreferences(ctx, userID)
}

// UpdatePreferences atualiza as preferências de notificação e sincroniza com o AttentionBudgetService.
func (s *NotificationsInboxService) UpdatePreferences(
	ctx context.Context,
	userID string,
	upd domain.NotificationPreferencesUpdate,
) (*domain.NotificationPreferences, error) {
	cur, err := s.repo.GetPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}
	if upd.Agenda != nil {
		cur.Agenda = *upd.Agenda
	}
	if upd.Tarefas != nil {
		cur.Tarefas = *upd.Tarefas
	}
	if upd.Financas != nil {
		cur.Financas = *upd.Financas
	}
	if upd.Bots != nil {
		cur.Bots = *upd.Bots
	}
	if upd.Resumo != nil {
		cur.Resumo = *upd.Resumo
	}
	if upd.Promo != nil {
		cur.Promo = *upd.Promo
	}
	if err := s.repo.UpsertPreferences(ctx, cur); err != nil {
		return nil, err
	}
	s.syncBudgetPreferences(cur)
	return cur, nil
}

func (s *NotificationsInboxService) syncBudgetPreferences(p *domain.NotificationPreferences) {
	if s.attentionBudget == nil || p == nil {
		return
	}
	s.attentionBudget.SetCategoryPreference(p.UserID, "agenda", p.Agenda)
	s.attentionBudget.SetCategoryPreference(p.UserID, "tarefas", p.Tarefas)
	s.attentionBudget.SetCategoryPreference(p.UserID, "financas", p.Financas)
	s.attentionBudget.SetCategoryPreference(p.UserID, "bots", p.Bots)
	s.attentionBudget.SetCategoryPreference(p.UserID, "resumo", p.Resumo)
	s.attentionBudget.SetCategoryPreference(p.UserID, "promo", p.Promo)
}

// ResolveAction executa a ação inline de uma notificação garantindo isolamento por user_id.
func (s *NotificationsInboxService) ResolveAction(
	ctx context.Context,
	userID, notifID, action, decision string,
) (*NotificationActionResult, error) {
	n, err := s.repo.GetByID(ctx, notifID, userID)
	if err != nil {
		return nil, err
	}

	act := strings.ToLower(strings.TrimSpace(action))
	if act == "" {
		act = strings.ToLower(strings.TrimSpace(decision))
	}
	if act == "" {
		return nil, domain.ErrInvalidNotificationAction
	}

	switch act {
	case "read", "mark_read":
		if err := s.repo.MarkRead(ctx, notifID, userID); err != nil {
			return nil, err
		}
		return &NotificationActionResult{
			Status:         "read",
			NotificationID: notifID,
			SourceDomain:   n.SourceDomain,
			SourceID:       n.SourceID,
		}, nil
	case "dismiss":
		if err := s.repo.Dismiss(ctx, notifID, userID); err != nil {
			return nil, err
		}
		return &NotificationActionResult{
			Status:         "dismissed",
			NotificationID: notifID,
			SourceDomain:   n.SourceDomain,
			SourceID:       n.SourceID,
		}, nil
	}

	switch strings.ToLower(strings.TrimSpace(n.SourceDomain)) {
	case "bots":
		return s.resolveBotNotificationAction(ctx, userID, n, act)
	case "tarefas", "todos":
		return s.resolveTodoNotificationAction(ctx, userID, n, act)
	case "booking", "meetings":
		_ = s.repo.MarkRead(ctx, notifID, userID)
		return &NotificationActionResult{
			Status:         "opened",
			NotificationID: notifID,
			SourceDomain:   n.SourceDomain,
			SourceID:       n.SourceID,
			NavigateTo:     "booking",
		}, nil
	case "financas", "finance":
		_ = s.repo.MarkRead(ctx, notifID, userID)
		return &NotificationActionResult{
			Status:         "opened",
			NotificationID: notifID,
			SourceDomain:   n.SourceDomain,
			SourceID:       n.SourceID,
			NavigateTo:     "finance",
		}, nil
	default:
		if err := s.repo.MarkRead(ctx, notifID, userID); err != nil {
			return nil, err
		}
		return &NotificationActionResult{
			Status:         "opened",
			NotificationID: notifID,
			SourceDomain:   n.SourceDomain,
			SourceID:       n.SourceID,
		}, nil
	}
}

func (s *NotificationsInboxService) resolveBotNotificationAction(
	ctx context.Context,
	userID string,
	n *domain.UserNotification,
	act string,
) (*NotificationActionResult, error) {
	mapped := act
	switch act {
	case "approve", "ok":
		mapped = "allow_once"
	case "reject", "no":
		mapped = "deny"
	}
	if mapped != "allow_once" && mapped != "always_allow" && mapped != "deny" {
		return nil, domain.ErrInvalidNotificationAction
	}

	if s.confGate != nil && strings.TrimSpace(n.SourceID) != "" {
		pending, err := s.confGate.GetByID(ctx, n.SourceID, userID)
		if err != nil {
			return nil, err
		}
		if mapped == "deny" {
			if err := s.confGate.CancelWithReason(ctx, n.SourceID, userID, "negado via central de notificações"); err != nil {
				return nil, err
			}
			_ = s.repo.Dismiss(ctx, n.ID, userID)
			return &NotificationActionResult{
				Status:         "denied",
				NotificationID: n.ID,
				SourceDomain:   "bots",
				SourceID:       n.SourceID,
				Decision:       "deny",
			}, nil
		}

		actionKey := resolveNotificationBotActionKey(pending.ToolsetName, pending.Operation)
		if mapped == "always_allow" {
			if spec, exists := domain.ActionCatalog[actionKey]; (exists && spec.AlwaysAsk) || domain.IsAlwaysAskAction(actionKey) {
				return nil, domain.ErrAlwaysAskPolicyViolation
			}
			if s.botRepo != nil && n.BotID != "" && actionKey != "" {
				if err := s.botRepo.UpsertAction(ctx, &domain.BotAction{
					BotID:     n.BotID,
					UserID:    userID,
					ActionKey: actionKey,
					Policy:    domain.ActionPolicyAuto,
				}); err != nil {
					return nil, err
				}
			}
		}

		if _, err := s.confGate.Resume(ctx, n.SourceID, userID); err != nil {
			if errors.Is(err, ErrConfirmationAlreadyResolved) {
				_ = s.repo.Dismiss(ctx, n.ID, userID)
			}
			return nil, err
		}
		_ = s.repo.Dismiss(ctx, n.ID, userID)
		return &NotificationActionResult{
			Status:         "approved",
			NotificationID: n.ID,
			SourceDomain:   "bots",
			SourceID:       n.SourceID,
			Decision:       mapped,
			ActionKey:      actionKey,
		}, nil
	}

	_ = s.repo.Dismiss(ctx, n.ID, userID)
	status := "approved"
	if mapped == "deny" {
		status = "denied"
	}
	return &NotificationActionResult{
		Status:         status,
		NotificationID: n.ID,
		SourceDomain:   "bots",
		SourceID:       n.SourceID,
		Decision:       mapped,
	}, nil
}

func (s *NotificationsInboxService) resolveTodoNotificationAction(
	ctx context.Context,
	userID string,
	n *domain.UserNotification,
	act string,
) (*NotificationActionResult, error) {
	switch act {
	case "reschedule_today", "resched":
		count, err := s.repo.RescheduleOverdueTodosToday(ctx, userID, time.Now().UTC())
		if err != nil {
			return nil, err
		}
		_ = s.repo.Dismiss(ctx, n.ID, userID)
		return &NotificationActionResult{
			Status:           "rescheduled",
			NotificationID:   n.ID,
			SourceDomain:     n.SourceDomain,
			SourceID:         n.SourceID,
			RescheduledCount: count,
		}, nil
	case "complete":
		if s.todoRepo != nil && strings.TrimSpace(n.SourceID) != "" && n.SourceID != "overdue_summary" {
			if err := s.todoRepo.UpdateStatus(n.SourceID, userID, domain.TodoStatusCompleted); err != nil {
				return nil, err
			}
		}
		_ = s.repo.Dismiss(ctx, n.ID, userID)
		return &NotificationActionResult{
			Status:         "completed",
			NotificationID: n.ID,
			SourceDomain:   n.SourceDomain,
			SourceID:       n.SourceID,
		}, nil
	case "view_tasks", "open":
		_ = s.repo.MarkRead(ctx, n.ID, userID)
		return &NotificationActionResult{
			Status:         "opened",
			NotificationID: n.ID,
			SourceDomain:   n.SourceDomain,
			SourceID:       n.SourceID,
			NavigateTo:     "tasks",
		}, nil
	default:
		return nil, domain.ErrInvalidNotificationAction
	}
}

func resolveNotificationBotActionKey(toolset, operation string) string {
	for k, spec := range domain.ActionCatalog {
		if spec.Toolset != toolset {
			continue
		}
		for _, op := range spec.Operations {
			if op == operation {
				return k
			}
		}
	}
	return ""
}
