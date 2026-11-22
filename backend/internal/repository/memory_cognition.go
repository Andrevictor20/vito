package repository

import (
	"context"
	"database/sql"
	"encoding/binary"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// EmbedderFunc calcula o embedding vetorial float32 de um texto (ex.: gemini-embedding-001).
type EmbedderFunc func(ctx context.Context, text string) ([]float32, error)

// SetEmbedder configura o gerador de embeddings opcional no MemoryRepositorySQLite.
func (r *MemoryRepositorySQLite) SetEmbedder(fn EmbedderFunc) {
	r.embedder = fn
}

// EncodeFloat32Vector serializa um slice float32 em BLOB little-endian compacto.
func EncodeFloat32Vector(vec []float32) []byte {
	if len(vec) == 0 {
		return nil
	}
	buf := make([]byte, len(vec)*4)
	for i, v := range vec {
		binary.LittleEndian.PutUint32(buf[i*4:(i+1)*4], math.Float32bits(v))
	}
	return buf
}

// DecodeFloat32Vector desserializa um BLOB little-endian em slice float32.
func DecodeFloat32Vector(blob []byte) []float32 {
	if len(blob) == 0 || len(blob)%4 != 0 {
		return nil
	}
	n := len(blob) / 4
	vec := make([]float32, n)
	for i := 0; i < n; i++ {
		bits := binary.LittleEndian.Uint32(blob[i*4 : (i+1)*4])
		vec[i] = math.Float32frombits(bits)
	}
	return vec
}

// CosineSimilarity calcula a similaridade de cosseno normalizada em [0, 1].
func CosineSimilarity(a, b []float32) float64 {
	if len(a) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		av := float64(a[i])
		bv := float64(b[i])
		dot += av * bv
		normA += av * av
		normB += bv * bv
	}
	if normA <= 0 || normB <= 0 {
		return 0
	}
	cos := dot / (math.Sqrt(normA) * math.Sqrt(normB))
	if cos < 0 {
		return 0
	}
	if cos > 1 {
		return 1
	}
	return cos
}

