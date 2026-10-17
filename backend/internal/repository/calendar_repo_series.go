package repository

import (
	"errors"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// DeleteSeries remove todas as ocorrências de um evento recorrente ou série pertencente ao usuário.
func (r *EventRepositorySQLite) DeleteSeries(id, userID string) (int, error) {
	orig, err := r.GetByID(id, userID)
	if err != nil {
		return 0, err
	}

	query := `DELETE FROM events WHERE user_id = ? AND (LOWER(title) = LOWER(?) OR (recurrence != '' AND recurrence = ? AND LOWER(title) = LOWER(?)))`
	res, err := r.db.Exec(query, userID, orig.Title, orig.Recurrence, orig.Title)
	if err != nil {
		return 0, err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	return int(rowsAffected), nil
}

// Update atualiza um único evento no SQLite.
func (r *EventRepositorySQLite) Update(e *domain.Event) error {
	now := time.Now().UTC()
	startAt := e.StartAt.UTC()
	endAt := e.EndAt.UTC()

	query := `
		UPDATE events 
		SET title = ?, description = ?, location = ?, start_at = ?, end_at = ?, category = ?, color = ?, recurrence = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`
	res, err := r.db.Exec(query, e.Title, e.Description, e.Location, startAt, endAt, e.Category, e.Color, e.Recurrence, now, e.ID, e.UserID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrEventNotFound
	}
	return nil
}

// UpdateSeries atualiza todas as ocorrências de uma série recorrente (título, descrição, local, categoria, horário diário).
func (r *EventRepositorySQLite) UpdateSeries(e *domain.Event) (int, error) {
	orig, err := r.GetByID(e.ID, e.UserID)
	if err != nil {
		return 0, err
	}

	// Busca todas as ocorrências da mesma série
	querySelect := `SELECT id, start_at FROM events WHERE user_id = ? AND LOWER(title) = LOWER(?)`
	rows, err := r.db.Query(querySelect, e.UserID, orig.Title)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type evItem struct {
		id      string
		startAt time.Time
	}
	var items []evItem
	for rows.Next() {
		var id string
		var rawStart any
		if err := rows.Scan(&id, &rawStart); err == nil {
			items = append(items, evItem{id: id, startAt: parseDBTime(rawStart)})
		}
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	if len(items) == 0 {
		return 0, domain.ErrEventNotFound
	}

	dur := e.EndAt.Sub(e.StartAt)
	nowUTC := time.Now().UTC()
	updatedCount := 0

	for _, item := range items {
		// Preserva a data civil daquela ocorrência e injeta a nova hora/minuto do evento atualizado
		targetStart := time.Date(
			item.startAt.Year(), item.startAt.Month(), item.startAt.Day(),
			e.StartAt.Hour(), e.StartAt.Minute(), e.StartAt.Second(), 0, time.UTC,
		)
		targetEnd := targetStart.Add(dur)

		queryUpdate := `
			UPDATE events 
			SET title = ?, description = ?, location = ?, start_at = ?, end_at = ?, category = ?, color = ?, recurrence = ?, updated_at = ?
			WHERE id = ? AND user_id = ?
		`
		if _, err := r.db.Exec(queryUpdate, e.Title, e.Description, e.Location, targetStart, targetEnd, e.Category, e.Color, e.Recurrence, nowUTC, item.id, e.UserID); err == nil {
			updatedCount++
		}
	}

	return updatedCount, nil
}

// DeleteByTitle remove todos os eventos do usuário que correspondam ao título informado.
func (r *EventRepositorySQLite) DeleteByTitle(userID, titleQuery string) (int, error) {
	clean := strings.TrimSpace(titleQuery)
	if clean == "" {
		return 0, errors.New("termo para exclusão não pode ser vazio")
	}

	query := `DELETE FROM events WHERE user_id = ? AND LOWER(title) LIKE '%' || LOWER(?) || '%' AND COALESCE(category, '') != 'holiday'`
	res, err := r.db.Exec(query, userID, clean)
	if err != nil {
		return 0, err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	return int(rowsAffected), nil
}

// UpdateTimesByTitle ajusta o horário de início e término dos eventos que correspondam ao título.
func (r *EventRepositorySQLite) UpdateTimesByTitle(userID, titleQuery string, newStart, newEnd time.Time) (int, error) {
	clean := strings.TrimSpace(titleQuery)
	if clean == "" {
		return 0, errors.New("termo para atualização não pode ser vazio")
	}

	querySelect := `SELECT id, start_at, COALESCE(category, '') FROM events WHERE user_id = ? AND LOWER(title) LIKE '%' || LOWER(?) || '%'`
	rows, err := r.db.Query(querySelect, userID, clean)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type evItem struct {
		id       string
		startAt  time.Time
		category string
	}
	var items []evItem
	for rows.Next() {
		var id string
		var rawStart any
		var cat string
		if err := rows.Scan(&id, &rawStart, &cat); err == nil {
			// Feriados são somente-leitura (P3): nunca têm horário alterado em massa.
			if cat == "holiday" {
				continue
			}
			items = append(items, evItem{id: id, startAt: parseDBTime(rawStart)})
		}
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	if len(items) == 0 {
		return 0, domain.ErrEventNotFound
	}

	dur := newEnd.Sub(newStart)
	nowUTC := time.Now().UTC()
	updatedCount := 0

	loc := newStart.Location()
	for _, item := range items {
		itemLocal := item.startAt.In(loc)
		targetLocal := time.Date(
			itemLocal.Year(), itemLocal.Month(), itemLocal.Day(),
			newStart.Hour(), newStart.Minute(), newStart.Second(), 0, loc,
		)
		targetStart := targetLocal.UTC()
		targetEnd := targetStart.Add(dur)

		queryUpdate := `UPDATE events SET start_at = ?, end_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`
		if _, err := r.db.Exec(queryUpdate, targetStart, targetEnd, nowUTC, item.id, userID); err == nil {
			updatedCount++
		}
	}

	return updatedCount, nil
}

// ListUpcomingUnreminded busca compromissos futuros sem notificação enviada no intervalo especificado.
func (r *EventRepositorySQLite) ListUpcomingUnreminded(from, to time.Time) ([]domain.Event, error) {
	fromUTC := from.UTC()
	toUTC := to.UTC()

	query := `
		SELECT id, user_id, COALESCE(title, ''), COALESCE(description, ''), COALESCE(location, ''), 
		       start_at, end_at, COALESCE(source, 'vito'), COALESCE(category, 'general'), 
		       COALESCE(color, ''), COALESCE(recurrence, ''), COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
		FROM events
		WHERE start_at >= ? AND start_at <= ? AND reminder_sent_at IS NULL
		ORDER BY start_at ASC
	`
	rows, err := r.db.Query(query, fromUTC, toUTC)
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

// MarkReminderSent registra o timestamp em que o lembrete de antecedência foi despachado para o usuário.
func (r *EventRepositorySQLite) MarkReminderSent(eventID string, sentAt time.Time) error {
	query := `UPDATE events SET reminder_sent_at = ? WHERE id = ?`
	_, err := r.db.Exec(query, sentAt.UTC(), eventID)
	return err
}

// ListStartingNowUnreminded busca compromissos que iniciam no intervalo especificado e ainda não tiveram alerta de início disparado.
func (r *EventRepositorySQLite) ListStartingNowUnreminded(from, to time.Time) ([]domain.Event, error) {
	fromUTC := from.UTC()
	toUTC := to.UTC()

	query := `
		SELECT id, user_id, COALESCE(title, ''), COALESCE(description, ''), COALESCE(location, ''), 
		       start_at, end_at, COALESCE(source, 'vito'), COALESCE(category, 'general'), 
		       COALESCE(color, ''), COALESCE(recurrence, ''), COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
		FROM events
		WHERE start_at >= ? AND start_at <= ? AND start_reminder_sent_at IS NULL
		ORDER BY start_at ASC
	`
	rows, err := r.db.Query(query, fromUTC, toUTC)
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

// MarkStartReminderSent registra o timestamp em que o alerta de início de evento foi despachado.
func (r *EventRepositorySQLite) MarkStartReminderSent(eventID string, sentAt time.Time) error {
	query := `UPDATE events SET start_reminder_sent_at = ? WHERE id = ?`
	_, err := r.db.Exec(query, sentAt.UTC(), eventID)
	return err
}
