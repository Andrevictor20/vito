import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { dataSync } from '../services/dataSync';
import { notificationService } from '../services/notificationService';
import { hapticFeedback } from '../theme/motion';
import type { PendingItem } from '../types';

/** Estado e mutações das pendências para a página unificada. */
export function usePendingItems(onScheduled?: (title: string, dateStr: string) => void) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.getPendingItems();
      setItems(data || []);
    } catch (err) {
      console.warn('[usePendingItems] Erro ao carregar pendências:', err);
      setError('Não foi possível carregar as pendências.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const offPending = dataSync.subscribe('refresh_pending', () => load(true));
    const offAll = dataSync.subscribe('refresh_all', () => load(true));
    return () => {
      offPending();
      offAll();
    };
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const create = useCallback(
    async (
      title: string,
      category = 'geral',
      extra?: { scheduled_date?: string; remind_at?: string; remind_repeat?: 'none' | 'daily' | 'weekly'; remind_advance_minutes?: number },
    ) => {
      const trimmed = title.trim();
      if (!trimmed) return null;
      hapticFeedback.medium();
      const created = await api.createPendingItem({ title: trimmed, category, ...(extra || {}) });
      setItems((prev) => [created, ...prev]);
      if (created.status !== 'done' && created.remind_at) {
        await notificationService.schedulePendingReminder(created).catch(() => {});
      }
      hapticFeedback.success();
      return created;
    },
    [],
  );

  const toggleComplete = useCallback(async (item: PendingItem) => {
    hapticFeedback.medium();
    if (item.status === 'done') {
      const updated = await api.updatePendingItem(item.id, { status: 'inbox' });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } else {
      const completed = await api.completePendingItem(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? completed : i)));
      notificationService.cancelPendingReminder(item.id).catch(() => {});
      hapticFeedback.success();
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    hapticFeedback.light();
    await api.deletePendingItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    notificationService.cancelPendingReminder(id).catch(() => {});
  }, []);

  const updateReminder = useCallback(
    async (
      item: PendingItem,
      reminder: { remind_at?: string | null; remind_repeat?: 'none' | 'daily' | 'weekly'; remind_advance_minutes?: number },
    ) => {
      hapticFeedback.medium();
      const updated = await api.updatePendingItem(item.id, reminder);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      await notificationService.cancelPendingReminder(item.id).catch(() => {});
      if (updated.status !== 'done' && updated.remind_at) {
        await notificationService.schedulePendingReminder(updated).catch(() => {});
      }
      hapticFeedback.success();
      return updated;
    },
    [],
  );

  const schedule = useCallback(
    async (item: PendingItem, dateStr: string) => {
      hapticFeedback.medium();
      const scheduled = await api.schedulePendingItem(item.id, dateStr);
      setItems((prev) => prev.map((i) => (i.id === item.id ? scheduled : i)));
      hapticFeedback.success();
      onScheduled?.(item.title, dateStr);
    },
    [onScheduled],
  );

  return { items, loading, refreshing, error, refresh, retry: () => load(), create, toggleComplete, remove, schedule, updateReminder };
}
