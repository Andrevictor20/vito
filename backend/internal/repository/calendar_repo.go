package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/andrevmp/kito/backend/internal/domain"
)

// EventRepositorySQLite implementa domain.EventRepository usando SQLite.
type EventRepositorySQLite struct {
	db *sql.DB
}

// NewEventRepository instancia um repositório de eventos SQLite.
func NewEventRepository(db *sql.DB) *EventRepositorySQLite {
	return &EventRepositorySQLite{db: db}
}

func (r *EventRepositorySQLite) Create(e *domain.Event) error {
	query := `
		INSERT INTO events (id, user_id, title, description, location, start_at, end_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, e.ID, e.UserID, e.Title, e.Description, e.Location, e.StartAt, e.EndAt, e.CreatedAt, e.UpdatedAt)
	return err
}

func (r *EventRepositorySQLite) GetByID(id, userID string) (*domain.Event, error) {
	query := `
		SELECT id, user_id, title, description, location, start_at, end_at, created_at, updated_at
		FROM events
		WHERE id = ? AND user_id = ?
	`
	var e domain.Event
	err := r.db.QueryRow(query, id, userID).Scan(
		&e.ID, &e.UserID, &e.Title, &e.Description, &e.Location, &e.StartAt, &e.EndAt, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrEventNotFound
		}
		return nil, err
	}
	return &e, nil
}

func (r *EventRepositorySQLite) ListByUser(userID string, from, to time.Time) ([]domain.Event, error) {
	query := `
		SELECT id, user_id, title, description, location, start_at, end_at, created_at, updated_at
		FROM events
		WHERE user_id = ? AND start_at >= ? AND start_at <= ?
		ORDER BY start_at ASC
	`
	rows, err := r.db.Query(query, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []domain.Event
	for rows.Next() {
		var e domain.Event
		if err := rows.Scan(&e.ID, &e.UserID, &e.Title, &e.Description, &e.Location, &e.StartAt, &e.EndAt, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// CheckConflict verifica se há choque de horários (start_at < existing.end_at AND end_at > existing.start_at).
func (r *EventRepositorySQLite) CheckConflict(userID string, startAt, endAt time.Time, excludeEventID string) (*domain.ConflictInfo, error) {
	query := `
		SELECT id, title
		FROM events
		WHERE user_id = ? 
		  AND id != ?
		  AND start_at < ? 
		  AND end_at > ?
		LIMIT 1
	`
	var conflictID, title string
	err := r.db.QueryRow(query, userID, excludeEventID, endAt, startAt).Scan(&conflictID, &title)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &domain.ConflictInfo{HasConflict: false}, nil
		}
		return nil, err
	}

	return &domain.ConflictInfo{
		HasConflict:      true,
		ConflictingID:    conflictID,
		ConflictingTitle: title,
		Message:          fmt.Sprintf("Conflito detectado com o evento '%s'", title),
	}, nil
}

func (r *EventRepositorySQLite) Delete(id, userID string) error {
	query := `DELETE FROM events WHERE id = ? AND user_id = ?`
	res, err := r.db.Exec(query, id, userID)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return domain.ErrEventNotFound
	}
	return nil
}
