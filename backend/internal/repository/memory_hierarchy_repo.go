package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// MemoryEpisode representa um episódio marcante com âncora temporal no SQLite.
type MemoryEpisode struct {
	ID               string     `json:"id"`
	UserID           string     `json:"user_id"`
	ThreadID         string     `json:"thread_id"`
	Channel          string     `json:"channel"`
	Title            string     `json:"title"`
	NarrativeSummary string     `json:"narrative_summary"`
	ParticipantsJSON string     `json:"participants_json"`
	EmotionalTone    string     `json:"emotional_tone"`
	Importance       int        `json:"importance"` // 1 a 5
	HappenedAt       time.Time  `json:"happened_at"`
	FollowupDate     *time.Time `json:"followup_date,omitempty"`
	FollowupDone     bool       `json:"followup_done"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// UserMemoryFact representa um fato atômico individual (Nível 1).
type UserMemoryFact struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Category   string    `json:"category"`
	Content    string    `json:"content"`
	Source     string    `json:"source"`
	Confidence float64   `json:"confidence"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// MemoryThematicSummary representa a consolidação de longo prazo por tema (saúde, trabalho, etc).
type MemoryThematicSummary struct {
	ID                  string    `json:"id"`
	UserID              string    `json:"user_id"`
	ThemeSlug           string    `json:"theme_slug"`
	ThemeTitle          string    `json:"theme_title"`
	ConsolidatedSummary string    `json:"consolidated_summary"`
	FactCount           int       `json:"fact_count"`
	EpisodeCount        int       `json:"episode_count"`
	LastConsolidatedAt  time.Time `json:"last_consolidated_at"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// MemorySearchResult representa o resultado de uma busca híbrida FTS5.
type MemorySearchResult struct {
	RecordID       string  `json:"record_id"`
	HierarchyLevel string  `json:"hierarchy_level"` // 'episode' ou 'theme'
	Title          string  `json:"title"`
	Body           string  `json:"body"`
	Rank           float64 `json:"rank,omitempty"`
}

// MemoryHierarchyRepository gerencia episódios, resumos temáticos e buscas FTS5.
type MemoryHierarchyRepository struct {
	db *sql.DB
}

func NewMemoryHierarchyRepository(db *sql.DB) *MemoryHierarchyRepository {
	return &MemoryHierarchyRepository{db: db}
}

// CreateEpisode insere um episódio (o trigger do SQLite sincroniza o FTS5 automaticamente).
func (r *MemoryHierarchyRepository) CreateEpisode(ctx context.Context, ep *MemoryEpisode) error {
	if ep.ID == "" {
		ep.ID = uuid.New().String()
	}
	if ep.CreatedAt.IsZero() {
		ep.CreatedAt = time.Now().UTC()
	}
	if ep.UpdatedAt.IsZero() {
		ep.UpdatedAt = ep.CreatedAt
	}
	if ep.HappenedAt.IsZero() {
		ep.HappenedAt = ep.CreatedAt
	}
	if ep.Importance <= 0 {
		ep.Importance = 3
	}
	if ep.ParticipantsJSON == "" {
		ep.ParticipantsJSON = "[]"
	}

	followupDoneInt := 0
	if ep.FollowupDone {
		followupDoneInt = 1
	}

	query := `
		INSERT INTO memory_episodes (
			id, user_id, thread_id, channel, title, narrative_summary,
			participants_json, emotional_tone, importance, happened_at,
			followup_date, followup_done, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query,
		ep.ID, ep.UserID, ep.ThreadID, ep.Channel, ep.Title, ep.NarrativeSummary,
		ep.ParticipantsJSON, ep.EmotionalTone, ep.Importance, ep.HappenedAt,
		ep.FollowupDate, followupDoneInt, ep.CreatedAt, ep.UpdatedAt,
	)
	return err
}

// UpsertThematicSummary atualiza ou insere um resumo temático.
func (r *MemoryHierarchyRepository) UpsertThematicSummary(ctx context.Context, sum *MemoryThematicSummary) error {
	if sum.ID == "" {
		sum.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	if sum.CreatedAt.IsZero() {
		sum.CreatedAt = now
	}
	sum.UpdatedAt = now
	sum.LastConsolidatedAt = now

	query := `
		INSERT INTO memory_thematic_summaries (
			id, user_id, theme_slug, theme_title, consolidated_summary,
			fact_count, episode_count, last_consolidated_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, theme_slug) DO UPDATE SET
			consolidated_summary = excluded.consolidated_summary,
			fact_count = excluded.fact_count,
			episode_count = excluded.episode_count,
			last_consolidated_at = excluded.last_consolidated_at,
			updated_at = excluded.updated_at
	`
	_, err := r.db.ExecContext(ctx, query,
		sum.ID, sum.UserID, sum.ThemeSlug, sum.ThemeTitle, sum.ConsolidatedSummary,
		sum.FactCount, sum.EpisodeCount, sum.LastConsolidatedAt, sum.CreatedAt, sum.UpdatedAt,
	)
	return err
}

// SearchHierarchy busca no índice virtual FTS5 memory_hierarchy_fts com performance ultra-rápida.
func (r *MemoryHierarchyRepository) SearchHierarchy(ctx context.Context, userID, queryTerm string, limit int) ([]MemorySearchResult, error) {
	if limit <= 0 {
		limit = 10
	}

	query := `
		SELECT record_id, hierarchy_level, title, body
		FROM memory_hierarchy_fts
		WHERE user_id = ? AND memory_hierarchy_fts MATCH ?
		LIMIT ?
	`
	rows, err := r.db.QueryContext(ctx, query, userID, queryTerm, limit)
	if err != nil {
		return nil, fmt.Errorf("falha ao pesquisar no memory_hierarchy_fts: %w", err)
	}
	defer rows.Close()

	var results []MemorySearchResult
	for rows.Next() {
		var item MemorySearchResult
		if err := rows.Scan(&item.RecordID, &item.HierarchyLevel, &item.Title, &item.Body); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, rows.Err()
}

// ListRecentEpisodes lista episódios recentes do usuário.
func (r *MemoryHierarchyRepository) ListRecentEpisodes(ctx context.Context, userID string, limit int) ([]MemoryEpisode, error) {
	if limit <= 0 {
		limit = 20
	}
	query := `
		SELECT id, user_id, thread_id, channel, title, narrative_summary,
		       participants_json, emotional_tone, importance, happened_at,
		       followup_date, followup_done, created_at, updated_at
		FROM memory_episodes
		WHERE user_id = ?
		ORDER BY happened_at DESC
		LIMIT ?
	`
	rows, err := r.db.QueryContext(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []MemoryEpisode
	for rows.Next() {
		var ep MemoryEpisode
		var followupDoneInt int
		err := rows.Scan(
			&ep.ID, &ep.UserID, &ep.ThreadID, &ep.Channel, &ep.Title, &ep.NarrativeSummary,
			&ep.ParticipantsJSON, &ep.EmotionalTone, &ep.Importance, &ep.HappenedAt,
			&ep.FollowupDate, &followupDoneInt, &ep.CreatedAt, &ep.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		ep.FollowupDone = (followupDoneInt == 1)
		list = append(list, ep)
	}
	return list, rows.Err()
}

// ListThematicSummaries lista resumos temáticos de longo prazo do usuário.
func (r *MemoryHierarchyRepository) ListThematicSummaries(ctx context.Context, userID string) ([]MemoryThematicSummary, error) {
	query := `
		SELECT id, user_id, theme_slug, theme_title, consolidated_summary,
		       fact_count, episode_count, last_consolidated_at, created_at, updated_at
		FROM memory_thematic_summaries
		WHERE user_id = ?
		ORDER BY updated_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []MemoryThematicSummary
	for rows.Next() {
		var s MemoryThematicSummary
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.ThemeSlug, &s.ThemeTitle, &s.ConsolidatedSummary,
			&s.FactCount, &s.EpisodeCount, &s.LastConsolidatedAt, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

// DeleteEpisode remove um episódio específico garantindo isolamento do usuário.
func (r *MemoryHierarchyRepository) DeleteEpisode(ctx context.Context, userID, episodeID string) error {
	query := `DELETE FROM memory_episodes WHERE id = ? AND user_id = ?`
	_, err := r.db.ExecContext(ctx, query, episodeID, userID)
	return err
}

// DeleteThematicSummary remove um resumo temático específico.
func (r *MemoryHierarchyRepository) DeleteThematicSummary(ctx context.Context, userID, themeSlug string) error {
	query := `DELETE FROM memory_thematic_summaries WHERE theme_slug = ? AND user_id = ?`
	_, err := r.db.ExecContext(ctx, query, themeSlug, userID)
	return err
}

// CreateAtomicFact insere um fato atômico em user_memories.
func (r *MemoryHierarchyRepository) CreateAtomicFact(ctx context.Context, fact *UserMemoryFact) error {
	if fact.ID == "" {
		fact.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	if fact.CreatedAt.IsZero() {
		fact.CreatedAt = now
	}
	if fact.UpdatedAt.IsZero() {
		fact.UpdatedAt = now
	}
	if fact.Confidence <= 0 {
		fact.Confidence = 1.0
	}
	if fact.Category == "" {
		fact.Category = "general"
	}
	activeInt := 1
	if !fact.IsActive {
		activeInt = 0
	}

	query := `
		INSERT INTO user_memories (
			id, user_id, category, content, source, confidence,
			is_active, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query,
		fact.ID, fact.UserID, fact.Category, fact.Content, fact.Source, fact.Confidence,
		activeInt, fact.CreatedAt, fact.UpdatedAt,
	)
	return err
}

// ListAtomicFacts lista fatos atômicos ativos do usuário.
func (r *MemoryHierarchyRepository) ListAtomicFacts(ctx context.Context, userID string, limit int) ([]UserMemoryFact, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT id, user_id, category, content, source, confidence, is_active, created_at, updated_at
		FROM user_memories
		WHERE user_id = ? AND is_active = 1
		ORDER BY updated_at DESC
		LIMIT ?
	`
	rows, err := r.db.QueryContext(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []UserMemoryFact
	for rows.Next() {
		var f UserMemoryFact
		var activeInt int
		if err := rows.Scan(
			&f.ID, &f.UserID, &f.Category, &f.Content, &f.Source, &f.Confidence,
			&activeInt, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, err
		}
		f.IsActive = (activeInt == 1)
		list = append(list, f)
	}
	return list, rows.Err()
}

// DeleteAtomicFact desativa logicamente ou remove um fato atômico.
func (r *MemoryHierarchyRepository) DeleteAtomicFact(ctx context.Context, userID, factID string) error {
	query := `UPDATE user_memories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`
	_, err := r.db.ExecContext(ctx, query, factID, userID)
	return err
}
