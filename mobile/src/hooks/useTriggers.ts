import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { Trigger, TriggerLog, TriggerTestResult, TriggerCategory, TriggerStatus, CreateTriggerInput } from '../types';

export const useTriggers = (userId?: string) => {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TriggerCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `@vito_triggers_${userId || 'default'}`;

  // 1. Carrega do cache local imediato para render instantâneo
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTriggers(parsed);
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn('[useTriggers] Falha ao carregar cache local de disparadores:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [cacheKey]);

  const loadTriggers = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await api.getTriggers();
      setTriggers(data);
      // Persiste no cache local
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
    } catch (err: any) {
      console.error('[useTriggers] Erro ao carregar disparadores:', err);
      setError(err?.message || 'Falha ao sincronizar disparadores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  const onRefresh = useCallback(() => {
    loadTriggers(true);
  }, [loadTriggers]);

  const handleCreateTrigger = useCallback(async (input: CreateTriggerInput): Promise<Trigger> => {
    const created = await api.createTrigger(input);
    setTriggers((prev) => [created, ...prev]);
    return created;
  }, []);

  const handleToggleTrigger = useCallback(async (id: string): Promise<void> => {
    // Optimistic UI update
    setTriggers((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const newStatus: TriggerStatus = t.status === 'active' ? 'paused' : 'active';
          return { ...t, status: newStatus };
        }
        return t;
      })
    );

    try {
      const updated = await api.toggleTrigger(id);
      setTriggers((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err: any) {
      console.error('[useTriggers] Falha ao alternar status do disparador:', err);
      // Reverter em caso de falha
      loadTriggers();
      throw err;
    }
  }, [loadTriggers]);

  const handleDeleteTrigger = useCallback(async (id: string): Promise<void> => {
    setTriggers((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTrigger(id);
    } catch (err: any) {
      console.error('[useTriggers] Falha ao deletar disparador:', err);
      loadTriggers();
      throw err;
    }
  }, [loadTriggers]);

  const handleUpdateTrigger = useCallback(
    async (
      id: string,
      input: Partial<CreateTriggerInput> & { status?: TriggerStatus; scheduled_time?: string; days_of_week?: string }
    ): Promise<Trigger> => {
      const updated = await api.updateTrigger(id, input);
      setTriggers((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    },
    []
  );

  const handleRunTrigger = useCallback(
    async (id: string): Promise<TriggerLog> => {
      const log = await api.runTrigger(id);
      setTriggers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, current_value: log.message, last_run_status: 'success' } : t))
      );
      return log;
    },
    []
  );

  const handleTestTrigger = useCallback(
    async (id: string): Promise<TriggerTestResult> => {
      return await api.testTrigger(id);
    },
    []
  );

  const filteredTriggers = useMemo(() => {
    if (selectedCategory === 'all') {
      return triggers;
    }
    return triggers.filter((t) => t.category === selectedCategory);
  }, [triggers, selectedCategory]);

  const stats = useMemo(() => {
    const active = triggers.filter((t) => t.status === 'active').length;
    const paused = triggers.filter((t) => t.status === 'paused').length;
    const triggered = triggers.filter((t) => t.status === 'triggered').length;
    return {
      total: triggers.length,
      active,
      paused,
      triggered,
    };
  }, [triggers]);

  return {
    triggers: filteredTriggers,
    allTriggers: triggers,
    loading,
    refreshing,
    error,
    selectedCategory,
    setSelectedCategory,
    loadTriggers,
    onRefresh,
    handleCreateTrigger,
    handleToggleTrigger,
    handleDeleteTrigger,
    handleUpdateTrigger,
    handleRunTrigger,
    handleTestTrigger,
    stats,
  };
};