// UpsertEmbedding persiste o vetor float32 de uma memória via DefaultWriterQueue.
func (r *MemoryRepositorySQLite) UpsertEmbedding(ctx context.Context, memoryID, userID, modelName string, vec []float32) error {
	if strings.TrimSpace(memoryID) == "" || len(vec) == 0 {
		return nil
	}
	if modelName == "" {
		modelName = "gemini-embedding-001"
	}
	blob := EncodeFloat32Vector(vec)
	now := time.Now().UTC()
	writeOp := func() error {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO memory_embeddings (memory_id, user_id, model_name, dimensions, embedding_blob, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(memory_id) DO UPDATE SET
				model_name = excluded.model_name,
				dimensions = excluded.dimensions,
				embedding_blob = excluded.embedding_blob,
				updated_at = excluded.updated_at
		`, memoryID, userID, modelName, len(vec), blob, now)
		return err
	}
	if q := database.DefaultWriterQueue(); q != nil {
		return q.Execute(ctx, writeOp)
	}
	return writeOp()
}

// loadUserEmbeddings carrega os embeddings ativos do usuário em memória (< 5ms para bases pessoais).
func (r *MemoryRepositorySQLite) loadUserEmbeddings(userID string) map[string][]float32 {
	out := make(map[string][]float32)
	rows, err := r.db.Query(`
		SELECT memory_id, embedding_blob
		FROM memory_embeddings
		WHERE user_id = ?
	`, userID)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var blob []byte
		if err := rows.Scan(&id, &blob); err == nil {
			if vec := DecodeFloat32Vector(blob); len(vec) > 0 {
				out[id] = vec
			}
		}
	}
	return out
}

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

// SearchRelevant ranqueia memórias combinando busca híbrida FTS5 BM25 + Cosine Similarity vetorial + importância + recência.
// Memórias substituídas (superseded_by != '') nunca retornam.
func (r *MemoryRepositorySQLite) SearchRelevant(userID, query string, limit int) ([]domain.Memory, error) {
	var queryVec []float32
	if r.embedder != nil && strings.TrimSpace(query) != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
		vec, err := r.embedder(ctx, query)
		cancel()
		if err == nil {
			queryVec = vec
		}
	}
	return r.SearchRelevantHybrid(userID, query, limit, queryVec)
}

// SearchRelevantHybrid executa o ranqueamento híbrido (BM25 + vetor float32 opcional + importância + decaimento temporal).
func (r *MemoryRepositorySQLite) SearchRelevantHybrid(userID, query string, limit int, queryVec []float32) ([]domain.Memory, error) {
	if limit <= 0 || limit > 20 {
		limit = 8
	}

	bm25ByID := make(map[string]float64)
	memByID := make(map[string]domain.Memory)

	match := ftsQuery(query)
	if match != "" {
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
		`, match, userID, limit*4)
		if err == nil {
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
				bm25ByID[m.ID] = 1.0 / (1.0 + math.Max(0, -rank))
				memByID[m.ID] = m
			}
			rows.Close()
		}
	}

	userEmbeddings := r.loadUserEmbeddings(userID)
	if len(queryVec) > 0 && len(userEmbeddings) > 0 {
		activeMems, err := r.recentActive(userID, 100)
		if err == nil {
			for _, m := range activeMems {
				if _, exists := memByID[m.ID]; !exists {
					if _, hasVec := userEmbeddings[m.ID]; hasVec {
						memByID[m.ID] = m
					}
				}
			}
		}
	}

	if len(memByID) == 0 {
		return r.recentActive(userID, limit)
	}

	type scored struct {
		m     domain.Memory
		score float64
	}
	var out []scored
	now := time.Now().UTC()
	hasVectorSearch := len(queryVec) > 0 && len(userEmbeddings) > 0

	for id, m := range memByID {
		bm25Sim := bm25ByID[id]
		var vecSim float64
		if hasVectorSearch {
			if vec, ok := userEmbeddings[id]; ok {
				vecSim = CosineSimilarity(queryVec, vec)
			}
		}
		// Se candidato veio apenas da busca vetorial e a similaridade for irrisória, filtra
		if bm25Sim == 0 && vecSim < 0.25 {
			continue
		}

		imp := float64(m.Importance) / 5.0
		ageDays := now.Sub(m.UpdatedAt).Hours() / 24.0
		if ageDays < 0 {
			ageDays = 0
		}
		decay := 1.0 / (1.0 + ageDays/30.0)

		var score float64
		if hasVectorSearch {
			score = 0.35*bm25Sim + 0.35*vecSim + 0.18*imp + 0.12*decay
		} else {
			score = 0.55*bm25Sim + 0.25*imp + 0.20*decay
		}
		out = append(out, scored{m: m, score: score})
	}

	if len(out) == 0 {
		return r.recentActive(userID, limit)
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].score > out[j].score
	})
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
		var lastAcc sql.NullTime
		if err := rows.Scan(&m.ID, &m.UserID, &m.Category, &m.Content,
			&m.Importance, &m.Confidence, &m.AccessCount, &lastAcc,
			&m.SupersededBy, &m.CreatedAt, &m.UpdatedAt); err != nil {
			continue
		}
		if lastAcc.Valid {
			m.LastAccessedAt = &lastAcc.Time
		}
		res = append(res, m)
	}
	return res, rows.Err()
}

// Reinforce aplica reforço por uso (Spaced Reinforcement, §8.3).
func (r *MemoryRepositorySQLite) Reinforce(id, userID string) error {
	return ExecuteQueuedWrite(context.Background(), func() error {
		_, err := r.db.Exec(`
			UPDATE memories
			SET access_count = COALESCE(access_count, 0) + 1,
			    last_accessed_at = ?
			WHERE id = ? AND user_id = ?
		`, time.Now().UTC(), id, userID)
		return err
	})
}

// Supersede marca a memória como substituída, preservando histórico.
func (r *MemoryRepositorySQLite) Supersede(id, userID, supersededBy string) error {
	return ExecuteQueuedWrite(context.Background(), func() error {
		_, err := r.db.Exec(`
			UPDATE memories
			SET superseded_by = ?, updated_at = ?
			WHERE id = ? AND user_id = ?
		`, supersededBy, time.Now().UTC(), id, userID)
		return err
	})
}
