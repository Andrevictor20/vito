package repository

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// BookingRepositorySQLite implementa domain.BookingRepository sobre SQLite.
type BookingRepositorySQLite struct {
	db *sql.DB
}

// NewBookingRepositorySQLite instancia o repositório de booking.
func NewBookingRepositorySQLite(db *sql.DB) *BookingRepositorySQLite {
	return &BookingRepositorySQLite{db: db}
}

func (r *BookingRepositorySQLite) CreateType(bt *domain.BookingType) error {
	query := `
		INSERT INTO booking_types (
			id, user_id, slug, title, description, duration_minutes, buffer_minutes,
			days_of_week, start_hour, end_hour, is_active, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	now := time.Now().UTC()
	if bt.CreatedAt.IsZero() {
		bt.CreatedAt = now
	}
	if bt.UpdatedAt.IsZero() {
		bt.UpdatedAt = now
	}

	_, err := r.db.Exec(query,
		bt.ID, bt.UserID, bt.Slug, bt.Title, bt.Description, bt.DurationMinutes, bt.BufferMinutes,
		bt.DaysOfWeek, bt.StartHour, bt.EndHour, bt.IsActive, bt.CreatedAt, bt.UpdatedAt,
	)
	return err
}

func (r *BookingRepositorySQLite) UpdateType(bt *domain.BookingType) error {
	query := `
		UPDATE booking_types SET
			slug = ?, title = ?, description = ?, duration_minutes = ?, buffer_minutes = ?,
			days_of_week = ?, start_hour = ?, end_hour = ?, is_active = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`
	bt.UpdatedAt = time.Now().UTC()
	res, err := r.db.Exec(query,
		bt.Slug, bt.Title, bt.Description, bt.DurationMinutes, bt.BufferMinutes,
		bt.DaysOfWeek, bt.StartHour, bt.EndHour, bt.IsActive, bt.UpdatedAt,
		bt.ID, bt.UserID,
	)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrBookingTypeNotFound
	}
	return nil
}

func (r *BookingRepositorySQLite) DeleteType(id, userID string) error {
	query := `DELETE FROM booking_types WHERE id = ? AND user_id = ?`
	res, err := r.db.Exec(query, id, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrBookingTypeNotFound
	}
	return nil
}

func (r *BookingRepositorySQLite) GetTypeByID(id, userID string) (*domain.BookingType, error) {
	query := `
		SELECT id, user_id, slug, title, COALESCE(description, ''), duration_minutes, buffer_minutes,
		       days_of_week, start_hour, end_hour, is_active, created_at, updated_at
		FROM booking_types
		WHERE id = ? AND user_id = ?
	`
	var bt domain.BookingType
	var rawCreated, rawUpdated any
	err := r.db.QueryRow(query, id, userID).Scan(
		&bt.ID, &bt.UserID, &bt.Slug, &bt.Title, &bt.Description, &bt.DurationMinutes, &bt.BufferMinutes,
		&bt.DaysOfWeek, &bt.StartHour, &bt.EndHour, &bt.IsActive, &rawCreated, &rawUpdated,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrBookingTypeNotFound
		}
		return nil, err
	}
	bt.CreatedAt = parseDBTime(rawCreated)
	bt.UpdatedAt = parseDBTime(rawUpdated)
	return &bt, nil
}

func (r *BookingRepositorySQLite) GetTypeBySlug(userIdentifier, slug string) (*domain.BookingType, error) {
	query := `
		SELECT bt.id, bt.user_id, bt.slug, bt.title, COALESCE(bt.description, ''), bt.duration_minutes, bt.buffer_minutes,
		       bt.days_of_week, bt.start_hour, bt.end_hour, bt.is_active, bt.created_at, bt.updated_at
		FROM booking_types bt
		LEFT JOIN users u ON bt.user_id = u.id
		WHERE (
			bt.user_id = ?
			OR LOWER(u.name) = LOWER(?)
			OR LOWER(u.email) = LOWER(?)
			OR LOWER(u.email) LIKE LOWER(?) || '@%'
			OR LOWER(u.name) LIKE LOWER(?) || ' %'
			OR REPLACE(LOWER(u.name), 'é', 'e') LIKE LOWER(?) || ' %'
			OR REPLACE(LOWER(u.name), 'é', 'e') = LOWER(?)
		)
		  AND bt.slug = ?
		LIMIT 1
	`
	cleanID := strings.TrimSpace(userIdentifier)
	var bt domain.BookingType
	var rawCreated, rawUpdated any
	err := r.db.QueryRow(query, cleanID, cleanID, cleanID, cleanID, cleanID, cleanID, cleanID, slug).Scan(
		&bt.ID, &bt.UserID, &bt.Slug, &bt.Title, &bt.Description, &bt.DurationMinutes, &bt.BufferMinutes,
		&bt.DaysOfWeek, &bt.StartHour, &bt.EndHour, &bt.IsActive, &rawCreated, &rawUpdated,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrBookingTypeNotFound
		}
		return nil, err
	}
	bt.CreatedAt = parseDBTime(rawCreated)
	bt.UpdatedAt = parseDBTime(rawUpdated)
	return &bt, nil
}

func (r *BookingRepositorySQLite) ListTypesByUser(userID string) ([]domain.BookingType, error) {
	query := `
		SELECT id, user_id, slug, title, COALESCE(description, ''), duration_minutes, buffer_minutes,
		       days_of_week, start_hour, end_hour, is_active, created_at, updated_at
		FROM booking_types
		WHERE user_id = ?
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.BookingType, 0)
	for rows.Next() {
		var bt domain.BookingType
		var rawCreated, rawUpdated any
		if err := rows.Scan(
			&bt.ID, &bt.UserID, &bt.Slug, &bt.Title, &bt.Description, &bt.DurationMinutes, &bt.BufferMinutes,
			&bt.DaysOfWeek, &bt.StartHour, &bt.EndHour, &bt.IsActive, &rawCreated, &rawUpdated,
		); err != nil {
			return nil, err
		}
		bt.CreatedAt = parseDBTime(rawCreated)
		bt.UpdatedAt = parseDBTime(rawUpdated)
		list = append(list, bt)
	}
	return list, nil
}

