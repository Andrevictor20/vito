package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ConversationThread representa um fio persistente de diálogo no SQLite.
type ConversationThread struct {
	ID                 string     `json:"id"`
	UserID             string     `json:"user_id"`
	Channel            string     `json:"channel"`
	ExternalChatID     string     `json:"external_chat_id"`
	Title              string     `json:"title"`
	RollingSummary     string     `json:"rolling_summary"`
	SummaryUpToTurnID  string     `json:"summary_up_to_turn_id"`
	StickyModelName    string     `json:"sticky_model_name"`
	StickyModelUntil   *time.Time `json:"sticky_model_until"`
	LastActivityAt     time.Time  `json:"last_activity_at"`
	LastConsolidatedAt *time.Time `json:"last_consolidated_at"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// ConversationTurn representa um turno individual emitido por usuário, assistente ou worker.
type ConversationTurn struct {
	ID                string    `json:"id"`
	ThreadID          string    `json:"thread_id"`
	UserID            string    `json:"user_id"`
	Channel           string    `json:"channel"`
	Role              string    `json:"role"` // 'user', 'assistant', 'tool'
	Origin            string    `json:"origin"` // 'direct', 'proactive_worker', 'voice_live'
	WorkerType        string    `json:"worker_type"`
	Content           string    `json:"content"`
	ReasoningJSON     string    `json:"reasoning_json"`
	ToolCallsJSON     string    `json:"tool_calls_json"`
	ToolCallID        string    `json:"tool_call_id"`
	CardsJSON         string    `json:"cards_json"`
	ReferenceIDsJSON  string    `json:"reference_ids_json"`
	ModelUsed         string    `json:"model_used"`
	TokensIn          int       `json:"tokens_in"`
	TokensOut         int       `json:"tokens_out"`
	LatencyMs         int64     `json:"latency_ms"`
	TaintedByExternal int       `json:"tainted_by_external"`
	CreatedAt         time.Time `json:"created_at"`
}

// ConversationStoreRepository gerencia fios e turnos no SQLite.
type ConversationStoreRepository struct {
	db *sql.DB
}

// ConversationStoreRepo é um alias para compatibilidade.
type ConversationStoreRepo = ConversationStoreRepository

// NewConversationStoreRepository cria o repositório.
func NewConversationStoreRepository(db *sql.DB) *ConversationStoreRepository {
	return &ConversationStoreRepository{db: db}
}

// NewConversationStoreRepo é um construtor de compatibilidade.
func NewConversationStoreRepo(db *sql.DB) *ConversationStoreRepository {
	return NewConversationStoreRepository(db)
}

// CreateThread insere uma nova thread no SQLite.
func (r *ConversationStoreRepository) CreateThread(ctx context.Context, t *ConversationThread) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now().UTC()
	}
	if t.UpdatedAt.IsZero() {
		t.UpdatedAt = t.CreatedAt
	}
	if t.LastActivityAt.IsZero() {
		t.LastActivityAt = t.CreatedAt
	}

	query := `
		INSERT INTO conversation_threads (
			id, user_id, channel, external_chat_id, title, rolling_summary,
			summary_up_to_turn_id, sticky_model_name, sticky_model_until,
			last_activity_at, last_consolidated_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query,
		t.ID, t.UserID, t.Channel, t.ExternalChatID, t.Title, t.RollingSummary,
		t.SummaryUpToTurnID, t.StickyModelName, t.StickyModelUntil,
		t.LastActivityAt, t.LastConsolidatedAt, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

// GetThreadByID busca thread por ID.
func (r *ConversationStoreRepository) GetThreadByID(ctx context.Context, id string) (*ConversationThread, error) {
	query := `
		SELECT id, user_id, channel, external_chat_id, title, rolling_summary,
		       summary_up_to_turn_id, sticky_model_name, sticky_model_until,
		       last_activity_at, last_consolidated_at, created_at, updated_at
		FROM conversation_threads
		WHERE id = ?
	`
	row := r.db.QueryRowContext(ctx, query, id)
	return scanThread(row)
}

// GetThread é alias de compatibilidade.
func (r *ConversationStoreRepository) GetThread(ctx context.Context, id string) (*ConversationThread, error) {
	return r.GetThreadByID(ctx, id)
}

// UpdateThreadSummary atualiza o resumo rolante da conversa.
func (r *ConversationStoreRepository) UpdateThreadSummary(ctx context.Context, threadID string, summary string, upToTurnID string) error {
	query := `
		UPDATE conversation_threads
		SET rolling_summary = ?, summary_up_to_turn_id = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.db.ExecContext(ctx, query, summary, upToTurnID, time.Now().UTC(), threadID)
	return err
}

// UpdateThreadSticky atualiza o modelo e expiração fixada da thread.
func (r *ConversationStoreRepository) UpdateThreadSticky(ctx context.Context, threadID string, modelName string, until *time.Time) error {
	query := `
		UPDATE conversation_threads
		SET sticky_model_name = ?, sticky_model_until = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.db.ExecContext(ctx, query, modelName, until, time.Now().UTC(), threadID)
	return err
}

// ListThreadsByUser retorna threads do usuário filtradas por canal e ordenadas por last_activity_at DESC.
func (r *ConversationStoreRepository) ListThreadsByUser(ctx context.Context, userID, channel string, limit int) ([]*ConversationThread, error) {
	if limit <= 0 {
		limit = 20
	}
	query := `
		SELECT id, user_id, channel, external_chat_id, title, rolling_summary,
		       summary_up_to_turn_id, sticky_model_name, sticky_model_until,
		       last_activity_at, last_consolidated_at, created_at, updated_at
		FROM conversation_threads
		WHERE user_id = ? AND channel = ?
		ORDER BY last_activity_at DESC
		LIMIT ?
	`
	rows, err := r.db.QueryContext(ctx, query, userID, channel, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*ConversationThread
	for rows.Next() {
		t, err := scanThread(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

// CreateTurn insere um novo turno.
func (r *ConversationStoreRepository) CreateTurn(ctx context.Context, t *ConversationTurn) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now().UTC()
	}
	if t.ReasoningJSON == "" {
		t.ReasoningJSON = "[]"
	}
	if t.ToolCallsJSON == "" {
		t.ToolCallsJSON = "[]"
	}
	if t.CardsJSON == "" {
		t.CardsJSON = "[]"
	}
	if t.ReferenceIDsJSON == "" {
		t.ReferenceIDsJSON = "[]"
	}
	if t.Origin == "" {
		t.Origin = "direct"
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	insertQuery := `
		INSERT INTO conversation_turns (
			id, thread_id, user_id, channel, role, origin, worker_type, content,
			reasoning_json, tool_calls_json, tool_call_id, cards_json, reference_ids_json,
			model_used, tokens_in, tokens_out, latency_ms, tainted_by_external, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = tx.ExecContext(ctx, insertQuery,
		t.ID, t.ThreadID, t.UserID, t.Channel, t.Role, t.Origin, t.WorkerType,
		t.Content, t.ReasoningJSON, t.ToolCallsJSON, t.ToolCallID, t.CardsJSON,
		t.ReferenceIDsJSON, t.ModelUsed, t.TokensIn, t.TokensOut, t.LatencyMs,
		t.TaintedByExternal, t.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("falha ao inserir turno de conversa: %w", err)
	}

	updateThread := `
		UPDATE conversation_threads
		SET last_activity_at = ?, updated_at = ?
		WHERE id = ?
	`
	_, err = tx.ExecContext(ctx, updateThread, t.CreatedAt, t.CreatedAt, t.ThreadID)
	if err != nil {
		return fmt.Errorf("falha ao atualizar last_activity_at na thread: %w", err)
	}

	return tx.Commit()
}

// AddTurn é alias de compatibilidade.
func (r *ConversationStoreRepository) AddTurn(ctx context.Context, t ConversationTurn) error {
	return r.CreateTurn(ctx, &t)
}

// ListTurnsByThread lista turnos em ordem cronológica ASC.
func (r *ConversationStoreRepository) ListTurnsByThread(ctx context.Context, threadID string, limit int) ([]*ConversationTurn, error) {
	if limit <= 0 {
		limit = 20
	}
	query := `
		SELECT id, thread_id, user_id, channel, role, origin, worker_type, content,
		       reasoning_json, tool_calls_json, tool_call_id, cards_json, reference_ids_json,
		       model_used, tokens_in, tokens_out, latency_ms, tainted_by_external, created_at
		FROM (
			SELECT * FROM conversation_turns
			WHERE thread_id = ?
			ORDER BY created_at DESC
			LIMIT ?
		) sub
		ORDER BY created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query, threadID, limit)
	if err != nil {
		return nil, fmt.Errorf("falha ao buscar turnos: %w", err)
	}
	defer rows.Close()

	var turns []*ConversationTurn
	for rows.Next() {
		var t ConversationTurn
		err := rows.Scan(
			&t.ID, &t.ThreadID, &t.UserID, &t.Channel, &t.Role, &t.Origin, &t.WorkerType,
			&t.Content, &t.ReasoningJSON, &t.ToolCallsJSON, &t.ToolCallID, &t.CardsJSON,
			&t.ReferenceIDsJSON, &t.ModelUsed, &t.TokensIn, &t.TokensOut, &t.LatencyMs,
			&t.TaintedByExternal, &t.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		turns = append(turns, &t)
	}
	return turns, rows.Err()
}

// DeleteThread remove uma thread e aciona CASCADE para os turnos.
func (r *ConversationStoreRepository) DeleteThread(ctx context.Context, threadID string) error {
	query := `DELETE FROM conversation_threads WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, threadID)
	return err
}

// GetOrCreateThread busca uma thread recente do canal ou cria uma nova.
func (r *ConversationStoreRepository) GetOrCreateThread(ctx context.Context, userID, channel, externalChatID string) (*ConversationThread, error) {
	threads, err := r.ListThreadsByUser(ctx, userID, channel, 1)
	if err == nil && len(threads) > 0 && time.Since(threads[0].LastActivityAt) < 24*time.Hour {
		return threads[0], nil
	}

	newThread := &ConversationThread{
		ID:             uuid.New().String(),
		UserID:         userID,
		Channel:        channel,
		ExternalChatID: externalChatID,
		Title:          "Conversa",
		LastActivityAt: time.Now().UTC(),
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	if err := r.CreateThread(ctx, newThread); err != nil {
		return nil, err
	}
	return newThread, nil
}

// GetRecentTurns busca os últimos turnos da thread em ordem cronológica.
func (r *ConversationStoreRepository) GetRecentTurns(ctx context.Context, threadID string, limit int) ([]*ConversationTurn, error) {
	return r.ListTurnsByThread(ctx, threadID, limit)
}

func scanThread(scanner interface{ Scan(...any) error }) (*ConversationThread, error) {
	var t ConversationThread
	var stickyUntil sql.NullTime
	var lastConsol sql.NullTime

	err := scanner.Scan(
		&t.ID, &t.UserID, &t.Channel, &t.ExternalChatID, &t.Title, &t.RollingSummary,
		&t.SummaryUpToTurnID, &t.StickyModelName, &stickyUntil,
		&t.LastActivityAt, &lastConsol, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if stickyUntil.Valid {
		t.StickyModelUntil = &stickyUntil.Time
	}
	if lastConsol.Valid {
		t.LastConsolidatedAt = &lastConsol.Time
	}
	return &t, nil
}
