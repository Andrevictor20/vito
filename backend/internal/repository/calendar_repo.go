package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
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
	source := e.Source
	if source == "" {
		source = "vito"
	}
	category := e.Category
	if category == "" {
		category = "general"
	}
	startAt := e.StartAt.UTC()
	endAt := e.EndAt.UTC()
	createdAt := e.CreatedAt.UTC()
	updatedAt := e.UpdatedAt.UTC()

	query := `
		INSERT INTO events (id, user_id, title, description, location, start_at, end_at, source, category, color, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			description = excluded.description,
			location = excluded.location,
			start_at = excluded.start_at,
			end_at = excluded.end_at,
			source = excluded.source,
			category = excluded.category,
			color = excluded.color,
			updated_at = excluded.updated_at
	`
	_, err := r.db.Exec(query, e.ID, e.UserID, e.Title, e.Description, e.Location, startAt, endAt, source, category, e.Color, createdAt, updatedAt)
	return err
}

// parseDBTime converte defensivamente qualquer tipo vindo do SQLite para time.Time em UTC.
func parseDBTime(val any) time.Time {
	if val == nil {
		return time.Now().UTC()
	}

	switch v := val.(type) {
	case time.Time:
		return v.UTC()
	case string:
		v = strings.TrimSpace(v)
		if v == "" {
			return time.Now().UTC()
		}

		formats := []string{
			time.RFC3339Nano,
			time.RFC3339,
			"2006-01-02 15:04:05.999999999-07:00",
			"2006-01-02 15:04:05.999999999Z07:00",
			"2006-01-02 15:04:05-07:00",
			"2006-01-02 15:04:05Z07:00",
			"2006-01-02 15:04:05 +0000 UTC",
			"2006-01-02 15:04:05 -0700 MST",
			"2006-01-02 15:04:05",
			"2006-01-02T15:04:05",
			"2006-01-02",
		}
		for _, format := range formats {
			if t, err := time.Parse(format, v); err == nil {
				return t.UTC()
			}
		}

		for _, format := range formats {
			if t, err := time.ParseInLocation(format, v, time.UTC); err == nil {
				return t.UTC()
			}
		}
		return time.Now().UTC()
	case []byte:
		return parseDBTime(string(v))
	case int64:
		if v > 1e11 {
			return time.UnixMilli(v).UTC()
		}
		return time.Unix(v, 0).UTC()
	default:
		return time.Now().UTC()
	}
}

func (r *EventRepositorySQLite) GetByID(id, userID string) (*domain.Event, error) {
	query := `
		SELECT id, user_id, COALESCE(title, ''), COALESCE(description, ''), COALESCE(location, ''), 
		       start_at, end_at, COALESCE(source, 'vito'), COALESCE(category, 'general'), 
		       COALESCE(color, ''), COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
		FROM events
		WHERE id = ? AND user_id = ?
	`
	var e domain.Event
	var rawStart, rawEnd, rawCreated, rawUpdated any
	err := r.db.QueryRow(query, id, userID).Scan(
		&e.ID, &e.UserID, &e.Title, &e.Description, &e.Location, 
		&rawStart, &rawEnd, &e.Source, &e.Category, &e.Color, 
		&rawCreated, &rawUpdated,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrEventNotFound
		}
		return nil, err
	}

	e.StartAt = parseDBTime(rawStart)
	e.EndAt = parseDBTime(rawEnd)
	e.CreatedAt = parseDBTime(rawCreated)
	e.UpdatedAt = parseDBTime(rawUpdated)

	return &e, nil
}

func (r *EventRepositorySQLite) ListByUser(userID string, from, to time.Time) ([]domain.Event, error) {
	fromUTC := from.UTC()
	toUTC := to.UTC()

	query := `
		SELECT id, user_id, COALESCE(title, ''), COALESCE(description, ''), COALESCE(location, ''), 
		       start_at, end_at, COALESCE(source, 'vito'), COALESCE(category, 'general'), 
		       COALESCE(color, ''), COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
		FROM events
		WHERE user_id = ? 
		  AND ((start_at >= ? AND start_at <= ?) OR (end_at >= ? AND start_at <= ?))
		ORDER BY start_at ASC
	`
	rows, err := r.db.Query(query, userID, fromUTC, toUTC, fromUTC, toUTC)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []domain.Event
	for rows.Next() {
		var e domain.Event
		var rawStart, rawEnd, rawCreated, rawUpdated any
		if err := rows.Scan(
			&e.ID, &e.UserID, &e.Title, &e.Description, &e.Location, 
			&rawStart, &rawEnd, &e.Source, &e.Category, &e.Color, 
			&rawCreated, &rawUpdated,
		); err != nil {
			log.Printf("[EventRepo] Alerta: erro ao escanear linha de evento para user %s: %v", userID, err)
			continue
		}

		e.StartAt = parseDBTime(rawStart)
		e.EndAt = parseDBTime(rawEnd)
		e.CreatedAt = parseDBTime(rawCreated)
		e.UpdatedAt = parseDBTime(rawUpdated)

		events = append(events, e)
	}
	return events, rows.Err()
}

// CheckConflict verifica se há choque de horários (start_at < existing.end_at AND end_at > existing.start_at).
func (r *EventRepositorySQLite) CheckConflict(userID string, startAt, endAt time.Time, excludeEventID string) (*domain.ConflictInfo, error) {
	startAtUTC := startAt.UTC()
	endAtUTC := endAt.UTC()

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
	err := r.db.QueryRow(query, userID, excludeEventID, endAtUTC, startAtUTC).Scan(&conflictID, &title)
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
