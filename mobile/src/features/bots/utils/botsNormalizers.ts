import { DEFAULT_APPS_CATALOG } from '../data/botsCatalogFallback';
import type {
  Bot,
  BotActionSpec,
  BotActivityItem,
  BotAppInfo,
  BotPendingApproval,
  BotRunReport,
  BotSkillRef,
  BotTemplate,
  SkillPackage,
} from '../types/bots';

function asRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' ? (val as Record<string, unknown>) : {};
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/**
 * Extrai a chave do app tanto de strings ('vito') quanto de objetos DTO ({ app_key: 'vito' }).
 */
export function extractAppKey(entry: unknown): string {
  if (typeof entry === 'string') {
    return entry.trim();
  }
  if (entry && typeof entry === 'object') {
    const rec = entry as Record<string, unknown>;
    if (typeof rec.app_key === 'string') {
      return rec.app_key.trim();
    }
  }
  return '';
}

export function formatBotTriggerLabel(frequency?: string, scheduledTime?: string): string {
  const timeSuffix = scheduledTime ? ` às ${scheduledTime}` : '';
  switch ((frequency || '').trim()) {
    case 'daily_morning':
      return scheduledTime ? `Todo dia às ${scheduledTime}` : 'Todo dia de manhã';
    case 'daily_evening':
      return scheduledTime ? `Todo dia às ${scheduledTime}` : 'Todo dia à noite';
    case 'hourly':
      return 'A cada hora';
    case 'immediate':
      return 'Monitoramento contínuo';
    default:
      return timeSuffix ? `Agendado${timeSuffix}` : 'Sob demanda';
  }
}

function normalizePending(raw: unknown): BotPendingApproval {
  const r = asRecord(raw);
  const title = asString(r.title) || asString(r.label) || 'Aguardando aprovação';
  return {
    confirmation_id: asString(r.confirmation_id),
    action_key: asString(r.action_key),
    app_key: asString(r.app_key) || undefined,
    title,
    label: asString(r.label) || undefined,
    summary: asString(r.summary),
    always_ask: Boolean(r.always_ask),
    created_at: asString(r.created_at),
  };
}

function normalizeSkillRef(raw: unknown): BotSkillRef {
  const r = asRecord(raw);
  const latestVersion = typeof r.latest_version === 'number' ? r.latest_version : undefined;
  const hasUpgrade = Boolean(r.has_upgrade) && typeof latestVersion === 'number';
  const upgradeActions = asStringArray(r.upgrade_new_actions);
  const existingUpgrade = r.upgrade_available && typeof r.upgrade_available === 'object'
    ? (r.upgrade_available as BotSkillRef['upgrade_available'])
    : null;

  return {
    skill_key: asString(r.skill_key),
    version: typeof r.version === 'number' ? r.version : 1,
    name: asString(r.name) || asString(r.skill_key),
    icon: asString(r.icon) || undefined,
    description: asString(r.description) || undefined,
    when: asString(r.when) || undefined,
    steps: asStringArray(r.steps),
    actions: asStringArray(r.actions),
    upgrade_available:
      existingUpgrade ??
      (hasUpgrade
        ? {
            new_version: latestVersion!,
            new_actions: upgradeActions,
            label: `Atualizar para v${latestVersion}`,
          }
        : null),
  };
}

function normalizeActionSpec(raw: unknown): BotActionSpec {
  const r = asRecord(raw);
  const policyRaw = asString(r.policy, 'ask');
  const policy = policyRaw === 'auto' || policyRaw === 'ask' || policyRaw === 'off' ? policyRaw : 'ask';
  return {
    app_key: asString(r.app_key, 'vito'),
    action_key: asString(r.action_key),
    label: asString(r.label) || asString(r.action_key),
    description: asString(r.description) || undefined,
    is_write: Boolean(r.is_write),
    always_ask: Boolean(r.always_ask),
    policy,
    app_connected: typeof r.app_connected === 'boolean' ? r.app_connected : true,
    app_name: asString(r.app_name) || undefined,
  };
}

function normalizeRunReport(raw: unknown, fallbackBotId: string): BotRunReport {
  const r = asRecord(raw);
  const report = r.report && typeof r.report === 'object' ? asRecord(r.report) : null;
  const statusRaw = asString(r.status) || asString(report?.status) || 'ok';
  const status =
    statusRaw === 'ok' ||
    statusRaw === 'ok_silent' ||
    statusRaw === 'pending' ||
    statusRaw === 'error' ||
    statusRaw === 'partial'
      ? statusRaw
      : 'ok';

  return {
    id: asString(r.id) || `${fallbackBotId}-${asString(r.triggered_at) || Date.now()}`,
    bot_id: asString(r.bot_id, fallbackBotId),
    status,
    ran_at: asString(r.ran_at) || asString(r.triggered_at),
    summary: asString(r.summary) || asString(report?.summary) || asString(r.message),
    verified: asStringArray(report?.verified ?? r.verified),
    actions_done: asStringArray(report?.did ?? r.actions_done),
    pending: asStringArray(report?.waiting ?? r.pending),
    cant: asStringArray(report?.cant ?? r.cant),
  };
}

