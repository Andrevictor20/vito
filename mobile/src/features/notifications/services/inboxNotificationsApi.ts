import { ApiClient } from '../../../services/api/client';

export type InboxNotificationGroup = 'Agora' | 'Hoje' | 'Ontem';
export type InboxNotificationType = 'aprovar' | 'alerta' | 'info';

export interface InboxNotificationAction {
  id?: string;
  label: string;
  action?: string;
  style?: string;
  value?: string;
  primary?: boolean;
}

export interface InboxNotification {
  id: string;
  group_key: InboxNotificationGroup;
  type: InboxNotificationType;
  source_domain: 'bots' | 'tasks' | 'booking' | 'calendar' | 'system' | string;
  source_id?: string;
  bot_id?: string;
  bot_color?: string;
  bot_skin_json?: string;
  title: string;
  body: string;
  time_label?: string;
  is_unread: boolean;
  is_dismissed?: boolean;
  actions: InboxNotificationAction[];
  created_at?: string;
}

export interface NotificationCategoryPreferences {
  agenda: boolean;
  tarefas: boolean;
  financas: boolean;
  bots: boolean;
  resumo: boolean;
  promo: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationCategoryPreferences = {
  agenda: true,
  tarefas: true,
  financas: true,
  bots: true,
  resumo: true,
  promo: false,
};

function normalizeNotification(raw: InboxNotification): InboxNotification {
  const actions = (raw.actions || []).map((a) => ({
    ...a,
    action: a.action || a.id || 'read',
    primary: a.primary ?? a.style === 'primary',
  }));
  const timeLabel =
    raw.time_label ||
    (raw.group_key === 'Agora' ? 'agora' : raw.group_key === 'Ontem' ? 'ontem' : 'hoje');
  return { ...raw, time_label: timeLabel, actions };
}

export class InboxNotificationsApi {
  constructor(private client: ApiClient) {}

  async listNotifications(): Promise<InboxNotification[]> {
    const res = await this.client.request<
      { notifications?: InboxNotification[] } | InboxNotification[]
    >('/api/v1/notifications', { method: 'GET' });
    const list = Array.isArray(res) ? res : res?.notifications || [];
    return list.map(normalizeNotification);
  }

  async performAction(
    id: string,
    action: string,
    payload?: Record<string, unknown>
  ): Promise<{ status: string; navigate_to?: string }> {
    return this.client.request<{ status: string; navigate_to?: string }>(
      `/api/v1/notifications/${encodeURIComponent(id)}/action`,
      {
        method: 'POST',
        body: JSON.stringify({ action, ...(payload || {}) }),
      }
    );
  }

  async markAllRead(): Promise<{ status: string }> {
    return this.client.request<{ status: string }>('/api/v1/notifications/read-all', {
      method: 'POST',
    });
  }

  async getPreferences(): Promise<NotificationCategoryPreferences> {
    const res = await this.client.request<
      { preferences?: NotificationCategoryPreferences } | NotificationCategoryPreferences
    >('/api/v1/notifications/preferences', { method: 'GET' });
    const prefs = (res as { preferences?: NotificationCategoryPreferences })?.preferences ?? res;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(prefs as Partial<NotificationCategoryPreferences>) };
  }

  async updatePreferences(
    prefs: Partial<NotificationCategoryPreferences>
  ): Promise<NotificationCategoryPreferences> {
    const res = await this.client.request<
      { preferences?: NotificationCategoryPreferences } | NotificationCategoryPreferences
    >('/api/v1/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
    const updated = (res as { preferences?: NotificationCategoryPreferences })?.preferences ?? res;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(updated as Partial<NotificationCategoryPreferences>) };
  }
}
