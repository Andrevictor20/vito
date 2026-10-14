import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Trigger, TriggerLog, TriggerTestResult, TriggerCategory, TriggerStatus, CreateTriggerInput } from '../types';

import { dataSync } from '../services/dataSync';
import { queryKeys } from '../services/queryClient';

export const useTriggers = (userId?: string) => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<TriggerCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `@vito_triggers_${userId || 'default'}`;

  // Leitura via React Query (MOB-04 gradual): cache-first com AsyncStorage,
  // retry/em states nativos e invalidação automática via dataSync.
  const [cachedInitial, setCachedInitial] = useState<Trigger[] | undefined>(undefined);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCachedInitial(parsed);
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

  const query = useQuery({
    queryKey: queryKeys.triggers(userId),
    queryFn: async (): Promise<Trigger[]> => {
      try {
        const data = await api.getTriggers();
        setError(null);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
        return data;
      } catch (err: any) {
        setError(err?.message || 'Falha ao sincronizar disparadores');
        throw err;
      }
    },
    initialData: cachedInitial,
    initialDataUpdatedAt: cachedInitial ? Date.now() : undefined,
  });

  const triggers = useMemo(() => query.data || [], [query.data]);
  const loading = query.isLoading && triggers.length === 0;
  const refreshing = query.isRefetching;

  const loadTriggers = useCallback(async (_isRefresh = false) => {
    await query.refetch();
  }, [query]);

  useEffect(() => {
    const unsub = dataSync.subscribe('refresh_triggers', () => {
      query.refetch().catch(() => {});
    });
    return unsub;
  }, [query]);

  // Auto-refresh silencioso ao voltar para o app (§9.4).
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        query.refetch({ cancelRefetch: false }).catch(() => {});
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [query]);

  const onRefresh = useCallback(() => {
    loadTriggers(true);
  }, [loadTriggers]);

  const setTriggers = useCallback((updater: (prev: Trigger[]) => Trigger[]) => {
    queryClient.setQueryData<Trigger[]>(queryKeys.triggers(userId), (old) => updater(old || []));
  }, [queryClient, userId]);

  const handleCreateTrigger = useCallback(async (input: CreateTriggerInput): Promise<Trigger> => {
    const created = await api.createTrigger(input);
    setTriggers((prev) => [created, ...prev]);

    // Dispara a verificação imediata para já trazer notícias reais atualizadas no momento da criação
    api.runTrigger(created.id)
      .then((log) => {
        setTriggers((prev) =>
          prev.map((t) =>
            t.id === created.id
              ? { ...t, current_value: log.message, last_run_status: 'success' }
              : t
          )
        );
      })
      .catch((runErr) => {
        console.warn('[useTriggers] Pesquisa inicial do radar:', runErr);
      })
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.triggers(userId) }).catch(() => {});
      });

    return created;
  }, [queryClient, setTriggers, userId]);

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
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.triggers(userId) }).catch(() => {});
    }
  }, [loadTriggers, queryClient, setTriggers, userId]);

  const handleDeleteTrigger = useCallback(async (id: string): Promise<void> => {
    setTriggers((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTrigger(id);
    } catch (err: any) {
      console.error('[useTriggers] Falha ao deletar disparador:', err);
      // Se o radar já não existe mais no backend (404), mantém a exclusão otimista com sucesso
      if (err?.message?.includes('404')) {
        return;
      }
      loadTriggers();
      throw err;
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.triggers(userId) }).catch(() => {});
    }
  }, [loadTriggers, queryClient, setTriggers, userId]);

  const handleUpdateTrigger = useCallback(
    async (
      id: string,
      input: Partial<CreateTriggerInput> & { status?: TriggerStatus; scheduled_time?: string; days_of_week?: string }
    ): Promise<Trigger> => {
      const updated = await api.updateTrigger(id, input);
      setTriggers((prev) => prev.map((t) => (t.id === id ? updated : t)));
      queryClient.invalidateQueries({ queryKey: queryKeys.triggers(userId) }).catch(() => {});
      return updated;
    },
    [queryClient, setTriggers, userId]
  );

  const handleRunTrigger = useCallback(
    async (id: string): Promise<TriggerLog> => {
      const log = await api.runTrigger(id);
      setTriggers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, current_value: log.message, last_run_status: 'success' } : t))
      );
      return log;
    },
    [setTriggers]
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
