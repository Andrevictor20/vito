import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { Trigger, TriggerCategory, TriggerStatus, CreateTriggerInput } from '../types';

export const useTriggers = () => {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TriggerCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      console.error('[useTriggers] Erro ao carregar disparadores:', err);
      setError(err?.message || 'Falha ao sincronizar disparadores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    async (id: string, input: Partial<CreateTriggerInput> & { status?: TriggerStatus }): Promise<Trigger> => {
      const updated = await api.updateTrigger(id, input);
      setTriggers((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
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
    stats,
  };
};
