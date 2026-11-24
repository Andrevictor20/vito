import type { ProtoUiIconName } from "../icons/ProtoUiIcons";
import type { Trigger } from "./triggers";
import type { Meeting, MeetingWithDetails } from "./booking";

export type VitoIconName = ProtoUiIconName;

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface AuthResponse {
  token: string;
  access_token?: string;
  refresh_token?: string;
  session_id?: string;
  expires_in?: number;
  user: User;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_name: string;
  ip_address: string;
  expires_at: string;
  revoked_at?: string;
  created_at: string;
  last_used_at: string;
  is_current: boolean;
}

export interface TimeSlot {
  start_at: string;
  end_at: string;
  label: string;
}

export interface ConflictInfo {
  has_conflict: boolean;
  conflicting_id?: string;
  conflicting_title?: string;
  message?: string;
  suggested_slots?: TimeSlot[];
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
  source?: string;
  category?: string;
  color?: string;
  recurrence?: string;
  is_recurring?: boolean;
  critical_alarm?: boolean;
  wake_offset_minutes?: number;
  created_at: string;
  updated_at?: string;
}

export interface Subtask {
  id: string;
  todo_id: string;
  title: string;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  status: 'pending' | 'completed';
  due_date?: string;
  remind_at?: string;
  remind_repeat?: 'none' | 'daily' | 'weekly';
  remind_advance_minutes?: number;
  event_id?: string;
  event_title?: string;
  subtasks?: Subtask[];
  created_at: string;
  updated_at?: string;
}

export interface ParsedIntent {
  intent: 'create_event' | 'create_todo' | 'query_calendar' | 'query_todos' | 'general_chat';
  confidence: number;
  event?: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    end_at: string;
  };
  todo?: {
    title: string;
    priority: 'low' | 'medium' | 'high';
    due_date?: string;
  };
  reply_message: string;
}

export interface ChatBooking {
  id: string;
  title: string;
  slug?: string;
  duration_minutes?: number;
  start_hour?: string;
  end_hour?: string;
  days_of_week?: string;
  public_url?: string;
  short_url?: string;
}

export interface ChatMeeting {
  id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  mode: 'one_on_one' | 'group_consensus';
  status: string;
  short_url?: string;
  public_url?: string;
  whatsapp_url?: string;
  slots_count?: number;
}

export interface DestructiveConfirmation {
  action_type: string;
  target_title: string;
  impact_count: number;
  description: string;
  confirm_prompt: string;
}

export interface ChatCardPayload {
  id?: string;
  type?: string;
  title?: string;
  subtitle?: string;
  action_label?: string;
  action_value?: string;
  confirm?: boolean;
  dismiss?: boolean;
}

export interface AssistantChatResponse {
  action?: string;
  intent: string;
  message?: string;
  reply: string;
  transcript?: string;
  action_performed?: string;
  event?: Event;
  todo?: Todo;
  trigger?: Trigger;
  pending?: PendingItem;
  booking?: ChatBooking;
  booking_url?: string;
  booking_short_url?: string;
  meeting?: MeetingWithDetails | Meeting;
  meeting_url?: string;
  meeting_short_url?: string;
  meeting_whatsapp_url?: string;
  conflict?: ConflictInfo;
  requires_confirmation?: boolean;
  pending_confirmation_id?: string;
  pending_confirmation?: DestructiveConfirmation;
  provider_used?: string;
  model_used?: string;
  byok_warning?: string;
  telemetry?: {
    provider_used?: string;
    model_used?: string;
    credential_source?: string;
    fallback_reason?: string;
  };
  reasoning?: string[];
  tool_calls?: Array<{
    tool?: string;
    operation?: string;
    status?: string;
  }>;
  whatsapp_message?: ChatWhatsAppMessage;
  gmail_message?: ChatGmailMessage;
  tts_audio_b64?: string;
  tts_audio_mime?: string;
  cards?: ChatCardPayload[];
  actions?: ChatCardPayload[];
}

export interface ChatWhatsAppMessage {
  id?: string;
  recipient_name: string;
  recipient_phone?: string;
  recipient_photo?: string;
  message: string;
  status?: 'draft' | 'ready' | 'sent' | 'cancelled';
  sent_at?: string;
}

export interface ChatGmailMessage {
  id?: string;
  recipient_name?: string;
  recipient_email: string;
  subject: string;
  body: string;
  status?: 'draft' | 'ready' | 'sent' | 'cancelled';
  sent_at?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'vito';
  text: string;
  timestamp: string;
  imageUri?: string;
  action_performed?: string;
  event?: Event;
  todo?: Todo;
  trigger?: Trigger;
  pending?: PendingItem;
  booking?: ChatBooking;
  meeting?: ChatMeeting;
  conflict?: ConflictInfo;
  requires_confirmation?: boolean;
  pending_confirmation_id?: string;
  cards?: ChatCardPayload[];
  confirmationStatus?: 'pending' | 'confirmed' | 'cancelled';
  pending_confirmation?: DestructiveConfirmation;
  whatsapp_message?: ChatWhatsAppMessage;
  gmail_message?: ChatGmailMessage;
  thinkingSteps?: string[];
  modelUsed?: string;
  byokWarning?: string;
}

export interface ConversationSession {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  messages: ChatMessage[];
  active?: boolean;
  pinned?: boolean;
  model_pref?: string;
  effort_pref?: string;
}

export type NotificationPriority = 'silent' | 'default';

export type NotificationChannelId = 'vito_silent' | 'vito_default';

export interface NotificationSettings {
  enabled: boolean;
  defaultPriority: NotificationPriority;
  reminderMinutesBefore: number;
  pushToken?: string;
}

export interface MorningBriefingSettings {
  user_id?: string;
  enabled: boolean;
  scheduled_time: string; // ex: "07:30"
  wakeup_alarm_early: boolean;
  last_sent_date?: string;
}

export interface ScheduleNotificationParams {
  id?: string;
  eventId?: string;
  todoId?: string;
  title: string;
  body: string;
  triggerDate: Date;
  priority?: NotificationPriority;
}


export type AutonomyMode = 'assisted' | 'proactive' | 'low' | 'autonomous';

export interface AISettings {
  user_id: string;
  autonomy_mode: AutonomyMode;
  auto_focus_blocks: boolean;
  persona_style?: 'balanced' | 'direct' | 'warm' | 'professional' | 'relaxed' | string;
  preferred_voice?: string;
  created_at: string;
  updated_at: string;
}

export type PendingStatus = 'inbox' | 'scheduled' | 'done';

export interface PendingItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: string;
  status: PendingStatus;
  scheduled_date?: string;
  remind_at?: string;
  remind_repeat?: 'none' | 'daily' | 'weekly';
  remind_advance_minutes?: number;
  nudge_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePendingInput {
  title: string;
  description?: string;
  category?: string;
  scheduled_date?: string;
  remind_at?: string;
  remind_repeat?: 'none' | 'daily' | 'weekly';
  remind_advance_minutes?: number;
}

export interface UpdatePendingInput {
  title?: string;
  description?: string;
  category?: string;
  status?: PendingStatus;
  scheduled_date?: string;
  remind_at?: string | null;
  remind_repeat?: 'none' | 'daily' | 'weekly';
  remind_advance_minutes?: number;
}