export function normalizeBot(raw: unknown): Bot {
  const r = asRecord(raw);
  const id = asString(r.id);
  const actions = Array.isArray(r.actions) ? r.actions.map(normalizeActionSpec) : [];
  const skills = Array.isArray(r.skills) ? r.skills.map(normalizeSkillRef) : [];
  const pending = Array.isArray(r.pending) ? r.pending.map(normalizePending) : [];

  const rawApps = Array.isArray(r.apps) ? r.apps : [];
  const appSet = new Set<string>();
  for (const item of rawApps) {
    const key = extractAppKey(item);
    if (key) appSet.add(key);
  }
  if (appSet.size === 0) {
    for (const act of actions) {
      if (act.app_key) appSet.add(act.app_key);
    }
  }

  const lastObj = r.last && typeof r.last === 'object' ? asRecord(r.last) : null;
  const runsSource = Array.isArray(r.runs) ? r.runs : Array.isArray(r.logs) ? r.logs : undefined;
  const statusRaw = asString(r.status, 'active');
  const status = statusRaw === 'active' || statusRaw === 'paused' || statusRaw === 'error' ? statusRaw : 'active';

  return {
    ...(r as unknown as Bot),
    id,
    title: asString(r.title, 'Bot'),
    category: asString(r.category, 'Geral'),
    goal: asString(r.goal),
    status,
    quiet: typeof r.quiet === 'boolean' ? r.quiet : Boolean(r.quiet_only_on_change),
    trigger_label:
      asString(r.trigger_label) || formatBotTriggerLabel(asString(r.frequency), asString(r.scheduled_time)),
    rules: asStringArray(r.rules),
    skills,
    actions,
    pending,
    apps: Array.from(appSet),
    last_line: asString(r.last_line) || asString(lastObj?.summary) || undefined,
    last_run_at:
      asString(r.last_run_at) || asString(lastObj?.at) || asString(r.last_checked_at) || undefined,
    runs: runsSource ? runsSource.map((item) => normalizeRunReport(item, id)) : undefined,
    memories: Array.isArray(r.memories) ? r.memories : undefined,
  };
}

export function normalizeBotApps(rawApps: unknown): BotAppInfo[] {
  if (!Array.isArray(rawApps)) return DEFAULT_APPS_CATALOG;
  return rawApps.map((raw) => {
    const r = asRecord(raw);
    const appKey = asString(r.app_key);
    const fallback = DEFAULT_APPS_CATALOG.find((item) => item.app_key === appKey);
    const rawActions = Array.isArray(r.actions) && r.actions.length > 0 ? r.actions : fallback?.actions ?? [];
    return {
      app_key: appKey,
      name: asString(r.name) || fallback?.name || appKey,
      connected: Boolean(r.connected),
      icon: asString(r.icon) || fallback?.icon,
      color: asString(r.color) || fallback?.color,
      actions: rawActions.map((act) => {
        const a = asRecord(act);
        return {
          action_key: asString(a.action_key),
          label: asString(a.label) || asString(a.action_key),
          is_write: Boolean(a.is_write),
          always_ask: Boolean(a.always_ask),
        };
      }),
    };
  });
}

export function normalizeBotActivity(raw: unknown): BotActivityItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const r = asRecord(entry);
    const rawKind = asString(r.kind);
    const status = asString(r.status);
    const kind =
      rawKind === 'run' || rawKind === 'action' || rawKind === 'pending' || rawKind === 'error'
        ? rawKind
        : status === 'error'
          ? 'error'
          : status === 'pending'
            ? 'pending'
            : 'run';
    return {
      id: asString(r.id),
      bot_id: asString(r.bot_id),
      bot_title: asString(r.bot_title),
      kind,
      text: asString(r.text) || asString(r.message),
      created_at: asString(r.created_at) || asString(r.triggered_at),
      skin: r.skin as BotActivityItem['skin'],
    };
  });
}

export function normalizeBotTemplates(raw: unknown): BotTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const r = asRecord(entry);
    return {
      ...(r as unknown as BotTemplate),
      skills: asStringArray(r.skills),
      default_rules: asStringArray(r.default_rules),
      setup_questions: asStringArray(r.setup_questions),
      actions: asStringArray(r.actions),
      default_triggers: Array.isArray(r.default_triggers) ? r.default_triggers : [],
    };
  });
}

export function normalizeSkillPackages(raw: unknown): SkillPackage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const r = asRecord(entry);
    return {
      ...(r as unknown as SkillPackage),
      steps: asStringArray(r.steps),
      actions: asStringArray(r.actions),
    };
  });
}
