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
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color?: string;
  category?: string;
  source?: 'vito' | 'google' | 'apple';
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Trigger {
  id: string;
  title: string;
  category: string;
  frequency: string;
  status: 'active' | 'paused' | 'failed';
  last_evaluated_at?: string;
  last_report?: {
    id: string;
    summary: string;
    findings?: string[];
    created_at: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  actions?: Array<{
    type: string;
    payload: any;
  }>;
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
