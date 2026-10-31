import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { CalendarEvent } from '../types';

export function useCalendarSync() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getEvents();
      setEvents(data || []);
      return data || [];
    } catch (e) {
      console.error('[useCalendarSync] Falha ao buscar eventos:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerSync = useCallback(async (provider = 'google') => {
    try {
      setSyncing(true);
      await api.syncCalendar(provider);
      await fetchEvents();
    } catch (e) {
      console.error('[useCalendarSync] Falha ao sincronizar:', e);
      throw e;
    } finally {
      setSyncing(false);
    }
  }, [fetchEvents]);

  const createEvent = useCallback(async (eventData: Partial<CalendarEvent>) => {
    try {
      const created = await api.createEvent(eventData);
      setEvents((prev) => [...prev, created]);
      return created;
    } catch (e) {
      console.error('[useCalendarSync] Falha ao criar evento:', e);
      throw e;
    }
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    try {
      await api.deleteEvent(id);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } catch (e) {
      console.error('[useCalendarSync] Falha ao excluir evento:', e);
      throw e;
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    setEvents,
    syncing,
    loading,
    refresh: fetchEvents,
    fetchEvents,
    syncCalendar: triggerSync,
    createEvent,
    deleteEvent,
  };
}
