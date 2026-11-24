import type {
  InboxNotification,
  InboxNotificationGroup,
} from '../../services/api/inboxNotificationsApi';

export type NotificationFilter = 'all' | 'aprovar' | 'alerta' | 'info';

export const NOTIFICATION_GROUPS: InboxNotificationGroup[] = ['Agora', 'Hoje', 'Ontem'];

export function filterNotifications(
  items: InboxNotification[],
  filter: NotificationFilter
): InboxNotification[] {
  if (filter === 'all') return items;
  if (filter === 'aprovar') return items.filter((i) => i.type === 'aprovar');
  if (filter === 'info') return items.filter((i) => i.type === 'info');
  return items.filter((i) => i.type === 'alerta');
}

export function groupNotifications(
  items: InboxNotification[]
): Array<{ group: InboxNotificationGroup; items: InboxNotification[] }> {
  return NOTIFICATION_GROUPS.map((group) => ({
    group,
    items: items.filter((i) => (i.group_key || 'Hoje') === group),
  })).filter((g) => g.items.length > 0);
}

export function countUnreadNotifications(items: InboxNotification[]): number {
  return items.filter((i) => i.is_unread).length;
}
