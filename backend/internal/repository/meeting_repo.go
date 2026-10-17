package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func parseMeetingDBTime(v any) time.Time {
	switch t := v.(type) {
	case time.Time:
		return t.UTC()
	case string:
		for _, layout := range []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02T15:04:05Z07:00", "2006-01-02 15:04:05.999999999-07:00"} {
			if parsed, err := time.Parse(layout, t); err == nil {
				return parsed.UTC()
			}
		}
	}
	return time.Time{}
}

func meetingTimeVal(t *time.Time) any {
	if t == nil || t.IsZero() {
		return nil
	}
	return t.UTC()
}

// MeetingRepositorySQLite implementa domain.MeetingRepository sobre SQLite.
type MeetingRepositorySQLite struct {
	db *sql.DB
}

// NewMeetingRepositorySQLite instancia o repositório de reuniões.
func NewMeetingRepositorySQLite(db *sql.DB) *MeetingRepositorySQLite {
	return &MeetingRepositorySQLite{db: db}
}

func (r *MeetingRepositorySQLite) Create(ctx context.Context, m *domain.Meeting, slots []domain.MeetingSlot) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UTC()
	if m.CreatedAt.IsZero() {
		m.CreatedAt = now
	}
	if m.UpdatedAt.IsZero() {
		m.UpdatedAt = now
	}
	if m.Status == "" {
		m.Status = domain.MeetingStatusOpen
	}
	if m.Mode == "" {
		m.Mode = domain.MeetingModeOneOnOne
	}
	if m.DurationMinutes <= 0 {
		m.DurationMinutes = 60
	}

	queryMeeting := `
		INSERT INTO meetings (
			id, user_id, title, description, duration_minutes, mode, status,
			short_url, expires_at, confirmed_slot_id, confirmed_slot_start,
			confirmed_slot_end, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = tx.ExecContext(ctx, queryMeeting,
		m.ID, m.UserID, m.Title, m.Description, m.DurationMinutes, m.Mode, m.Status,
		m.ShortURL, m.ExpiresAt.UTC(), m.ConfirmedSlotID, meetingTimeVal(m.ConfirmedSlotStart),
		meetingTimeVal(m.ConfirmedSlotEnd), m.CreatedAt.UTC(), m.UpdatedAt.UTC(),
	)
	if err != nil {
		return err
	}

	if len(slots) > 0 {
		querySlot := `
			INSERT INTO meeting_slots (
				id, meeting_id, start_at, end_at, votes_count, created_at
			) VALUES (?, ?, ?, ?, ?, ?)
		`
		stmt, err := tx.PrepareContext(ctx, querySlot)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, s := range slots {
			createdAt := s.CreatedAt
			if createdAt.IsZero() {
				createdAt = now
			}
			_, err = stmt.ExecContext(ctx, s.ID, m.ID, s.StartAt.UTC(), s.EndAt.UTC(), s.VotesCount, createdAt.UTC())
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func (r *MeetingRepositorySQLite) scanMeeting(scanner interface{ Scan(dest ...any) error }) (*domain.Meeting, error) {
	var m domain.Meeting
	var expAt, crAt, upAt any
	var confSlotStart, confSlotEnd any

	err := scanner.Scan(
		&m.ID, &m.UserID, &m.Title, &m.Description, &m.DurationMinutes,
		&m.Mode, &m.Status, &m.ShortURL, &expAt, &m.ConfirmedSlotID,
		&confSlotStart, &confSlotEnd, &crAt, &upAt,
	)
	if err != nil {
		return nil, err
	}

	m.ExpiresAt = parseMeetingDBTime(expAt)
	m.CreatedAt = parseMeetingDBTime(crAt)
	m.UpdatedAt = parseMeetingDBTime(upAt)

	if confSlotStart != nil {
		t := parseMeetingDBTime(confSlotStart)
		if !t.IsZero() {
			m.ConfirmedSlotStart = &t
		}
	}
	if confSlotEnd != nil {
		t := parseMeetingDBTime(confSlotEnd)
		if !t.IsZero() {
			m.ConfirmedSlotEnd = &t
		}
	}

	return &m, nil
}

func (r *MeetingRepositorySQLite) GetByID(ctx context.Context, id string) (*domain.Meeting, error) {
	query := `
		SELECT id, user_id, title, description, duration_minutes, mode, status,
		       short_url, expires_at, confirmed_slot_id, confirmed_slot_start,
		       confirmed_slot_end, created_at, updated_at
		FROM meetings
		WHERE id = ?
	`
	row := r.db.QueryRowContext(ctx, query, id)
	m, err := r.scanMeeting(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrMeetingNotFound
		}
		return nil, err
	}
	return m, nil
}

func (r *MeetingRepositorySQLite) GetByIDAndUser(ctx context.Context, id, userID string) (*domain.Meeting, error) {
	query := `
		SELECT id, user_id, title, description, duration_minutes, mode, status,
		       short_url, expires_at, confirmed_slot_id, confirmed_slot_start,
		       confirmed_slot_end, created_at, updated_at
		FROM meetings
		WHERE id = ? AND user_id = ?
	`
	row := r.db.QueryRowContext(ctx, query, id, userID)
	m, err := r.scanMeeting(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrMeetingNotFound
		}
		return nil, err
	}
	return m, nil
}

func (r *MeetingRepositorySQLite) ListByUser(ctx context.Context, userID string, status string) ([]domain.Meeting, error) {
	var query string
	var args []any

	if status != "" {
		query = `
			SELECT id, user_id, title, description, duration_minutes, mode, status,
			       short_url, expires_at, confirmed_slot_id, confirmed_slot_start,
			       confirmed_slot_end, created_at, updated_at
			FROM meetings
			WHERE user_id = ? AND status = ?
			ORDER BY created_at DESC
		`
		args = []any{userID, status}
	} else {
		query = `
			SELECT id, user_id, title, description, duration_minutes, mode, status,
			       short_url, expires_at, confirmed_slot_id, confirmed_slot_start,
			       confirmed_slot_end, created_at, updated_at
			FROM meetings
			WHERE user_id = ?
			ORDER BY created_at DESC
		`
		args = []any{userID}
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.Meeting
	for rows.Next() {
		m, err := r.scanMeeting(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *m)
	}
	return list, rows.Err()
}

func (r *MeetingRepositorySQLite) Update(ctx context.Context, m *domain.Meeting) error {
	m.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE meetings SET
			title = ?, description = ?, duration_minutes = ?, mode = ?, status = ?,
			short_url = ?, expires_at = ?, confirmed_slot_id = ?, confirmed_slot_start = ?,
			confirmed_slot_end = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`
	res, err := r.db.ExecContext(ctx, query,
		m.Title, m.Description, m.DurationMinutes, m.Mode, m.Status,
		m.ShortURL, m.ExpiresAt.UTC(), m.ConfirmedSlotID, meetingTimeVal(m.ConfirmedSlotStart),
		meetingTimeVal(m.ConfirmedSlotEnd), m.UpdatedAt.UTC(), m.ID, m.UserID,
	)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrMeetingNotFound
	}
	return nil
}

