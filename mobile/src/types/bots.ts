export type ActionPolicy = 'auto' | 'ask' | 'off';

export type BotStatus = 'active' | 'paused' | 'error';

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

export interface BotActionSpec {
  app_key: string;
  action_key: string;
  label: string;
  description?: string;
  is_write?: boolean;
  always_ask?: boolean;
  policy: ActionPolicy;
  app_connected?: boolean;
  app_name?: string;
}

export interface BotSkillUpgradeInfo {
  new_version: number;
  new_actions: string[];
  label: string;
}

export interface BotSkillRef {
  skill_key: string;
  version: number;
  name: string;
  icon?: string;
  description?: string;
  when?: string;
  steps?: string[];
  actions?: string[];
  upgrade_available?: BotSkillUpgradeInfo | null;
}

export interface BotTriggerRule {
  id?: string;
  kind: 'schedule' | 'condition' | 'event';
  label: string;
  cron?: string;
  quiet?: boolean;
}

export interface BotPendingApproval {
  confirmation_id: string;
  action_key: string;
  app_key?: string;
  title: string;
  summary: string;
  always_ask: boolean;
  created_at: string;
}

export interface BotMemoryItem {
  id: string;
  content: string;
  created_at: string;
}

export interface BotRunReport {
  id: string;
  bot_id: string;
  status: 'ok' | 'ok_silent' | 'pending' | 'error' | 'partial';
  ran_at: string;
  summary: string;
  verified: string[];
  actions_done: string[];
  pending: string[];
  cant: string[];
}

export interface Bot {
  id: string;
  title: string;
  category: string;
  goal: string;
  status: BotStatus;
  quiet?: boolean;
  skin_json?: string;
  skin?: BotSkin;
  anim_state?: BotAnimState;
  model_pref?: string | null;
  effort_pref?: string | null;
  trigger_label?: string;
  triggers?: BotTriggerRule[];
  rules?: string[];
  skills: BotSkillRef[];
  actions: BotActionSpec[];
  pending: BotPendingApproval[];
  apps: string[];
  actions_summary?: string;
  last_line?: string;
  last_run_at?: string;
  failure_count?: number;
  runs?: BotRunReport[];
  memories?: BotMemoryItem[];
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
  default_triggers: BotTriggerRule[];
  default_rules: string[];
  setup_questions: string[];
  actions?: string[];
  missing_apps?: string[];
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
  output_contract: string;
}

export interface BotAppActionMeta {
  action_key: string;
  label: string;
  is_write: boolean;
  always_ask: boolean;
}

export interface BotAppInfo {
  app_key: string;
  name: string;
  connected: boolean;
  icon?: string;
  color?: string;
  actions: BotAppActionMeta[];
}

export interface BotActivityItem {
  id: string;
  bot_id: string;
  bot_title: string;
  kind: 'run' | 'action' | 'pending' | 'error';
  text: string;
  created_at: string;
  skin?: BotSkin;
}

export interface BotChatProposal {
  kind: 'skill' | 'action' | 'goal' | 'schedule';
  label: string;
  payload: Record<string, unknown>;
}

export interface BotChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  proposal?: BotChatProposal;
}

export interface CreateBotPayload {
  template_key?: string;
  title?: string;
  category?: string;
  goal?: string;
  skin_json?: string;
  triggers?: BotTriggerRule[];
  actions?: { action_key: string; policy: ActionPolicy }[];
  skills?: string[];
  rules?: string[];
}

export interface UpdateBotPayload {
  title?: string;
  category?: string;
  goal?: string;
  status?: BotStatus;
  quiet?: boolean;
  skin_json?: string;
  triggers?: BotTriggerRule[];
  rules?: string[];
}

export type PendingResolutionDecision = 'allow_once' | 'always_allow' | 'deny';

export const ALWAYS_ASK_ACTIONS: ReadonlySet<string> = new Set([
  'wasend',
  'share',
  'publish',
  'delete',
  'pay',
]);
