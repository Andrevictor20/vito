export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  ai_autonomy_mode?: 'assisted' | 'proactive';
  created_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  session_id?: string;
  user: User;
}

export interface SessionDevice {
  id: string;
  device_name: string;
  ip_address: string;
  last_used_at: string;
  created_at: string;
  is_current: boolean;
}

export interface CalendarEvent {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  color?: string;
  category?: string;
  source?: 'vito' | 'google' | 'apple';
}

export interface Subtask {
  id: string;
  todo_id?: string;
  title: string;
  completed: boolean;
}

export interface Todo {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  completed?: boolean;
  status: 'pending' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  due_date?: string;
  remind_at?: string;
  subtasks?: Subtask[];
  created_at?: string;
  updated_at?: string;
}

export interface TriggerReport {
  id?: string;
  summary: string;
  relevance?: number;
  tested_at?: string;
  paragraphs?: string[];
  why_relevant?: string;
  condition_met?: boolean;
  findings?: string[];
  created_at?: string;
}

export interface Trigger {
  id: string;
  user_id?: string;
  title: string;
  category: string;
  query?: string;
  frequency: string;
  status: 'active' | 'paused' | 'triggered' | 'failed';
  scheduled_time?: string;
  last_checked_at?: string;
  next_check_at?: string;
  last_evaluated_at?: string;
  last_report?: TriggerReport;
  created_at?: string;
  updated_at?: string;
}

export interface TriggerLog {
  id: string;
  trigger_id: string;
  triggered_at: string;
  message: string;
  payload?: string;
  is_read?: boolean;
}

export interface BookingType {
  id: string;
  user_id?: string;
  slug: string;
  title: string;
  description?: string;
  duration_minutes: number;
  buffer_minutes?: number;
  days_of_week?: string;
  start_hour?: string;
  end_hour?: string;
  is_active: boolean;
  public_url?: string;
  short_url?: string;
  created_at?: string;
}

export interface MeetingSlot {
  id: string;
  meeting_id?: string;
  start_at: string;
  end_at: string;
  votes_count?: number;
  is_winner?: boolean;
}

export interface Meeting {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  duration_minutes: number;
  mode: 'one_on_one' | 'group_consensus';
  status: 'open' | 'confirmed' | 'expired' | 'cancelled';
  short_url?: string;
  public_url?: string;
  confirmed_slot_start?: string;
  confirmed_slot_end?: string;
  slots_count?: number;
  slots?: MeetingSlot[];
  participants_count?: number;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'vito';
  text: string;
  timestamp: string;
  role?: 'user' | 'assistant' | 'system';
  content?: string;
  created_at?: string;
  event?: CalendarEvent;
  todo?: Todo;
  trigger?: Trigger;
  booking?: BookingType;
  meeting?: Meeting;
}

export interface ConversationSession {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  messages?: ChatMessage[];
  active?: boolean;
  pinned?: boolean;
}

export interface WhatsAppStatus {
  connected: boolean;
  status: string;
  phone?: string;
  instance_name?: string;
}

export interface GmailStatus {
  connected: boolean;
  email?: string;
  last_scanned_at?: string;
}
