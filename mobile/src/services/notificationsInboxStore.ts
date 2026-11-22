import { api } from './api';
import type { InboxNotification } from './api/inboxNotificationsApi';
import { getTaskBucket } from '../utils/taskBuckets';

type UnreadListener = (count: number) => void;

class NotificationsInboxStore {
  private unreadCount = 0;
  private listeners = new Set<UnreadListener>();
  private dismissedKeys = new Set<string>();

  getUnreadCount(): number {
    return this.unreadCount;
  }

  subscribe(listener: UnreadListener): () => void {
    this.listeners.add(listener);
    listener(this.unreadCount);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setUnreadCount(count: number): void {
    const next = Math.max(0, count);
    if (this.unreadCount !== next) {
      this.unreadCount = next;
      this.listeners.forEach((l) => l(next));
    }
  }

  dismissKey(key: string): void {
    this.dismissedKeys.add(key);
  }

  dismissAllKeys(keys: string[]): void {
    keys.forEach((k) => this.dismissedKeys.add(k));
  }

  isDismissed(key: string): boolean {
    return this.dismissedKeys.has(key);
  }

  async loadMergedNotifications(): Promise<InboxNotification[]> {
    const items: InboxNotification[] = [];
    const seenIds = new Set<string>();

    try {
      const remote = await api.inbox.listNotifications();
      for (const n of remote || []) {
        if (n.is_dismissed || this.dismissedKeys.has(n.id)) continue;
        seenIds.add(n.id);
        items.push(n);
      }
    } catch {
      // Fallback silencioso para síntese local se endpoint ainda não responder
    }

    try {
      const [bots, todos, meetings] = await Promise.all([
        api.listBots().catch(() => []),
        api.getTodos('pending').catch(() => []),
        api.getMeetings().catch(() => []),
      ]);

      for (const bot of bots || []) {
        const pending = bot.pending?.[0];
        const id = `bot-${bot.id}`;
        if (pending && !seenIds.has(id) && !this.dismissedKeys.has(id)) {
          seenIds.add(id);
          items.push({
            id,
            group_key: 'Agora',
            type: 'aprovar',
            source_domain: 'bots',
            source_id: pending.confirmation_id || bot.id,
            bot_id: bot.id,
            bot_skin_json: bot.skin_json,
            title: bot.title,
            body: pending.summary || pending.title || 'Aprovação pendente',
            time_label: 'agora',
            is_unread: true,
            actions: [
              { label: 'Recusar', action: 'bot_reject', value: bot.id },
              { label: 'Aprovar', action: 'bot_approve', value: bot.id, primary: true },
            ],
          });
        }
      }

      const now = Date.now();
      const overdueCount = (todos || []).filter(
        (t) => t.status !== 'completed' && getTaskBucket(t.due_date, now) === 'atr'
      ).length;
      if (overdueCount > 0 && !seenIds.has('tasks-atr') && !this.dismissedKeys.has('tasks-atr')) {
        seenIds.add('tasks-atr');
        items.push({
          id: 'tasks-atr',
          group_key: 'Hoje',
          type: 'alerta',
          source_domain: 'tasks',
          title: `${overdueCount} ${overdueCount === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`,
          body: 'Posso reagendar tudo para hoje em um toque.',
          time_label: 'hoje',
          is_unread: true,
          actions: [
            { label: 'Ver tarefas', action: 'go_tasks' },
            { label: 'Reagendar hoje', action: 'reschedule_overdue', primary: true },
          ],
        });
      }

      const activeMeeting = (meetings || []).find((m) => Array.isArray(m.slots) && m.slots.length > 0);
      if (activeMeeting && !seenIds.has(`bk-${activeMeeting.id}`) && !this.dismissedKeys.has(`bk-${activeMeeting.id}`)) {
        const votes = activeMeeting.participants?.length ?? 0;
        if (votes > 0) {
          items.push({
            id: `bk-${activeMeeting.id}`,
            group_key: 'Ontem',
            type: 'info',
            source_domain: 'booking',
            source_id: activeMeeting.id,
            title: `${activeMeeting.title} ${activeMeeting.status === 'confirmed' ? 'confirmada' : 'com votos'}`,
            body: `${votes} ${votes === 1 ? 'participante votou' : 'participantes votaram'}.`,
            time_label: activeMeeting.status === 'confirmed' ? 'ontem' : 'hoje',
            is_unread: false,
            actions: [{ label: 'Ver votação', action: 'go_booking', value: activeMeeting.id }],
          });
        }
      }
    } catch {
      // Mantém itens já carregados
    }

    const unread = items.filter((i) => i.is_unread).length;
    this.setUnreadCount(unread);
    return items;
  }

  async refreshUnreadCount(): Promise<number> {
    const items = await this.loadMergedNotifications();
    return items.filter((i) => i.is_unread).length;
  }
}

export const notificationsInboxStore = new NotificationsInboxStore();
