import type { VitoIconName } from "./core";

export type TriggerCategory =
  | 'finance'
  | 'taxes_docs'
  | 'real_estate'
  | 'automotive'
  | 'career'
  | 'public_exams'
  | 'news'
  | 'tech'
  | 'travel'
  | 'shopping'
  | 'events_sports'
  | 'entertainment'
  | 'weather'
  | 'custom';

export interface TriggerTemplate {
  id: string;
  title: string;
  description: string;
  category: TriggerCategory;
  area: string;
  icon: string;
  connectors: string[];
  query: string;
  user_intent: string;
  search_keywords?: string;
  condition_type: TriggerConditionType;
  target_value: string;
  frequency: TriggerFrequency;
  scheduled_time?: string;
}

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
  scheduled_time?: string;
  days_of_week?: string;
  last_run_status?: string;
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

export interface TriggerTestResult {
  trigger_id: string;
  title: string;
  query: string;
  condition_met: boolean;
  current_data: string;
  summary: string;
  paragraphs?: string[];
  simulated_notification: string;
  tested_at: string;
}

export interface TriggerReportPayload {
  status?: string;
  condition_met?: boolean;
  data?: string;
  paragraphs?: string[];
  summary?: string;
  simulated_notification?: string;
  confidence?: number;
  why_relevant?: string;
  urgency?: string;
  tested_at?: string;
  last_error?: string;
}

export interface CreateTriggerInput {
  title: string;
  category: TriggerCategory;
  query: string;
  condition_type?: TriggerConditionType;
  target_value?: string;
  frequency?: TriggerFrequency;
  scheduled_time?: string;
  days_of_week?: string;
}

export interface UpdateTriggerInput {
  title?: string;
  category?: TriggerCategory;
  query?: string;
  condition_type?: TriggerConditionType;
  target_value?: string;
  frequency?: TriggerFrequency;
  status?: TriggerStatus;
  scheduled_time?: string;
  days_of_week?: string;
}

export interface CategoryMeta {
  id: TriggerCategory;
  label: string;
  icon: VitoIconName;
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
    placeholder: 'Ex: Vagas de Tech Lead ou dev sênior',
  },
  {
    id: 'public_exams',
    label: 'Concursos Públicos',
    icon: 'gavel',
    colorLight: '#B45309',
    colorDark: '#FBBF24',
    bgLight: '#FFFBEB',
    bgDark: '#78350F',
    placeholder: 'Ex: Edital Receita Federal, BACEN ou tribunais',
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