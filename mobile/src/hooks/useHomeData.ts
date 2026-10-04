import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event, Todo, AssistantChatResponse } from '../types';
import { api } from '../services/api';

import { toLocalDateString, parseSafeDate, isEventOnDate, getEventDays } from '../utils/calendarDateUtils';

const CACHE_EVENTS_KEY = '@vito_cache_events';
const CACHE_TODOS_KEY = '@vito_cache_todos';

export function useHomeData() {
  const [events, setEvents] = useState<Event[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Assistant state
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResult, setAssistantResult] = useState<AssistantChatResponse | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [fetchedEvents, fetchedTodos] = await Promise.all([
        api.getEvents(),
        api.getTodos(),
      ]);
      setEvents(fetchedEvents || []);
      setTodos(fetchedTodos || []);
      AsyncStorage.setItem(CACHE_EVENTS_KEY, JSON.stringify(fetchedEvents || [])).catch(() => {});
      AsyncStorage.setItem(CACHE_TODOS_KEY, JSON.stringify(fetchedTodos || [])).catch(() => {});
    } catch (e) {
      console.error('Falha ao carregar dados:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // 1. Hidratação Instantânea de Cache (< 5ms)
    AsyncStorage.multiGet([CACHE_EVENTS_KEY, CACHE_TODOS_KEY]).then(([eventsEntry, todosEntry]) => {
      let hasCachedData = false;
      if (eventsEntry && eventsEntry[1]) {
        try {
          const parsed = JSON.parse(eventsEntry[1]);
          if (Array.isArray(parsed)) {
            setEvents(parsed);
            hasCachedData = true;
          }
        } catch {}
      }
      if (todosEntry && todosEntry[1]) {
        try {
          const parsed = JSON.parse(todosEntry[1]);
          if (Array.isArray(parsed)) {
            setTodos(parsed);
            hasCachedData = true;
          }
        } catch {}
      }
      if (hasCachedData) {
        setLoading(false);
      }
      // 2. Revalidação silenciosa em background (Stale-While-Revalidate)
      loadData(hasCachedData);
    });
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleCreateEvent = async (eventData: { title: string; description?: string; location?: string; start_at: string; end_at: string }) => {
    try {
      const res = await api.createEvent(eventData);
      if (res?.event) {
        setEvents((prev) => {
          const next = [...prev, res.event];
          AsyncStorage.setItem(CACHE_EVENTS_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      }
      await loadData(true);
      return res;
    } catch (e) {
      console.error('Erro ao criar evento diretamente:', e);
      throw e;
    }
  };

  const handleCreateTodo = async (todoData: { title: string; priority: string; due_date?: string }) => {
    try {
      const newTodo = await api.createTodo(todoData);
      if (newTodo) {
        setTodos((prev) => {
          const next = [...prev, newTodo];
          AsyncStorage.setItem(CACHE_TODOS_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      }
      await loadData(true);
      return newTodo;
    } catch (e) {
      console.error('Erro ao criar tarefa diretamente:', e);
      throw e;
    }
  };

  const handleDeleteEvent = async (id: string, allSeries: boolean = false) => {
    try {
      const targetEvent = events.find((e) => e.id === id);
      await api.deleteEvent(id, allSeries);
      setEvents((prev) => {
        let next: Event[];
        if (allSeries && targetEvent) {
          const targetTitle = targetEvent.title.trim().toLowerCase();
          next = prev.filter((e) => e.title.trim().toLowerCase() !== targetTitle && e.id !== id);
        } else {
          next = prev.filter((e) => e.id !== id);
        }
        AsyncStorage.setItem(CACHE_EVENTS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      // Revalida em background para garantir integridade com o backend
      if (allSeries) {
        loadData(true);
      }
    } catch (e) {
      console.error('Erro ao deletar evento:', e);
      throw e;
    }
  };

  const handleUpdateEvent = async (id: string, eventData: Partial<Event> & { update_series?: boolean }) => {
    try {
      const res = await api.updateEvent(id, eventData);
      if (eventData.update_series) {
        await loadData(true);
      } else if (res?.event) {
        setEvents((prev) => {
          const next = prev.map((e) => (e.id === id ? { ...e, ...res.event } : e));
          AsyncStorage.setItem(CACHE_EVENTS_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      }
      return res;
    } catch (e) {
      console.error('Erro ao atualizar evento:', e);
      throw e;
    }
  };

  const handleToggleTodo = async (id: string) => {
    try {
      await api.completeTodo(id);
      setTodos((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, status: 'completed' as const } : t));
        AsyncStorage.setItem(CACHE_TODOS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    } catch (e) {
      console.error('Erro ao completar tarefa:', e);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await api.deleteTodo(id);
      setTodos((prev) => {
        const next = prev.filter((t) => t.id !== id);
        AsyncStorage.setItem(CACHE_TODOS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    } catch (e) {
      console.error('Erro ao deletar tarefa:', e);
    }
  };

  const handleAssistantSubmit = async (prompt: string) => {
    setAssistantLoading(true);
    try {
      const res = await api.assistantChat(prompt);
      setAssistantResult(res);
      setModalVisible(true);
      await loadData(true);
    } catch (e: any) {
      setAssistantResult({
        intent: 'error',
        reply: `Desculpe, ocorreu um erro ao processar sua instrução: ${e?.message || 'Falha de comunicação'}`,
        action_performed: 'none',
      });
      setModalVisible(true);
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleAssistantAudioSubmit = async (audioUri: string) => {
    setAssistantLoading(true);
    try {
      const res = await api.assistantAudio(audioUri);
      setAssistantResult(res);
      setModalVisible(true);
      await loadData(true);
    } catch (e: any) {
      setAssistantResult({
        intent: 'error',
        reply: `Desculpe, ocorreu um erro ao transcrever ou processar seu áudio: ${e?.message || 'Falha de comunicação'}`,
        action_performed: 'none',
      });
      setModalVisible(true);
    } finally {
      setAssistantLoading(false);
    }
  };

  const [syncingGoogle, setSyncingGoogle] = useState(false);

  const syncGoogleCalendar = useCallback(async () => {
    setSyncingGoogle(true);
    try {
      await api.syncCalendar('google');
      await loadData(true);
    } catch (e) {
      console.warn('[useHomeData] Erro ao sincronizar Google Calendar:', e);
      throw e;
    } finally {
      setSyncingGoogle(false);
    }
  }, [loadData]);

  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    events.forEach((ev) => {
      const days = getEventDays(ev);
      days.forEach((d) => dates.add(d));
    });
    return dates;
  }, [events]);

  const dayEvents = useMemo(() => {
    return events.filter((ev) => isEventOnDate(ev, selectedDate));
  }, [events, selectedDate]);

  // Próximos eventos a partir de hoje em ordem cronológica (com agrupamento inteligente de séries recorrentes)
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureEvents = events
      .filter((ev) => {
        try {
          const end = ev.end_at ? parseSafeDate(ev.end_at) : parseSafeDate(ev.start_at);
          return end.getTime() >= today.getTime();
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const tA = parseSafeDate(a.start_at).getTime();
        const tB = parseSafeDate(b.start_at).getTime();
        return tA - tB;
      });

    // Detecta quantas ocorrências futuras existem por título/padrão
    const titleCounts = new Map<string, number>();
    for (const ev of futureEvents) {
      const key = ev.title.trim().toLowerCase();
      titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
    }

    // Agrupa para que cada série recorrente apareça apenas como um compromisso único próximo
    const seenSeries = new Set<string>();
    const grouped: Event[] = [];

    for (const ev of futureEvents) {
      const key = ev.title.trim().toLowerCase();
      const isSeries = (titleCounts.get(key) || 0) > 1 || !!ev.recurrence;

      if (isSeries) {
        if (!seenSeries.has(key)) {
          seenSeries.add(key);
          grouped.push({
            ...ev,
            is_recurring: true,
          });
        }
      } else {
        grouped.push(ev);
      }
    }

    return grouped;
  }, [events]);

  const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();

  return {
    events,
    todos,
    loading,
    refreshing,
    onRefresh,
    selectedDate,
    setSelectedDate,
    dayEvents,
    upcomingEvents,
    eventDates,
    isTodaySelected,
    handleCreateEvent,
    handleUpdateEvent,
    handleCreateTodo,
    handleDeleteEvent,
    handleToggleTodo,
    handleDeleteTodo,
    assistantLoading,
    assistantResult,
    modalVisible,
    setModalVisible,
    handleAssistantSubmit,
    handleAssistantAudioSubmit,
    loadData,
    syncGoogleCalendar,
    syncingGoogle,
  };
}
