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
  conflicting_events: Event[];
  message: string;
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
  intent: string;
  reply: string;
  action_performed: string;
  event?: Event;
  todo?: Todo;
  conflict?: ConflictInfo;
}
