export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
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
  created_at: string;
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
  status: 'pending' | 'completed';
  due_date?: string;
  event_id?: string;
  event_title?: string;
  subtasks?: Subtask[];
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
  trigger?: Trigger;
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
  trigger?: Trigger;
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

export type NotificationPriority = 'silent' | 'default';

export type NotificationChannelId = 'vito_silent' | 'vito_default';

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

export type TriggerCategory =
  | 'finance'
  | 'taxes_docs'
  | 'real_estate'
  | 'automotive'
  | 'career'
  | 'news'
  | 'tech'
  | 'travel'
  | 'shopping'
  | 'events_sports'
  | 'entertainment'
  | 'weather'
  | 'custom';

export type TriggerStatus = 'active' | 'paused' | 'triggered';

export type TriggerConditionType =
  | 'price_above'
  | 'price_below'
  | 'event_upcoming'
  | 'daily_brief'
  | 'change_detected';

export type TriggerFrequency =
  | 'daily_morning'
  | 'daily_evening'
  | 'hourly'
  | 'immediate';

export interface Trigger {
  id: string;
  user_id: string;
  title: string;
  category: TriggerCategory;
  query: string;
  condition_type: TriggerConditionType;
  target_value: string;
  current_value: string;
  status: TriggerStatus;
  frequency: TriggerFrequency;
  last_checked_at?: string;
  next_check_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TriggerLog {
  id: string;
  trigger_id: string;
  triggered_at: string;
  message: string;
  payload?: string;
  is_read: boolean;
}

export interface CreateTriggerInput {
  title: string;
  category: TriggerCategory;
  query: string;
  condition_type?: TriggerConditionType;
  target_value?: string;
  frequency?: TriggerFrequency;
}

export interface CategoryMeta {
  id: TriggerCategory;
  label: string;
  icon: string; // MaterialIcons name
  colorLight: string;
  colorDark: string;
  bgLight: string;
  bgDark: string;
  placeholder: string;
}

export const TRIGGER_CATEGORIES: CategoryMeta[] = [
  {
    id: 'finance',
    label: 'Finanças',
    icon: 'trending-up',
    colorLight: '#059669',
    colorDark: '#34D399',
    bgLight: '#ECFDF5',
    bgDark: '#064E3B',
    placeholder: 'Ex: Ações da PETR3 acima de R$ 35',
  },
  {
    id: 'taxes_docs',
    label: 'Tributos & Docs',
    icon: 'receipt-long',
    colorLight: '#D97706',
    colorDark: '#FBBF24',
    bgLight: '#FFFBEB',
    bgDark: '#78350F',
    placeholder: 'Ex: Lote da restituição do IRPF',
  },
  {
    id: 'real_estate',
    label: 'Imóveis',
    icon: 'apartment',
    colorLight: '#2563EB',
    colorDark: '#60A5FA',
    bgLight: '#EFF6FF',
    bgDark: '#1E3A8A',
    placeholder: 'Ex: Apê no Pinheiros até R$ 4.500',
  },
  {
    id: 'automotive',
    label: 'Veículos',
    icon: 'directions-car',
    colorLight: '#4B5563',
    colorDark: '#9CA3AF',
    bgLight: '#F3F4F6',
    bgDark: '#1F2937',
    placeholder: 'Ex: FIPE do Corolla ou preço de combustível',
  },
  {
    id: 'career',
    label: 'Carreira & Vagas',
    icon: 'work-outline',
    colorLight: '#7C3AED',
    colorDark: '#A78BFA',
    bgLight: '#F5F3FF',
    bgDark: '#4C1D95',
    placeholder: 'Ex: Vagas de Tech Lead ou concurso BACEN',
  },
  {
    id: 'news',
    label: 'Notícias & Setor',
    icon: 'newspaper',
    colorLight: '#0284C7',
    colorDark: '#38BDF8',
    bgLight: '#F0F9FF',
    bgDark: '#0C4A6E',
    placeholder: 'Ex: Notícias sobre IA e geopolítica',
  },
  {
    id: 'tech',
    label: 'Tecnologia',
    icon: 'devices',
    colorLight: '#4F46E5',
    colorDark: '#818CF8',
    bgLight: '#EEF2FF',
    bgDark: '#312E81',
    placeholder: 'Ex: Rumores do iPhone 17 ou update Expo',
  },
  {
    id: 'travel',
    label: 'Viagens',
    icon: 'flight-takeoff',
    colorLight: '#0891B2',
    colorDark: '#22D3EE',
    bgLight: '#ECFEFF',
    bgDark: '#164E63',
    placeholder: 'Ex: Passagem GRU -> JFK abaixo de R$ 3.000',
  },
  {
    id: 'shopping',
    label: 'Compras',
    icon: 'shopping-bag',
    colorLight: '#EA580C',
    colorDark: '#FB923C',
    bgLight: '#FFF7ED',
    bgDark: '#7C2D12',
    placeholder: 'Ex: MacBook Air M3 abaixo de R$ 7.500',
  },
  {
    id: 'events_sports',
    label: 'Eventos & Jogos',
    icon: 'sports-soccer',
    colorLight: '#DC2626',
    colorDark: '#F87171',
    bgLight: '#FEF2F2',
    bgDark: '#7F1D1D',
    placeholder: 'Ex: Próximo jogo do Flamengo ou show Oasis',
  },
  {
    id: 'entertainment',
    label: 'Entretenimento',
    icon: 'movie',
    colorLight: '#9333EA',
    colorDark: '#C084FC',
    bgLight: '#FAF5FF',
    bgDark: '#581C87',
    placeholder: 'Ex: Nova temporada na Netflix ou filme IMAX',
  },
  {
    id: 'weather',
    label: 'Clima & Alertas',
    icon: 'wb-sunny',
    colorLight: '#CA8A04',
    colorDark: '#FACC15',
    bgLight: '#FEFCE8',
    bgDark: '#713F12',
    placeholder: 'Ex: Alerta de tempestade para sábado',
  },
  {
    id: 'custom',
    label: 'Personalizado',
    icon: 'tune',
    colorLight: '#6B7280',
    colorDark: '#D1D5DB',
    bgLight: '#F9FAFB',
    bgDark: '#111827',
    placeholder: 'Ex: Qualquer outro monitoramento que você queira',
  },
];



