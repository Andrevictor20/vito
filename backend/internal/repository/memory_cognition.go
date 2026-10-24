package repository

import (
	"database/sql"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// ftsQuery monta uma consulta FTS5 segura a partir do texto (OR entre termos).
func ftsQuery(raw string) string {
	terms := strings.FieldsFunc(strings.ToLower(raw), func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r >= 'à' && r <= 'ÿ')
	})
	stop := map[string]bool{"de": true, "da": true, "do": true, "em": true, "que": true, "para": true, "com": true, "uma": true, "meu": true, "minha": true, "o": true, "a": true, "e": true, "se": true}
	var quoted []string
	for _, t := range terms {
		if len(t) < 3 || stop[t] {
			continue
		}
		quoted = append(quoted, `"`+strings.ReplaceAll(t, `"`, ``)+`"`)
		if len(quoted) >= 8 {
			break
		}
	}
	return strings.Join(quoted, " OR ")
}

// SearchRelevant ranqueia memórias por similaridade FTS5 + importância + recência.
// Score = 0.55*BM25norm + 0.25*importância + 0.20*decaimento temporal (§8.3).
// Memórias substituídas (superseded_by) nunca retornam. Sem match, cai para recentes.
func (r *MemoryRepositorySQLite) SearchRelevant(userID, query string, limit int) ([]domain.Memory, error) {
	if limit <= 0 || limit > 20 {
		limit = 8
	}
	match := ftsQuery(query)
	if match == "" {
		return r.recentActive(userID, limit)
	}

	rows, err := r.db.Query(`
		SELECT m.id, m.user_id, m.category, m.content,
		       COALESCE(m.importance, 3), COALESCE(m.confidence, 1.0),
		       COALESCE(m.access_count, 0), m.last_accessed_at, COALESCE(m.superseded_by, ''),
		       m.created_at, m.updated_at,
		       bm25(memories_fts) AS rank
		FROM memories_fts
		JOIN memories m ON m.rowid = memories_fts.rowid
		WHERE memories_fts MATCH ? AND m.user_id = ?
		  AND COALESCE(m.superseded_by, '') = ''
		ORDER BY rank
		LIMIT ?
	`, match, userID, limit*3)
	if err != nil {
		return r.recentActive(userID, limit)
	}
	defer rows.Close()

	type scored struct {
		m     domain.Memory
		score float64
	}
	var out []scored
	now := time.Now().UTC()
	for rows.Next() {
		var m domain.Memory
		var rank float64
		var lastAcc sql.NullTime
		if err := rows.Scan(&m.ID, &m.UserID, &m.Category, &m.Content,
			&m.Importance, &m.Confidence, &m.AccessCount, &lastAcc,
			&m.SupersededBy, &m.CreatedAt, &m.UpdatedAt, &rank); err != nil {
			continue
		}
		if lastAcc.Valid {
			m.LastAccessedAt = &lastAcc.Time
		}
		sim := 1.0 / (1.0 + (-rank))
		imp := float64(m.Importance) / 5.0
		ageDays := now.Sub(m.UpdatedAt).Hours() / 24.0
		if ageDays < 0 {
			ageDays = 0
		}
		decay := 1.0 / (1.0 + ageDays/30.0)
		score := 0.55*sim + 0.25*imp + 0.20*decay
		out = append(out, scored{m: m, score: score})
	}
	if err := rows.Err(); err != nil {
		return r.recentActive(userID, limit)
	}
	if len(out) == 0 {
		return r.recentActive(userID, limit)
	}
	// Ordena pelo score composto e reforça as retornadas.
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[j].score > out[i].score {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	if len(out) > limit {
		out = out[:limit]
	}
	res := make([]domain.Memory, 0, len(out))
	for _, s := range out {
		res = append(res, s.m)
		_ = r.Reinforce(s.m.ID, userID)
	}
	return res, nil
}

func (r *MemoryRepositorySQLite) recentActive(userID string, limit int) ([]domain.Memory, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, category, content,
		       COALESCE(importance, 3), COALESCE(confidence, 1.0),
		       COALESCE(access_count, 0), last_accessed_at, COALESCE(superseded_by, ''),
		       created_at, updated_at
		FROM memories
		WHERE user_id = ? AND COALESCE(superseded_by, '') = ''
		ORDER BY updated_at DESC
		LIMIT ?
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []domain.Memory
	for rows.Next() {
		var m domain.Memory
		if err := rows.Scan(&m.ID, &m.UserID, &m.Category, &m.Content,
			&m.Importance, &m.Confidence, &m.AccessCount, &m.LastAccessedAt,
			&m.SupersededBy, &m.CreatedAt, &m.UpdatedAt); err != nil {
			continue
		}
		res = append(res, m)
	}
	return res, rows.Err()
}

// Reinforce aplica reforço por uso (Spaced Reinforcement, §8.3).
// Não altera updated_at para evitar escritas desnecessárias e preservar a idade real da memória.
func (r *MemoryRepositorySQLite) Reinforce(id, userID string) error {
	_, err := r.db.Exec(`
		UPDATE memories
		SET access_count = COALESCE(access_count, 0) + 1,
		    last_accessed_at = ?
		WHERE id = ? AND user_id = ?
	`, time.Now().UTC(), id, userID)
	return err
}

// Supersede marca a memória como substituída, preservando histórico.
func (r *MemoryRepositorySQLite) Supersede(id, userID, supersededBy string) error {
	_, err := r.db.Exec(`
		UPDATE memories
		SET superseded_by = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`, supersededBy, time.Now().UTC(), id, userID)
	return err
}
