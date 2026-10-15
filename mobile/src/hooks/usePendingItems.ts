import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { dataSync } from '../services/dataSync';
import { notificationService } from '../services/notificationService';
import { hapticFeedback } from '../theme/motion';
import { useAuth } from '../context/AuthContext';
import { getPendingCacheKey, parseCachedPendingItems, isNetworkError } from '../utils/pendingCache';
import type { PendingItem } from '../types';

/** Estado e mutações das pendências para a página unificada. */
export function usePendingItems(onScheduled?: (title: string, dateStr: string) => void) {
  const { user } = useAuth();
  const cacheKey = getPendingCacheKey(user?.id);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<PendingItem[]>([]);
  itemsRef.current = items;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.getPendingItems();
      setItems(data || []);
    } catch (err: any) {
      const status = err?.status as number | undefined;
      if (isNetworkError(err)) {
        // Sem transporte (CORS/offline/timeout/DNS): vale o cache; só bloqueia sem nada.
        console.warn('[usePendingItems] Servidor inacessível, usando cache:', err?.message);
        if (itemsRef.current.length === 0) {
          setError('Sem conexão com o servidor. Verifique a rede e tente de novo.');
        }
      } else if (status === 401) {
        setError('Sessão expirada. Entre novamente para carregar as pendências.');
      } else {
        console.warn('[usePendingItems] Erro ao carregar pendências:', err);
        setError('Não foi possível carregar as pendências.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    // Hidratação instantânea do cache (espelho dos todos em useHomeData).
    AsyncStorage.getItem(cacheKey)
      .then((raw) => {
        const cached = parseCachedPendingItems(raw);
        if (cached) setItems(cached);
      })
      .catch(() => {});
    load();
    const offPending = dataSync.subscribe('refresh_pending', () => load(true));
    const offAll = dataSync.subscribe('refresh_all', () => load(true));
    return () => {
      offPending();
      offAll();
    };
  }, [load, cacheKey]);

  // Persiste cada mudança (carga + mutações) para o próximo boot offline.
  useEffect(() => {
    if (!loading) {
      AsyncStorage.setItem(cacheKey, JSON.stringify(items)).catch(() => {});
    }
  }, [items, cacheKey, loading]);

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

  /** Edição completa da pendência (título, categoria, data e lembrete). */
  const updateItem = useCallback(
    async (
      item: PendingItem,
      data: { title?: string; category?: string; scheduled_date?: string; remind_at?: string; remind_repeat?: 'none' | 'daily' | 'weekly'; remind_advance_minutes?: number },
    ) => {
      hapticFeedback.medium();
      const updated = await api.updatePendingItem(item.id, data);
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

  return { items, loading, refreshing, error, refresh, retry: () => load(), create, toggleComplete, remove, schedule, updateReminder, updateItem };
}