func (r *MeetingRepositorySQLite) UpdateWithSlots(ctx context.Context, m *domain.Meeting, newSlots []domain.MeetingSlot) error {
	existingSlots, err := r.ListSlots(ctx, m.ID)
	if err != nil {
		return err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	m.UpdatedAt = time.Now().UTC()
	queryUpdate := `
		UPDATE meetings SET
			title = ?, description = ?, duration_minutes = ?, mode = ?, status = ?,
			short_url = ?, expires_at = ?, confirmed_slot_id = ?, confirmed_slot_start = ?,
			confirmed_slot_end = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`
	res, err := tx.ExecContext(ctx, queryUpdate,
		m.Title, m.Description, m.DurationMinutes, m.Mode, m.Status,
		m.ShortURL, m.ExpiresAt.UTC(), m.ConfirmedSlotID, meetingTimeVal(m.ConfirmedSlotStart),
		meetingTimeVal(m.ConfirmedSlotEnd), m.UpdatedAt.UTC(), m.ID, m.UserID,
	)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrMeetingNotFound
	}

	// Mapa de slots existentes por timestamp de início (em segundos UTC) para preservar ID e votos
	existingByStart := make(map[int64]domain.MeetingSlot, len(existingSlots))
	for _, es := range existingSlots {
		existingByStart[es.StartAt.UTC().Unix()] = es
	}

	keptIDs := make(map[string]bool)
	var toInsert []domain.MeetingSlot

	for _, ns := range newSlots {
		startKey := ns.StartAt.UTC().Unix()
		if ex, ok := existingByStart[startKey]; ok {
			keptIDs[ex.ID] = true
			// Atualiza end_at caso a duração tenha mudado
			if _, err := tx.ExecContext(ctx, `UPDATE meeting_slots SET end_at = ? WHERE id = ?`, ns.EndAt.UTC(), ex.ID); err != nil {
				return err
			}
		} else {
			toInsert = append(toInsert, ns)
		}
	}

	// Remove slots que não estão mais na lista (e seus votos)
	for _, es := range existingSlots {
		if !keptIDs[es.ID] {
			if _, err := tx.ExecContext(ctx, `DELETE FROM meeting_votes WHERE slot_id = ?`, es.ID); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `DELETE FROM meeting_slots WHERE id = ?`, es.ID); err != nil {
				return err
			}
		}
	}

	// Insere novos slots
	if len(toInsert) > 0 {
		queryInsert := `
			INSERT INTO meeting_slots (
				id, meeting_id, start_at, end_at, votes_count, created_at
			) VALUES (?, ?, ?, ?, ?, ?)
		`
		stmt, err := tx.PrepareContext(ctx, queryInsert)
		if err != nil {
			return err
		}
		defer stmt.Close()

		now := time.Now().UTC()
		for _, s := range toInsert {
			createdAt := s.CreatedAt
			if createdAt.IsZero() {
				createdAt = now
			}
			if _, err := stmt.ExecContext(ctx, s.ID, m.ID, s.StartAt.UTC(), s.EndAt.UTC(), 0, createdAt.UTC()); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func (r *MeetingRepositorySQLite) Delete(ctx context.Context, id, userID string) error {
	query := `DELETE FROM meetings WHERE id = ? AND user_id = ?`
	res, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrMeetingNotFound
	}
	return nil
}

func (r *MeetingRepositorySQLite) ListSlots(ctx context.Context, meetingID string) ([]domain.MeetingSlot, error) {
	query := `
		SELECT id, meeting_id, start_at, end_at, votes_count, created_at
		FROM meeting_slots
		WHERE meeting_id = ?
		ORDER BY start_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query, meetingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slots []domain.MeetingSlot
	for rows.Next() {
		var s domain.MeetingSlot
		var st, et, ct any
		if err := rows.Scan(&s.ID, &s.MeetingID, &st, &et, &s.VotesCount, &ct); err != nil {
			return nil, err
		}
		s.StartAt = parseMeetingDBTime(st)
		s.EndAt = parseMeetingDBTime(et)
		s.CreatedAt = parseMeetingDBTime(ct)
		slots = append(slots, s)
	}
	return slots, rows.Err()
}

func (r *MeetingRepositorySQLite) GetSlotByID(ctx context.Context, slotID string) (*domain.MeetingSlot, error) {
	query := `
		SELECT id, meeting_id, start_at, end_at, votes_count, created_at
		FROM meeting_slots
		WHERE id = ?
	`
	var s domain.MeetingSlot
	var st, et, ct any
	err := r.db.QueryRowContext(ctx, query, slotID).Scan(&s.ID, &s.MeetingID, &st, &et, &s.VotesCount, &ct)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrMeetingSlotNotFound
		}
		return nil, err
	}
	s.StartAt = parseMeetingDBTime(st)
	s.EndAt = parseMeetingDBTime(et)
	s.CreatedAt = parseMeetingDBTime(ct)
	return &s, nil
}

func (r *MeetingRepositorySQLite) AddParticipant(ctx context.Context, p *domain.MeetingParticipant) error {
	now := time.Now().UTC()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	if p.RespondedAt.IsZero() {
		p.RespondedAt = now
	}
	query := `
		INSERT INTO meeting_participants (
			id, meeting_id, name, contact_info, vito_user_id, responded_at, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query,
		p.ID, p.MeetingID, p.Name, p.ContactInfo, p.VitoUserID,
		p.RespondedAt.UTC(), p.CreatedAt.UTC(),
	)
	return err
}

func (r *MeetingRepositorySQLite) ListParticipants(ctx context.Context, meetingID string) ([]domain.MeetingParticipant, error) {
	query := `
		SELECT id, meeting_id, name, contact_info, vito_user_id, responded_at, created_at
		FROM meeting_participants
		WHERE meeting_id = ?
		ORDER BY responded_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query, meetingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var parts []domain.MeetingParticipant
	for rows.Next() {
		var p domain.MeetingParticipant
		var respAt, crAt any
		if err := rows.Scan(&p.ID, &p.MeetingID, &p.Name, &p.ContactInfo, &p.VitoUserID, &respAt, &crAt); err != nil {
			return nil, err
		}
		p.RespondedAt = parseMeetingDBTime(respAt)
		p.CreatedAt = parseMeetingDBTime(crAt)
		parts = append(parts, p)
	}
	return parts, rows.Err()
}

func (r *MeetingRepositorySQLite) RecordVote(ctx context.Context, vote *domain.MeetingVote) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UTC()
	if vote.CreatedAt.IsZero() {
		vote.CreatedAt = now
	}

	queryVote := `
		INSERT INTO meeting_votes (id, meeting_id, slot_id, participant_id, created_at)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err = tx.ExecContext(ctx, queryVote, vote.ID, vote.MeetingID, vote.SlotID, vote.ParticipantID, vote.CreatedAt.UTC())
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return domain.ErrParticipantAlreadyVoted
		}
		return err
	}

	// Incrementa votes_count no slot
	querySlot := `UPDATE meeting_slots SET votes_count = votes_count + 1 WHERE id = ?`
	_, err = tx.ExecContext(ctx, querySlot, vote.SlotID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *MeetingRepositorySQLite) ListVotesByMeeting(ctx context.Context, meetingID string) ([]domain.MeetingVote, error) {
	query := `
		SELECT id, meeting_id, slot_id, participant_id, created_at
		FROM meeting_votes
		WHERE meeting_id = ?
		ORDER BY created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query, meetingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var votes []domain.MeetingVote
	for rows.Next() {
		var v domain.MeetingVote
		var crAt any
		if err := rows.Scan(&v.ID, &v.MeetingID, &v.SlotID, &v.ParticipantID, &crAt); err != nil {
			return nil, err
		}
		v.CreatedAt = parseMeetingDBTime(crAt)
		votes = append(votes, v)
	}
	return votes, rows.Err()
}

func (r *MeetingRepositorySQLite) ConfirmMeetingSlot(ctx context.Context, meetingID, slotID string, startAt, endAt time.Time) error {
	now := time.Now().UTC()
	query := `
		UPDATE meetings SET
			status = ?,
			confirmed_slot_id = ?,
			confirmed_slot_start = ?,
			confirmed_slot_end = ?,
			updated_at = ?
		WHERE id = ?
	`
	res, err := r.db.ExecContext(ctx, query,
		domain.MeetingStatusConfirmed, slotID, startAt.UTC(), endAt.UTC(), now, meetingID,
	)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrMeetingNotFound
	}
	return nil
}

func (r *MeetingRepositorySQLite) FindParticipant(ctx context.Context, meetingID, participantID, contactInfo, name string) (*domain.MeetingParticipant, error) {
	participantID = strings.TrimSpace(participantID)
	contactInfo = strings.TrimSpace(contactInfo)
	name = strings.TrimSpace(name)

	var query string
	var args []interface{}

	if participantID != "" {
		query = `
			SELECT id, meeting_id, name, contact_info, vito_user_id, responded_at, created_at
			FROM meeting_participants
			WHERE meeting_id = ? AND id = ?
			LIMIT 1
		`
		args = []interface{}{meetingID, participantID}
	} else if contactInfo != "" {
		query = `
			SELECT id, meeting_id, name, contact_info, vito_user_id, responded_at, created_at
			FROM meeting_participants
			WHERE meeting_id = ? AND LOWER(TRIM(contact_info)) = LOWER(?)
			LIMIT 1
		`
		args = []interface{}{meetingID, contactInfo}
	} else if name != "" {
		query = `
			SELECT id, meeting_id, name, contact_info, vito_user_id, responded_at, created_at
			FROM meeting_participants
			WHERE meeting_id = ? AND LOWER(TRIM(name)) = LOWER(?)
			LIMIT 1
		`
		args = []interface{}{meetingID, name}
	} else {
		return nil, nil
	}

	var p domain.MeetingParticipant
	var respAt, crAt any
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&p.ID, &p.MeetingID, &p.Name, &p.ContactInfo, &p.VitoUserID, &respAt, &crAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	p.RespondedAt = parseMeetingDBTime(respAt)
	p.CreatedAt = parseMeetingDBTime(crAt)
	return &p, nil
}

func (r *MeetingRepositorySQLite) ReplaceParticipantVotes(ctx context.Context, meetingID, participantID, name, contactInfo string, newSlotIDs []string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UTC()

	// 1. Atualiza dados do participante e data de resposta
	updatePartQuery := `
		UPDATE meeting_participants
		SET name = ?, contact_info = ?, responded_at = ?
		WHERE id = ? AND meeting_id = ?
	`
	if _, err := tx.ExecContext(ctx, updatePartQuery, name, contactInfo, now, participantID, meetingID); err != nil {
		return fmt.Errorf("falha ao atualizar participante: %w", err)
	}

	// 2. Localiza os slots em que o participante havia votado anteriormente
	oldSlotsQuery := `
		SELECT slot_id FROM meeting_votes
		WHERE participant_id = ? AND meeting_id = ?
	`
	rows, err := tx.QueryContext(ctx, oldSlotsQuery, participantID, meetingID)
	if err != nil {
		return fmt.Errorf("falha ao buscar votos anteriores: %w", err)
	}
	var oldSlotIDs []string
	for rows.Next() {
		var sID string
		if err := rows.Scan(&sID); err == nil {
			oldSlotIDs = append(oldSlotIDs, sID)
		}
	}
	rows.Close()

	// 3. Decrementa votes_count nos slots antigos
	for _, oldID := range oldSlotIDs {
		decQuery := `UPDATE meeting_slots SET votes_count = MAX(0, votes_count - 1) WHERE id = ?`
		if _, err := tx.ExecContext(ctx, decQuery, oldID); err != nil {
			return fmt.Errorf("falha ao decrementar slot antigo %s: %w", oldID, err)
		}
	}

	// 4. Remove os votos antigos
	delVotesQuery := `DELETE FROM meeting_votes WHERE participant_id = ? AND meeting_id = ?`
	if _, err := tx.ExecContext(ctx, delVotesQuery, participantID, meetingID); err != nil {
		return fmt.Errorf("falha ao limpar votos antigos: %w", err)
	}

	// 5. Insere os novos votos e incrementa os novos slots
	for _, newSlotID := range newSlotIDs {
		voteID := uuid.New().String()
		insQuery := `
			INSERT INTO meeting_votes (id, meeting_id, slot_id, participant_id, created_at)
			VALUES (?, ?, ?, ?, ?)
		`
		if _, err := tx.ExecContext(ctx, insQuery, voteID, meetingID, newSlotID, participantID, now); err != nil {
			return fmt.Errorf("falha ao inserir novo voto no slot %s: %w", newSlotID, err)
		}

		incQuery := `UPDATE meeting_slots SET votes_count = votes_count + 1 WHERE id = ?`
		if _, err := tx.ExecContext(ctx, incQuery, newSlotID); err != nil {
			return fmt.Errorf("falha ao incrementar novo slot %s: %w", newSlotID, err)
		}
	}

	return tx.Commit()
}
