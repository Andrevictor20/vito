import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { CalendarEvent, Todo, PendingItem } from '../types';

export function useHomeData() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [pendings, setPendings] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [evs, tds, pends] = await Promise.all([
        api.getEvents().catch(() => []),
        api.getTodos().catch(() => []),
        api.getPendingItems().catch(() => []),
      ]);
      setEvents(evs || []);
      setTodos(tds || []);
      setPendings(pends || []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('vito:datasync', handleSync);
    return () => window.removeEventListener('vito:datasync', handleSync);
  }, [loadData]);

  return {
    events,
    todos,
    pendings,
    loading,
    error,
    refresh: loadData,
  };
}
