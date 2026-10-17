package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

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
