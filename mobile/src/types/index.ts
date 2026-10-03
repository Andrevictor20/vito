export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ConflictInfo {
  has_conflict: boolean;
  conflicting_id?: string;
  conflicting_title?: string;
  message?: string;
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
  created_at: string;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  due_date?: string;
  created_at: string;
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

export interface AssistantChatResponse {
  action?: string;
  intent: string;
  message?: string;
  reply: string;
  transcript?: string;
  action_performed?: string;
  event?: Event;
  todo?: Todo;
  conflict?: ConflictInfo;
  provider_used?: string;
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
  conflict?: ConflictInfo;
}

export interface ConversationSession {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  messages: ChatMessage[];
  active?: boolean;
}

export type NotificationPriority = 'silent' | 'default' | 'wakeup';

export type NotificationChannelId = 'vito_silent' | 'vito_default' | 'vito_wakeup';

export interface NotificationSettings {
  enabled: boolean;
  defaultPriority: NotificationPriority;
  reminderMinutesBefore: number;
  pushToken?: string;
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


