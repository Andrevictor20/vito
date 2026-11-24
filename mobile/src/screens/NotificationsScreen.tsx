import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../icons/ProtoUiIcons';
import { useNavigation } from '@react-navigation/native';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { dataSync } from '../services/dataSync';
import { notificationsInboxStore } from '../services/notificationsInboxStore';
import type {
  InboxNotification,
  InboxNotificationAction,
} from '../services/api/inboxNotificationsApi';
import { VitoMascot } from '../components/common/VitoMascot';
import { NotificationItemCard } from '../components/notifications/NotificationItemCard';
import {
  countUnreadNotifications,
  filterNotifications,
  groupNotifications,
  NotificationFilter,
} from '../components/notifications/notificationHelpers';
import { navigateToBooking, navigateToTab } from '../navigation/screensNav';
import { getTaskBucket } from '../utils/taskBuckets';

export const NotificationsScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? '' : prev)), 2500);
  };

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const merged = await notificationsInboxStore.loadMergedNotifications();
      setItems(merged);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unreadCount = useMemo(() => countUnreadNotifications(items), [items]);
  const approveCount = useMemo(
    () => items.filter((i) => i.type === 'aprovar').length,
    [items]
  );
  const alertCount = useMemo(
    () => items.filter((i) => i.type === 'alerta').length,
    [items]
  );
  const infoCount = useMemo(
    () => items.filter((i) => i.type === 'info').length,
    [items]
  );
  const grouped = useMemo(
    () => groupNotifications(filterNotifications(items, filter)),
    [items, filter]
  );

  const handleBack = () => {
    hapticFeedback.light();
    if (onBack) onBack();
    else navigation.goBack();
  };

  const handleMarkAllRead = async () => {
    hapticFeedback.selection();
    setItems((prev) => prev.map((x) => ({ ...x, is_unread: false })));
    notificationsInboxStore.setUnreadCount(0);
    try {
      await api.inbox.markAllRead();
    } catch {
      // Estado local atualizado
    }
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
        if (botId && confId && item.id.startsWith('bot-')) {
          await api.resolveBotPending(botId, confId, decision).catch(() => {});
        } else {
          await api.inbox.performAction(item.id, actionKey).catch(() => {});
        }
        setItems((prev) => {
          const next = prev.filter((x) => x.id !== item.id);
          notificationsInboxStore.setUnreadCount(countUnreadNotifications(next));
          return next;
        });
        dataSync.notify('refresh_bots');
        showToast(isReject ? 'Ação recusada' : 'Ação do bot aprovada');
        return;
      }

      if (actionKey === 'reschedule_overdue' || actionKey === 'reschedule_today') {
        if (item.id === 'tasks-atr') {
          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 0);
          const todos = await api.getTodos('pending').catch(() => []);
          const overdue = (todos || []).filter((t) => getTaskBucket(t.due_date) === 'atr');
          await Promise.all(
            overdue.map((t) => api.updateTodo(t.id, { due_date: endOfDay.toISOString() }).catch(() => null))
          );
        } else {
          await api.inbox.performAction(item.id, 'reschedule_today').catch(() => {});
        }
        setItems((prev) => {
          const next = prev.filter((x) => x.id !== item.id);
          notificationsInboxStore.setUnreadCount(countUnreadNotifications(next));
          return next;
        });
        dataSync.notify('refresh_todos');
        showToast('Tarefas atrasadas reagendadas para hoje');
        return;
      }

      if (actionKey === 'go_tasks' || actionKey === 'view_tasks') {
        if (item.id !== 'tasks-atr') {
          await api.inbox.performAction(item.id, 'view_tasks').catch(() => {});
        }
        setItems((prev) => {
          const next = prev.map((x) => (x.id === item.id ? { ...x, is_unread: false } : x));
          notificationsInboxStore.setUnreadCount(countUnreadNotifications(next));
          return next;
        });
        handleBack();
        navigateToTab('tasks');
        return;
      }

      if (actionKey === 'go_booking') {
        handleBack();
        navigateToBooking();
        return;
      }

      await api.inbox.performAction(item.id, actionKey).catch(() => {});
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== item.id);
        notificationsInboxStore.setUnreadCount(countUnreadNotifications(next));
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.sbar}>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.bg, borderColor: colors.hairline }]}
          onPress={handleBack}
          accessibilityLabel="Voltar"
        >
          <ProtoUiIcon name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.ttl}>
          <Text style={[styles.h1, { color: colors.ink }]}>Notificações</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {unreadCount
              ? `${unreadCount} ${unreadCount === 1 ? 'pendência' : 'pendências'}`
              : 'Tudo em dia'}
          </Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity
            style={[styles.clearBtn, { backgroundColor: colors.surf }]}
            onPress={handleMarkAllRead}
            accessibilityLabel="Marcar todas como lidas"
          >
            <Text style={[styles.clearBtnText, { color: colors.ink }]}>Marcar lidas</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {[
            { id: 'all' as NotificationFilter, label: 'Tudo', count: items.length },
            { id: 'aprovar' as NotificationFilter, label: 'Aprovações', count: approveCount },
            { id: 'alerta' as NotificationFilter, label: 'Alertas', count: alertCount },
            { id: 'info' as NotificationFilter, label: 'Avisos', count: infoCount },
          ].map((c) => {
            const active = filter === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.ink : colors.surf,
                    borderColor: active ? colors.ink : colors.line,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setFilter(c.id);
                }}
              >
                <Text style={[styles.chipText, { color: active ? colors.bg : colors.ink }]}>
                  {c.label}
                </Text>
                <Text
                  style={[
                    styles.chipCount,
                    { color: active ? colors.bg : colors.muted },
                  ]}
                >
                  {c.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(true);
            }}
            tintColor={colors.ink}
          />
        }
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="small" color={colors.ink} />
        ) : grouped.length === 0 ? (
          <View style={styles.emptyWrap}>
            <VitoMascot size={72} state="success" animated />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>Tudo em dia!</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              O Vito avisa aqui assim que surgir uma aprovação, alerta ou resumo importante.
            </Text>
          </View>
        ) : (
          grouped.map((g) => (
            <View key={g.group} style={styles.groupBlock}>
              <Text style={[styles.groupHeader, { color: colors.muted }]}>
                {g.group}
              </Text>
              {g.items.map((item) => (
                <NotificationItemCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onAction={handleAction}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {!!toastMsg && (
        <View style={[styles.toast, { backgroundColor: colors.ink }]}>
          <Text style={[styles.toastText, { color: colors.bg }]}>{toastMsg}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  sbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttl: { flex: 1 },
  h1: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    fontFamily: tokens.typography.family.semibold,
  },
  sub: { fontSize: 13, marginTop: 1 },
  clearBtn: {
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: { fontSize: 12.5, fontWeight: '600' },
  chipsWrap: { marginTop: 10, marginBottom: 4 },
  chipsRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipCount: { fontSize: 12, fontVariant: ['tabular-nums'] },
  scrollContent: { padding: 16, paddingBottom: 80 },
  groupBlock: { marginTop: 12 },
  groupHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 56,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 6 },
  emptySub: { fontSize: 13.5, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { fontSize: 13, fontWeight: '600' },
});
