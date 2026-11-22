export type ActionPolicy = 'auto' | 'ask' | 'off';

export type BotAnimState = 'idle' | 'thinking' | 'happy' | 'surprised' | 'sleeping';

export interface BotSkin {
  preset?: string;
  fill?: string;
  stroke?: string;
  eyes?: string;
  bowtie?: string;
  hat?: string;
  band?: string;
}

export interface BotAction {
  id?: string;
  bot_id?: string;
  action_key: string;
  app_key: string;
  label: string;
  description?: string;
  is_write?: boolean;
  always_ask?: boolean;
  policy: ActionPolicy;
  app_connected?: boolean;
  config_json?: string;
}

export interface BotSkill {
  id?: string;
  bot_id?: string;
  skill_key: string;
  name: string;
  icon?: string;
  description?: string;
  when?: string;
  steps?: string[];
  actions?: string[];
  version: number;
  latest_version?: number;
  has_upgrade?: boolean;
  upgrade_new_actions?: string[];
}

export interface BotMemory {
  id: string;
  bot_id: string;
  content: string;
  source: 'chat' | 'auto';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface BotPendingConfirmation {
  confirmation_id: string;
  action_key: string;
  app_key?: string;
  label: string;
  summary: string;
  always_ask?: boolean;
  created_at?: string;
}

export interface BotRunReport {
  summary: string;
  verified: string[];
  did: string[];
  waiting: string[];
  cant: string[];
  pending_confirmation_ids?: string[];
  model_used?: string;
  ok_silent?: boolean;
}

export interface BotRunLog {
  id: string;
  bot_id: string;
  triggered_at: string;
  message: string;
  payload?: string;
  report?: BotRunReport;
  status?: 'ok' | 'ok_silent' | 'waiting' | 'error';
  model_used?: string;
}

export interface BotChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  model_used?: string;
  chips?: string[];
  proposal?: {
    kind: string;
    label: string;
    payload?: Record<string, unknown>;
    status?: 'pending' | 'accepted' | 'dismissed';
  };
  pending_confirmations?: BotPendingConfirmation[];
}

export interface BotTriggerRule {
  kind: 'schedule' | 'delta' | 'price' | 'event';
  label: string;
  cron?: string;
}

export interface Bot {
  id: string;
  user_id?: string;
  title: string;
  goal: string;
  category: string;
  icon?: string;
  color?: string;
  status: 'active' | 'paused' | 'triggered' | 'failed';
  frequency?: string;
  scheduled_time?: string;
  quiet_only_on_change: boolean;
  consecutive_failures?: number;
  model_pref?: string;
  effort_pref?: string;
  template_key?: string;
  skin_json?: string;
  skin?: BotSkin;
  rules?: string[];
  rules_json?: string;
  triggers?: BotTriggerRule[];
  actions?: BotAction[];
  skills?: BotSkill[];
  pending?: BotPendingConfirmation[];
  apps?: BotAppStatus[];
  actions_summary?: { total: number; auto: number; ask: number; locked: number };
  last?: { summary: string; at?: string; status?: string };
  logs?: BotRunLog[];
  last_checked_at?: string;
  next_check_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BotTemplate {
  key: string;
  version: number;
  name: string;
  category: string;
  goal: string;
  icon: string;
  color: string;
  skills: string[];
  actions?: string[];
  default_triggers: BotTriggerRule[];
  default_rules: string[];
  setup_questions?: string[];
}

export interface SkillPackage {
  key: string;
  version: number;
  name: string;
  icon: string;
  description: string;
  when: string;
  steps: string[];
  actions: string[];
  output_contract?: string;
}

export interface BotAppStatus {
  app_key: string;
  name: string;
  connected: boolean;
  icon?: string;
  description?: string;
}

export interface BotActivityItem {
  id: string;
  bot_id: string;
  bot_title: string;
  summary: string;
  status?: string;
  model_used?: string;
  created_at: string;
}

export interface ActionCatalogEntry {
  action_key: string;
  app_key: string;
  app_name: string;
  label: string;
  description: string;
  is_write: boolean;
  always_ask: boolean;
  default_policy: ActionPolicy;
}

/** Ações que nunca podem receber política 'auto' (AC-03). */
export const ALWAYS_ASK_ACTION_KEYS = new Set<string>(['wasend']);

export function isAlwaysAskAction(actionKey: string, alwaysAskFlag?: boolean): boolean {
  return Boolean(alwaysAskFlag) || ALWAYS_ASK_ACTION_KEYS.has(actionKey);
}

export const ACTION_CATALOG: ActionCatalogEntry[] = [
  { action_key: 'notify', app_key: 'vito', app_name: 'Vito', label: 'Avisar você', description: 'Push e mensagem no chat do bot', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'task', app_key: 'vito', app_name: 'Vito', label: 'Criar tarefa', description: 'Adiciona tarefa em Tarefas & Foco', is_write: true, always_ask: false, default_policy: 'ask' },
  { action_key: 'search', app_key: 'web', app_name: 'Web', label: 'Pesquisar fontes', description: 'Busca e lê páginas na web', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'spend', app_key: 'fin', app_name: 'Finanças', label: 'Ler gastos e orçamentos', description: 'Consulta gastos por categoria', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'free', app_key: 'gcal', app_name: 'Google Agenda', label: 'Ver horários livres', description: 'Consulta disponibilidade na agenda', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'evt', app_key: 'gcal', app_name: 'Google Agenda', label: 'Criar evento', description: 'Agenda compromisso no calendário', is_write: true, always_ask: false, default_policy: 'ask' },
  { action_key: 'mailr', app_key: 'gmail', app_name: 'Gmail', label: 'Ler e-mails', description: 'Lê e busca mensagens na caixa de entrada', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'draft', app_key: 'gmail', app_name: 'Gmail', label: 'Rascunhar resposta', description: 'Cria rascunho sem enviar', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'waread', app_key: 'wa', app_name: 'WhatsApp', label: 'Ler conversas e mensagens', description: 'Lê mensagens recentes', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'wasend', app_key: 'wa', app_name: 'WhatsApp', label: 'Enviar mensagem', description: 'Envia mensagem para terceiros (sempre pede aprovação)', is_write: true, always_ask: true, default_policy: 'ask' },
  { action_key: 'omail', app_key: 'outlook', app_name: 'Outlook', label: 'Ler e-mails do Outlook', description: 'Consulta caixa de entrada Microsoft', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'oevt', app_key: 'outlook', app_name: 'Outlook', label: 'Criar evento no Outlook', description: 'Agenda evento no calendário Microsoft', is_write: true, always_ask: false, default_policy: 'ask' },
  { action_key: 'route', app_key: 'maps', app_name: 'Google Maps', label: 'Calcular rota e tempo', description: 'Verifica trânsito e tempo de trajeto', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'leave', app_key: 'maps', app_name: 'Google Maps', label: 'Avisar a hora de sair', description: 'Monitora trânsito para saída no horário', is_write: false, always_ask: false, default_policy: 'auto' },
  { action_key: 'tcard', app_key: 'trello', app_name: 'Trello', label: 'Criar cartão', description: 'Adiciona cartão em uma lista', is_write: true, always_ask: false, default_policy: 'ask' },
  { action_key: 'tmove', app_key: 'trello', app_name: 'Trello', label: 'Mover cartão', description: 'Move cartão entre listas', is_write: true, always_ask: false, default_policy: 'ask' },
];
