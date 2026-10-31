import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Trigger, TriggerLog } from '../types';

export function useTriggers() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchTriggers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTriggers();
      setTriggers(data || []);
      return data || [];
    } catch (e) {
      console.error('[useTriggers] Falha ao carregar triggers:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (triggerId: string) => {
    if (!triggerId) {
      setLogs([]);
      return [];
    }
    setLoadingLogs(true);
    try {
      const data = await api.getTriggerLogs(triggerId);
      setLogs(data || []);
      return data || [];
    } catch (err) {
      console.warn('[useTriggers] Falha ao carregar logs:', err);
      setLogs([]);
      return [];
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const toggleTrigger = useCallback(async (id: string, active: boolean) => {
    try {
      await api.toggleTrigger(id, active);
      setTriggers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, active, status: active ? 'active' : 'paused' } : t))
      );
    } catch (e) {
      console.error('[useTriggers] Falha ao alternar trigger:', e);
      throw e;
    }
  }, []);

  const runTrigger = useCallback(async (id: string) => {
    try {
      const result = await api.runTrigger(id);
      return result;
    } catch (e) {
      console.error('[useTriggers] Falha ao rodar trigger:', e);
      throw e;
    }
  }, []);

  const testTrigger = useCallback(async (id: string) => {
    try {
      const result = await api.testTrigger(id);
      return result;
    } catch (e) {
      console.error('[useTriggers] Falha ao testar trigger:', e);
      throw e;
    }
  }, []);

  const updateTrigger = useCallback(async (id: string, updates: Partial<Trigger>) => {
    try {
      const result = await api.updateTrigger(id, updates);
      await fetchTriggers();
      return result;
    } catch (e) {
      console.error('[useTriggers] Falha ao atualizar trigger:', e);
      throw e;
    }
  }, [fetchTriggers]);

  const deleteTrigger = useCallback(async (id: string) => {
    try {
      await api.deleteTrigger(id);
      setTriggers((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error('[useTriggers] Falha ao excluir trigger:', e);
      throw e;
    }
  }, []);

  const clearTriggerLogs = useCallback(async (triggerId: string) => {
    try {
      await api.clearTriggerLogs(triggerId);
      setLogs([]);
    } catch (e) {
      console.error('[useTriggers] Falha ao limpar logs:', e);
      throw e;
    }
  }, []);

  const deleteTriggerLog = useCallback(async (triggerId: string, logId: string) => {
    try {
      await api.deleteTriggerLog(triggerId, logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (e) {
      console.error('[useTriggers] Falha ao excluir log:', e);
      throw e;
    }
  }, []);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  return {
    triggers,
    setTriggers,
    loading,
    logs,
    setLogs,
    loadingLogs,
    refresh: fetchTriggers,
    fetchTriggers,
    fetchLogs,
    toggleTrigger,
    runTrigger,
    testTrigger,
    updateTrigger,
    deleteTrigger,
    clearTriggerLogs,
    deleteTriggerLog,
  };
}
