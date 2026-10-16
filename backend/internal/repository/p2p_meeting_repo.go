package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// P2PInviteRepositorySQLite gerencia convites bilaterais no SQLite.
type P2PInviteRepositorySQLite struct {
	db *sql.DB
}

// NewP2PInviteRepositorySQLite instancia o repositório de convites P2P.
func NewP2PInviteRepositorySQLite(db *sql.DB) *P2PInviteRepositorySQLite {
	return &P2PInviteRepositorySQLite{db: db}
}

func (r *P2PInviteRepositorySQLite) Create(ctx context.Context, inv *domain.P2PMeetingInvite) error {
	now := time.Now().UTC()
	if inv.CreatedAt.IsZero() {
		inv.CreatedAt = now
	}
	if inv.UpdatedAt.IsZero() {
		inv.UpdatedAt = now
	}
	if inv.Status == "" {
		inv.Status = domain.P2PInviteStatusPending
	}
	if inv.DurationMinutes <= 0 {
		inv.DurationMinutes = 60
	}

	query := `
		INSERT INTO p2p_meeting_invites (
			id, from_user_id, to_user_id, title, description, start_at, end_at,
			duration_minutes, status, event_id_from, event_id_to, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query,
		inv.ID, inv.FromUserID, inv.ToUserID, inv.Title, inv.Description,
		inv.StartAt.UTC(), inv.EndAt.UTC(), inv.DurationMinutes, inv.Status,
		inv.EventIDFrom, inv.EventIDTo, inv.CreatedAt.UTC(), inv.UpdatedAt.UTC(),
	)
	return err
}

func (r *P2PInviteRepositorySQLite) scanInvite(row interface{ Scan(dest ...any) error }) (*domain.P2PMeetingInvite, error) {
	var inv domain.P2PMeetingInvite
	var st, et, cr, up any
	var evFrom, evTo sql.NullString
	var fromName, toName sql.NullString

	err := row.Scan(
		&inv.ID, &inv.FromUserID, &inv.ToUserID, &inv.Title, &inv.Description,
		&st, &et, &inv.DurationMinutes, &inv.Status, &evFrom, &evTo, &cr, &up,
		&fromName, &toName,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrP2PInviteNotFound
		}
		return nil, err
	}

	inv.StartAt = parseMeetingDBTime(st)
	inv.EndAt = parseMeetingDBTime(et)
	inv.CreatedAt = parseMeetingDBTime(cr)
	inv.UpdatedAt = parseMeetingDBTime(up)

	if evFrom.Valid {
		inv.EventIDFrom = &evFrom.String
	}
	if evTo.Valid {
		inv.EventIDTo = &evTo.String
	}
	if fromName.Valid {
		inv.FromUserName = fromName.String
	}
	if toName.Valid {
		inv.ToUserName = toName.String
	}

	return &inv, nil
}

func (r *P2PInviteRepositorySQLite) GetByID(ctx context.Context, id string) (*domain.P2PMeetingInvite, error) {
	query := `
		SELECT i.id, i.from_user_id, i.to_user_id, i.title, i.description,
		       i.start_at, i.end_at, i.duration_minutes, i.status, i.event_id_from,
		       i.event_id_to, i.created_at, i.updated_at,
		       u1.name AS from_user_name, u2.name AS to_user_name
		FROM p2p_meeting_invites i
		LEFT JOIN users u1 ON i.from_user_id = u1.id
		LEFT JOIN users u2 ON i.to_user_id = u2.id
		WHERE i.id = ?
	`
	return r.scanInvite(r.db.QueryRowContext(ctx, query, id))
}

func (r *P2PInviteRepositorySQLite) ListPendingForUser(ctx context.Context, userID string) ([]domain.P2PMeetingInvite, error) {
	query := `
		SELECT i.id, i.from_user_id, i.to_user_id, i.title, i.description,
		       i.start_at, i.end_at, i.duration_minutes, i.status, i.event_id_from,
		       i.event_id_to, i.created_at, i.updated_at,
		       u1.name AS from_user_name, u2.name AS to_user_name
		FROM p2p_meeting_invites i
		LEFT JOIN users u1 ON i.from_user_id = u1.id
		LEFT JOIN users u2 ON i.to_user_id = u2.id
		WHERE i.to_user_id = ? AND i.status = 'pending'
		ORDER BY i.start_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.P2PMeetingInvite
	for rows.Next() {
		inv, err := r.scanInvite(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *inv)
	}
	return list, rows.Err()
}

func (r *P2PInviteRepositorySQLite) ListUserInvites(ctx context.Context, userID string) ([]domain.P2PMeetingInvite, error) {
	query := `
		SELECT i.id, i.from_user_id, i.to_user_id, i.title, i.description,
		       i.start_at, i.end_at, i.duration_minutes, i.status, i.event_id_from,
		       i.event_id_to, i.created_at, i.updated_at,
		       u1.name AS from_user_name, u2.name AS to_user_name
		FROM p2p_meeting_invites i
		LEFT JOIN users u1 ON i.from_user_id = u1.id
		LEFT JOIN users u2 ON i.to_user_id = u2.id
		WHERE i.to_user_id = ? OR i.from_user_id = ?
		ORDER BY i.created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.P2PMeetingInvite
	for rows.Next() {
		inv, err := r.scanInvite(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *inv)
	}
	return list, rows.Err()
}

func (r *P2PInviteRepositorySQLite) UpdateStatus(ctx context.Context, id string, status string, eventIDFrom, eventIDTo *string) error {
	now := time.Now().UTC()
	query := `
		UPDATE p2p_meeting_invites SET
			status = ?,
			event_id_from = ?,
			event_id_to = ?,
			updated_at = ?
		WHERE id = ?
	`
	res, err := r.db.ExecContext(ctx, query, status, eventIDFrom, eventIDTo, now, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrP2PInviteNotFound
	}
	return nil
}