func (r *BookingRepositorySQLite) CreateAppointment(appt *domain.BookingAppointment) error {
	query := `
		INSERT INTO booking_appointments (
			id, booking_type_id, user_id, guest_name, guest_email, guest_notes,
			start_at, end_at, status, event_id, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	if appt.CreatedAt.IsZero() {
		appt.CreatedAt = time.Now().UTC()
	}
	if appt.Status == "" {
		appt.Status = "confirmed"
	}

	var eventIDVal any
	if appt.EventID != "" {
		eventIDVal = appt.EventID
	}

	_, err := r.db.Exec(query,
		appt.ID, appt.BookingTypeID, appt.UserID, appt.GuestName, appt.GuestEmail, appt.GuestNotes,
		appt.StartAt.UTC(), appt.EndAt.UTC(), appt.Status, eventIDVal, appt.CreatedAt.UTC(),
	)
	return err
}

func (r *BookingRepositorySQLite) GetAppointmentByID(id, userID string) (*domain.BookingAppointment, error) {
	query := `
		SELECT id, booking_type_id, user_id, guest_name, guest_email, COALESCE(guest_notes, ''),
		       start_at, end_at, status, COALESCE(event_id, ''), created_at
		FROM booking_appointments
		WHERE id = ? AND user_id = ?
	`
	var a domain.BookingAppointment
	var rawStart, rawEnd, rawCreated any
	err := r.db.QueryRow(query, id, userID).Scan(
		&a.ID, &a.BookingTypeID, &a.UserID, &a.GuestName, &a.GuestEmail, &a.GuestNotes,
		&rawStart, &rawEnd, &a.Status, &a.EventID, &rawCreated,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("agendamento não encontrado")
		}
		return nil, err
	}
	a.StartAt = parseDBTime(rawStart)
	a.EndAt = parseDBTime(rawEnd)
	a.CreatedAt = parseDBTime(rawCreated)
	return &a, nil
}

func (r *BookingRepositorySQLite) ListAppointmentsByUser(userID string, from, to time.Time) ([]domain.BookingAppointment, error) {
	query := `
		SELECT id, booking_type_id, user_id, guest_name, guest_email, COALESCE(guest_notes, ''),
		       start_at, end_at, status, COALESCE(event_id, ''), created_at
		FROM booking_appointments
		WHERE user_id = ? AND start_at >= ? AND end_at <= ?
		ORDER BY start_at ASC
	`
	rows, err := r.db.Query(query, userID, from.UTC(), to.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.BookingAppointment, 0)
	for rows.Next() {
		var a domain.BookingAppointment
		var rawStart, rawEnd, rawCreated any
		if err := rows.Scan(
			&a.ID, &a.BookingTypeID, &a.UserID, &a.GuestName, &a.GuestEmail, &a.GuestNotes,
			&rawStart, &rawEnd, &a.Status, &a.EventID, &rawCreated,
		); err != nil {
			return nil, err
		}
		a.StartAt = parseDBTime(rawStart)
		a.EndAt = parseDBTime(rawEnd)
		a.CreatedAt = parseDBTime(rawCreated)
		list = append(list, a)
	}
	return list, nil
}

func (r *BookingRepositorySQLite) DeleteAppointment(id, userID string) error {
	query := `DELETE FROM booking_appointments WHERE id = ? AND user_id = ?`
	res, err := r.db.Exec(query, id, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("agendamento não encontrado")
	}
	return nil
}

func (r *BookingRepositorySQLite) CheckSlotConflict(userID string, startAt, endAt time.Time, bufferMinutes int) (bool, error) {
	startBuf := startAt.Add(-time.Duration(bufferMinutes) * time.Minute).UTC()
	endBuf := endAt.Add(time.Duration(bufferMinutes) * time.Minute).UTC()

	// 1. Checa conflito na tabela de eventos da agenda pessoal
	eventQuery := `
		SELECT COUNT(*) FROM events
		WHERE user_id = ?
		  AND start_at < ?
		  AND end_at > ?
	`
	var eventCount int
	if err := r.db.QueryRow(eventQuery, userID, endBuf, startBuf).Scan(&eventCount); err != nil {
		return false, err
	}
	if eventCount > 0 {
		return true, nil
	}

	// 2. Checa conflito na tabela de agendamentos de booking ativos
	apptQuery := `
		SELECT COUNT(*) FROM booking_appointments
		WHERE user_id = ?
		  AND status = 'confirmed'
		  AND start_at < ?
		  AND end_at > ?
	`
	var apptCount int
	if err := r.db.QueryRow(apptQuery, userID, endBuf, startBuf).Scan(&apptCount); err != nil {
		return false, err
	}
	return apptCount > 0, nil
}
