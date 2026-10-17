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
		INSERT INTO events (id, user_id, title, description, location, start_at, end_at, source, category, color, recurrence, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			description = excluded.description,
			location = excluded.location,
			start_at = excluded.start_at,
			end_at = excluded.end_at,
			source = excluded.source,
			category = excluded.category,
			color = excluded.color,
			recurrence = excluded.recurrence,
			updated_at = excluded.updated_at
	`
	_, err := r.db.Exec(query, e.ID, e.UserID, e.Title, e.Description, e.Location, startAt, endAt, source, category, e.Color, e.Recurrence, createdAt, updatedAt)
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
		       COALESCE(color, ''), COALESCE(recurrence, ''), COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
		FROM events
		WHERE id = ? AND user_id = ?
	`
	var e domain.Event
	var rawStart, rawEnd, rawCreated, rawUpdated any
	err := r.db.QueryRow(query, id, userID).Scan(
		&e.ID, &e.UserID, &e.Title, &e.Description, &e.Location, 
		&rawStart, &rawEnd, &e.Source, &e.Category, &e.Color, &e.Recurrence,
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
	return r.ListByUserPaged(userID, from, to, 0, 0)
}

// ListByUserPaged lista eventos do intervalo com paginação opcional (BACK-05).
// Limit<=0 retorna tudo (compatível com sincronizações internas e workers).
func (r *EventRepositorySQLite) ListByUserPaged(userID string, from, to time.Time, limit, offset int) ([]domain.Event, error) {
	fromUTC := from.UTC()
	toUTC := to.UTC()

	query := `
		SELECT id, user_id, COALESCE(title, ''), COALESCE(description, ''), COALESCE(location, ''),
		       start_at, end_at, COALESCE(source, 'vito'), COALESCE(category, 'general'),
		       COALESCE(color, ''), COALESCE(recurrence, ''), COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
		FROM events
		WHERE user_id = ?
		  AND ((start_at >= ? AND start_at <= ?) OR (end_at >= ? AND start_at <= ?))
		ORDER BY start_at ASC
	`
	args := []interface{}{userID, fromUTC, toUTC, fromUTC, toUTC}
	if limit > 0 {
		if limit > 200 {
			limit = 200
		}
		if offset < 0 {
			offset = 0
		}
		query += ` LIMIT ? OFFSET ?`
		args = append(args, limit, offset)
	}
	rows, err := r.db.Query(query, args...)
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
			&rawStart, &rawEnd, &e.Source, &e.Category, &e.Color, &e.Recurrence,
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
// Feriados, eventos de dia inteiro (>= 20h) e celebrações nunca bloqueiam a criação de compromissos.
func (r *EventRepositorySQLite) CheckConflict(userID string, startAt, endAt time.Time, excludeEventID string) (*domain.ConflictInfo, error) {
	startAtUTC := startAt.UTC()
	endAtUTC := endAt.UTC()

	query := `
		SELECT id, title, category, start_at, end_at, description
		FROM events
		WHERE user_id = ? 
		  AND id != ?
		  AND LOWER(category) NOT IN ('holiday', 'feriado')
		  AND start_at < ? 
		  AND end_at > ?
	`
	rows, err := r.db.Query(query, userID, excludeEventID, endAtUTC, startAtUTC)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	holidayKeywords := []string{
		"feriado", "nossa senhora", "aparecida", "ano novo", "confraternização", "carnaval",
		"quarta-feira de cinzas", "quarta de cinzas", "sexta-feira santa", "paixão de cristo",
		"páscoa", "pascoa", "tiradentes", "dia do trabalho", "dia do trabalhador",
		"corpus christi", "independência", "independencia", "finados", "proclamação da república",
		"proclamacao da republica", "consciência negra", "consciencia negra", "natal",
		"dia das mães", "dia dos pais", "dia das crianças", "holiday", "réveillon", "reveillon",
	}

	for rows.Next() {
		var conflictID, title, category, rawStart, rawEnd, desc string
		if err := rows.Scan(&conflictID, &title, &category, &rawStart, &rawEnd, &desc); err != nil {
			return nil, err
		}

		catLower := strings.ToLower(category)
		if catLower == "holiday" || catLower == "feriado" {
			continue
		}

		evStart := parseDBTime(rawStart)
		evEnd := parseDBTime(rawEnd)
		if evEnd.Sub(evStart) >= 20*time.Hour {
			continue
		}

		combined := strings.ToLower(title + " " + desc)
		isHoliday := false
		for _, kw := range holidayKeywords {
			if strings.Contains(combined, kw) {
				isHoliday = true
				break
			}
		}
		if isHoliday {
			continue
		}

		return &domain.ConflictInfo{
			HasConflict:      true,
			ConflictingID:    conflictID,
			ConflictingTitle: title,
			Message:          fmt.Sprintf("Conflito detectado com o evento '%s'", title),
		}, nil
	}

	return &domain.ConflictInfo{HasConflict: false}, nil
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
