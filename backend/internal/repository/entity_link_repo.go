package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/database"
)

// EntityLink representa uma entidade unificada (pessoa, projeto ou organização) entre múltiplos canais.
type EntityLink struct {
	ID              string            `json:"id"`
	UserID          string            `json:"user_id"`
	CanonicalName   string            `json:"canonical_name"`
	EntityType      string            `json:"entity_type"` // 'person', 'project', 'organization'
	WhatsAppJID     string            `json:"whatsapp_jid"`
	Email           string            `json:"email"`
	Phone           string            `json:"phone"`
	Aliases         []string          `json:"aliases"`
	ExternalIDs     map[string]string `json:"external_ids"`
	Confidence      float64           `json:"confidence"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

// EntityLinkRepository gerencia a resolução cruzada de entidades (entity_links na migration 036).
type EntityLinkRepository struct {
	db *sql.DB
}

// NewEntityLinkRepository instancia o repositório de resolução unificada de entidades.
func NewEntityLinkRepository(db *sql.DB) *EntityLinkRepository {
	return &EntityLinkRepository{db: db}
}

// Upsert insere ou atualiza um vínculo de entidade serializando escritas na DefaultWriterQueue.
func (r *EntityLinkRepository) Upsert(ctx context.Context, link *EntityLink) error {
	if link == nil || strings.TrimSpace(link.UserID) == "" || strings.TrimSpace(link.CanonicalName) == "" {
		return nil
	}
	if link.ID == "" {
		link.ID = uuid.New().String()
	}
	if link.EntityType == "" {
		link.EntityType = "person"
	}
	if link.Confidence <= 0 {
		link.Confidence = 1.0
	}
	now := time.Now().UTC()
	if link.CreatedAt.IsZero() {
		link.CreatedAt = now
	}
	link.UpdatedAt = now

	aliasesBytes, _ := json.Marshal(link.Aliases)
	if len(aliasesBytes) == 0 {
		aliasesBytes = []byte("[]")
	}
	extBytes, _ := json.Marshal(link.ExternalIDs)
	if len(extBytes) == 0 {
		extBytes = []byte("{}")
	}

	writeOp := func() error {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO entity_links (
				id, user_id, canonical_name, entity_type, whatsapp_jid, email, phone,
				aliases_json, external_ids_json, confidence, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				canonical_name = excluded.canonical_name,
				entity_type = excluded.entity_type,
				whatsapp_jid = CASE WHEN excluded.whatsapp_jid != '' THEN excluded.whatsapp_jid ELSE entity_links.whatsapp_jid END,
				email = CASE WHEN excluded.email != '' THEN excluded.email ELSE entity_links.email END,
				phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE entity_links.phone END,
				aliases_json = excluded.aliases_json,
				external_ids_json = excluded.external_ids_json,
				confidence = excluded.confidence,
				updated_at = excluded.updated_at
		`,
			link.ID, link.UserID, strings.TrimSpace(link.CanonicalName), link.EntityType,
			strings.TrimSpace(link.WhatsAppJID), strings.TrimSpace(link.Email), strings.TrimSpace(link.Phone),
			string(aliasesBytes), string(extBytes), link.Confidence, link.CreatedAt, link.UpdatedAt,
		)
		return err
	}
	if q := database.DefaultWriterQueue(); q != nil {
		return q.Execute(ctx, writeOp)
	}
	return writeOp()
}

// Resolve busca uma entidade por nome canônico, apelido, JID do WhatsApp, e-mail ou telefone.
func (r *EntityLinkRepository) Resolve(ctx context.Context, userID, query string) ([]EntityLink, error) {
	q := strings.ToLower(strings.TrimSpace(query))
	if userID == "" || q == "" {
		return nil, nil
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, canonical_name, entity_type, whatsapp_jid, email, phone,
		       aliases_json, external_ids_json, confidence, created_at, updated_at
		FROM entity_links
		WHERE user_id = ?
		ORDER BY confidence DESC, updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var matched []EntityLink
	for rows.Next() {
		var el EntityLink
		var aliasesRaw, extRaw string
		if err := rows.Scan(
			&el.ID, &el.UserID, &el.CanonicalName, &el.EntityType,
			&el.WhatsAppJID, &el.Email, &el.Phone,
			&aliasesRaw, &extRaw, &el.Confidence, &el.CreatedAt, &el.UpdatedAt,
		); err != nil {
			continue
		}
		_ = json.Unmarshal([]byte(aliasesRaw), &el.Aliases)
		_ = json.Unmarshal([]byte(extRaw), &el.ExternalIDs)

		if matchesEntityQuery(el, q) {
			matched = append(matched, el)
		}
	}
	return matched, rows.Err()
}

func matchesEntityQuery(el EntityLink, q string) bool {
	if strings.Contains(strings.ToLower(el.CanonicalName), q) {
		return true
	}
	if el.WhatsAppJID != "" && strings.Contains(strings.ToLower(el.WhatsAppJID), q) {
		return true
	}
	if el.Email != "" && strings.Contains(strings.ToLower(el.Email), q) {
		return true
	}
	if el.Phone != "" && strings.Contains(strings.ToLower(el.Phone), q) {
		return true
	}
	for _, al := range el.Aliases {
		if strings.Contains(strings.ToLower(al), q) {
			return true
		}
	}
	for _, extID := range el.ExternalIDs {
		if strings.EqualFold(extID, q) {
			return true
		}
	}
	return false
}
