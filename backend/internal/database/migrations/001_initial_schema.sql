-- 001: schema consolidado (estado pos-f25b19b)

	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		token_version INTEGER DEFAULT 1,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);


	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

	CREATE TABLE IF NOT EXISTS events (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL,
		description TEXT,
		location TEXT,
		start_at DATETIME NOT NULL,
		end_at DATETIME NOT NULL,
		source TEXT DEFAULT 'vito',
		category TEXT DEFAULT 'general',
		color TEXT,
		recurrence TEXT,
		reminder_sent_at DATETIME,
		start_reminder_sent_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_events_user_start ON events(user_id, start_at);

	CREATE TABLE IF NOT EXISTS todos (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		priority TEXT NOT NULL DEFAULT 'medium',
		category TEXT NOT NULL DEFAULT 'geral',
		due_date DATETIME,
		remind_at DATETIME,
		remind_repeat TEXT DEFAULT 'none',
		remind_advance INTEGER DEFAULT 0,
		event_id TEXT,
		event_title TEXT,
		reminder_sent_at DATETIME,
		start_reminder_sent_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_todos_user_status ON todos(user_id, status);
	CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(status, due_date);

	CREATE TABLE IF NOT EXISTS memories (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		category TEXT NOT NULL DEFAULT 'general',
		content TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);

	CREATE TABLE IF NOT EXISTS device_tokens (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		token TEXT NOT NULL,
		platform TEXT NOT NULL DEFAULT 'expo',
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_user_token ON device_tokens(user_id, token);
	CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

	CREATE TABLE IF NOT EXISTS calendar_integrations (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		provider TEXT NOT NULL,
		account_email TEXT NOT NULL,
		encrypted_credentials TEXT NOT NULL,
		calendar_id TEXT NOT NULL DEFAULT 'primary',
		calendar_name TEXT,
		sync_token TEXT,
		channel_id TEXT,
		channel_expiration DATETIME,
		status TEXT NOT NULL DEFAULT 'active',
		last_synced_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_integrations_user_prov ON calendar_integrations(user_id, provider, account_email);
	CREATE INDEX IF NOT EXISTS idx_cal_integrations_user ON calendar_integrations(user_id);

	CREATE TABLE IF NOT EXISTS external_event_mappings (
		id TEXT PRIMARY KEY,
		event_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		provider TEXT NOT NULL,
		external_event_id TEXT NOT NULL,
		external_etag TEXT,
		content_hash TEXT NOT NULL,
		last_synced_at DATETIME NOT NULL,
		status TEXT NOT NULL DEFAULT 'synced',
		FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_map_user_prov_ext ON external_event_mappings(user_id, provider, external_event_id);
	CREATE INDEX IF NOT EXISTS idx_ext_map_event_id ON external_event_mappings(event_id);

	CREATE TABLE IF NOT EXISTS calendar_tombstones (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		provider TEXT NOT NULL,
		external_event_id TEXT NOT NULL,
		deleted_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_tombstones_user_prov ON calendar_tombstones(user_id, provider);

	CREATE TABLE IF NOT EXISTS todo_subtasks (
		id TEXT PRIMARY KEY,
		todo_id TEXT NOT NULL,
		title TEXT NOT NULL,
		completed BOOLEAN NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(todo_id) REFERENCES todos(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_todo_subtasks_todo ON todo_subtasks(todo_id);

	CREATE TABLE IF NOT EXISTS triggers (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL,
		category TEXT NOT NULL,
		query TEXT NOT NULL,
		condition_type TEXT NOT NULL DEFAULT 'daily_brief',
		target_value TEXT NOT NULL DEFAULT '',
		current_value TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'active',
		frequency TEXT NOT NULL DEFAULT 'daily_morning',
		scheduled_time TEXT DEFAULT '',
		days_of_week TEXT DEFAULT 'DAILY',
		last_run_status TEXT DEFAULT '',
		last_checked_at DATETIME,
		next_check_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_triggers_user_status ON triggers(user_id, status);
	CREATE INDEX IF NOT EXISTS idx_triggers_user_category ON triggers(user_id, category);

	CREATE TABLE IF NOT EXISTS trigger_logs (
		id TEXT PRIMARY KEY,
		trigger_id TEXT NOT NULL,
		triggered_at DATETIME NOT NULL,
		message TEXT NOT NULL,
		payload TEXT,
		is_read BOOLEAN NOT NULL DEFAULT 0,
		FOREIGN KEY(trigger_id) REFERENCES triggers(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_trigger_logs_trigger ON trigger_logs(trigger_id);

	CREATE TABLE IF NOT EXISTS user_briefing_settings (
		user_id TEXT PRIMARY KEY,
		enabled BOOLEAN NOT NULL DEFAULT 1,
		scheduled_time TEXT NOT NULL DEFAULT '07:30',
		wakeup_alarm_early BOOLEAN NOT NULL DEFAULT 1,
		last_sent_date TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS user_ai_settings (
		user_id TEXT PRIMARY KEY,
		autonomy_mode TEXT NOT NULL DEFAULT 'assisted',
		auto_focus_blocks BOOLEAN NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS pending_items (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL,
		description TEXT,
		category TEXT NOT NULL DEFAULT 'geral',
		status TEXT NOT NULL DEFAULT 'inbox',
		scheduled_date TEXT,
		remind_at DATETIME,
		remind_repeat TEXT DEFAULT 'none',
		remind_advance INTEGER DEFAULT 0,
		nudge_sent_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_pending_items_user_status ON pending_items(user_id, status);
	CREATE INDEX IF NOT EXISTS idx_pending_items_user_date ON pending_items(user_id, scheduled_date);

	CREATE TABLE IF NOT EXISTS booking_types (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		slug TEXT NOT NULL,
		title TEXT NOT NULL,
		description TEXT,
		duration_minutes INTEGER NOT NULL DEFAULT 30,
		buffer_minutes INTEGER NOT NULL DEFAULT 10,
		days_of_week TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
		start_hour TEXT NOT NULL DEFAULT '09:00',
		end_hour TEXT NOT NULL DEFAULT '18:00',
		is_active BOOLEAN NOT NULL DEFAULT 1,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_types_user_slug ON booking_types(user_id, slug);
	CREATE INDEX IF NOT EXISTS idx_booking_types_user ON booking_types(user_id);

	CREATE TABLE IF NOT EXISTS booking_appointments (
		id TEXT PRIMARY KEY,
		booking_type_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		guest_name TEXT NOT NULL,
		guest_email TEXT NOT NULL,
		guest_notes TEXT,
		start_at DATETIME NOT NULL,
		end_at DATETIME NOT NULL,
		status TEXT NOT NULL DEFAULT 'confirmed',
		event_id TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY(booking_type_id) REFERENCES booking_types(id) ON DELETE CASCADE,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE SET NULL
	);

	CREATE INDEX IF NOT EXISTS idx_booking_appts_user_time ON booking_appointments(user_id, start_at, end_at);
	CREATE INDEX IF NOT EXISTS idx_booking_appts_type ON booking_appointments(booking_type_id);

	CREATE TABLE IF NOT EXISTS summary_dispatches (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		summary_type TEXT NOT NULL,
		period_key TEXT NOT NULL,
		dispatched_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE UNIQUE INDEX IF NOT EXISTS idx_summary_dispatch_uniq ON summary_dispatches(user_id, summary_type, period_key);

	CREATE TABLE IF NOT EXISTS chat_sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL,
		preview TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);

	CREATE TABLE IF NOT EXISTS chat_messages (
		id TEXT PRIMARY KEY,
		session_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		sender TEXT NOT NULL,
		text TEXT NOT NULL,
		timestamp DATETIME NOT NULL,
		image_uri TEXT,
		action_performed TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, timestamp ASC);
	CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
	
CREATE INDEX IF NOT EXISTS idx_triggers_worker ON triggers(status, next_check_at);
CREATE INDEX IF NOT EXISTS idx_todos_user_category ON todos(user_id, category);
