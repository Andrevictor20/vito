-- 009: módulo de reuniões (coordenação externa via link mágico e whatsapp).
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    mode TEXT NOT NULL DEFAULT 'one_on_one', -- 'one_on_one', 'group_consensus'
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'confirmed', 'expired', 'cancelled'
    short_url TEXT,
    expires_at DATETIME NOT NULL,
    confirmed_slot_id TEXT,
    confirmed_slot_start DATETIME,
    confirmed_slot_end DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meetings_user_status ON meetings(user_id, status);

CREATE TABLE IF NOT EXISTS meeting_slots (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    votes_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_slots_meeting ON meeting_slots(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_participants (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_info TEXT,
    vito_user_id TEXT,
    responded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY(vito_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_votes (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slot_id, participant_id),
    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY(slot_id) REFERENCES meeting_slots(id) ON DELETE CASCADE,
    FOREIGN KEY(participant_id) REFERENCES meeting_participants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_votes_slot ON meeting_votes(slot_id);
