import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { notificationsInboxStore } from '../../services/notificationsInboxStore';
import type {
  InboxNotification,
  InboxNotificationAction,
  InboxNotificationGroup,
} from '../../services/api/inboxNotificationsApi';
import { VitoMascot } from '../common/VitoMascot';
import { NotificationItemCard } from './NotificationItemCard';

type NotificationFilter = 'all' | 'aprovar' | 'alerta';
const GROUPS: InboxNotificationGroup[] = ['Agora', 'Hoje', 'Ontem'];

interface NotificationsViewProps {
  onBack?: () => void;
  onNavigateTab?: (tab: 'tasks' | 'meetings' | 'triggers' | 'chat') => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onBack,
  onNavigateTab,
}) => {
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((prev) => (prev === msg ? '' : prev)), 2500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const merged = await notificationsInboxStore.loadMergedNotifications();
      setItems(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unreadCount = useMemo(() => items.filter((i) => i.is_unread).length, [items]);
  const approveCount = useMemo(() => items.filter((i) => i.type === 'aprovar').length, [items]);
  const alertCount = useMemo(() => items.filter((i) => i.type === 'alerta').length, [items]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        group,
        items: filtered.filter((i) => (i.group_key || 'Hoje') === group),
      })).filter((g) => g.items.length > 0),
    [filtered]
  );

  const handleMarkAllRead = async () => {
    notificationsInboxStore.dismissAllKeys(items.map((i) => i.id));
    setItems((prev) => prev.map((x) => ({ ...x, is_unread: false })));
    notificationsInboxStore.setUnreadCount(0);
    await api.inbox.markAllRead().catch(() => {});
    showToast('Alertas marcados como lidos');
  };

  const handleAction = async (item: InboxNotification, act: InboxNotificationAction) => {
    const actionKey = act.action || act.id || 'read';
    setBusyId(item.id);
    try {
      if (
        actionKey === 'bot_approve' ||
        actionKey === 'bot_reject' ||
        actionKey === 'approve' ||
        actionKey === 'deny' ||
        actionKey === 'allow_once' ||
        actionKey === 'always_allow'
      ) {
        const isReject = actionKey === 'bot_reject' || actionKey === 'deny';
        const decision = actionKey === 'always_allow' ? 'always_allow' : isReject ? 'deny' : 'allow_once';
        const botId = item.bot_id || act.value || '';
        const confId = item.source_id || '';
        if (botId && confId) {
          await api.botsApi.resolvePending(botId, confId, decision).catch(() => {});
        }
        await api.inbox.performAction(item.id, actionKey).catch(() => {});
        notificationsInboxStore.dismissKey(item.id);
        setItems((prev) => prev.filter((x) => x.id !== item.id));
        showToast(isReject ? 'Ação recusada' : 'Ação do bot aprovada');
        return;
      }

      if (actionKey === 'reschedule_overdue' || actionKey === 'reschedule_today') {
        const todayIso = new Date().toISOString().split('T')[0];
        const todos = await api.getTodos('pending').catch(() => []);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const overdue = (todos || []).filter(
          (t) => t.status !== 'completed' && t.due_date && new Date(t.due_date) < todayStart
        );
        await Promise.all(
          overdue.map((t) => api.updateTodo(t.id, { due_date: todayIso }).catch(() => null))
        );
        await api.inbox.performAction(item.id, actionKey).catch(() => {});
        notificationsInboxStore.dismissKey(item.id);
        setItems((prev) => prev.filter((x) => x.id !== item.id));
        showToast('Tarefas atrasadas reagendadas para hoje');
        return;
      }

      if (actionKey === 'go_tasks' || actionKey === 'view_tasks') {
        onNavigateTab?.('tasks');
        return;
      }

      if (actionKey === 'go_booking') {
        notificationsInboxStore.dismissKey(item.id);
        onNavigateTab?.('meetings');
        return;
      }

      await api.inbox.performAction(item.id, actionKey).catch(() => {});
      notificationsInboxStore.dismissKey(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex-1 h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden">
      <header className="h-16 px-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-full border border-[var(--line)] bg-[var(--surf)] flex items-center justify-center hover:opacity-80"
              aria-label="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-[20px] font-bold tracking-tight leading-tight">Notificações</h1>
            <p className="text-[12.5px] text-[var(--muted)]">
              {unreadCount
                ? `${unreadCount} ${unreadCount === 1 ? 'pendência' : 'pendências'}`
                : 'Tudo em dia'}
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="h-9 px-3.5 rounded-full bg-[var(--surf)] border border-[var(--line)] text-xs font-semibold hover:opacity-80"
          >
            Marcar lidas
          </button>
        )}
      </header>

      <div className="px-6 pt-3 pb-1 flex items-center gap-2 shrink-0">
        {[
          { id: 'all' as NotificationFilter, label: 'Tudo', count: items.length },
          { id: 'aprovar' as NotificationFilter, label: 'Aprovações', count: approveCount },
          { id: 'alerta' as NotificationFilter, label: 'Alertas', count: alertCount },
        ].map((c) => {
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={`h-9 px-3.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                active
                  ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                  : 'bg-[var(--surf)] text-[var(--ink)] border-[var(--line)]'
              }`}
            >
              <span>{c.label}</span>
              <span className="opacity-70 tabular-nums">{c.count}</span>
            </button>
          );
        })}
      </div>

      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl mx-auto space-y-5">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 size={24} className="animate-spin text-[var(--muted)]" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center gap-2.5">
              <VitoMascot size={72} state="success" />
              <b className="text-lg font-semibold mt-1">Tudo em dia!</b>
              <p className="text-sm text-[var(--muted)] max-w-xs">
                O Vito avisa aqui assim que surgir uma aprovação, alerta ou resumo importante.
              </p>
            </div>
          ) : (
            grouped.map((g) => (
              <section key={g.group} className="space-y-2.5">
                <h2 className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--muted)] px-1">
                  {g.group}
                </h2>
                <div className="space-y-2.5">
                  {g.items.map((item) => (
                    <NotificationItemCard
                      key={item.id}
                      item={item}
                      busy={busyId === item.id}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--bg)] text-xs font-semibold shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
};
