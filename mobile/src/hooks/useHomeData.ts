import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event, Todo, AssistantChatResponse } from '../types';
import { api } from '../services/api';
import { notificationService } from '../services/notificationService';
import { dataSync } from '../services/dataSync';

import { toLocalDateString, parseSafeDate, isEventOnDate, getEventDays, getUpcomingGroupedEvents } from '../utils/calendarDateUtils';

export const getHomeCacheKeys = (userId?: string) => {
  const suffix = userId ? `_${userId}` : '';
  return {
    eventsKey: `@vito_cache_events${suffix}`,
    todosKey: `@vito_cache_todos${suffix}`,
  };
};

export function useHomeData(currentUserId?: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const syncedRemoteUserRef = useRef<string | null>(null);

  const cacheKeys = useMemo(() => getHomeCacheKeys(currentUserId), [currentUserId]);

  // Assistant state
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResult, setAssistantResult] = useState<AssistantChatResponse | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (!currentUserId || !api.getToken()) {
      setEvents([]);
      setTodos([]);
      setLoading(false);
      return;
    }

    if (!isSilent) setLoading(true);
    try {
      const [fetchedEvents, fetchedTodos] = await Promise.all([
        api.getEvents(),
        api.getTodos(),
      ]);
      setEvents(fetchedEvents || []);
      setTodos(fetchedTodos || []);
      AsyncStorage.setItem(cacheKeys.eventsKey, JSON.stringify(fetchedEvents || [])).catch(() => {});
      AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(fetchedTodos || [])).catch(() => {});
      // Purga órfãos primeiro (série deletada / Google inbound / outro device), depois agenda de forma idempotente.
      await notificationService.reconcileOrphanReminders(fetchedEvents || [], fetchedTodos || []).catch(() => {});
      if ((fetchedEvents && fetchedEvents.length > 0) || (fetchedTodos && fetchedTodos.length > 0)) {
        notificationService.scheduleAllUpcomingReminders(fetchedEvents || [], fetchedTodos || []).catch(() => {});
      }
    } catch (e: any) {
      if (e?.status === 401 || e?.message?.includes('autorização ausente') || e?.message?.includes('não autorizado')) {
        console.warn('[useHomeData] Sessão desautenticada ao carregar dados:', e?.message || e);
      } else {
        console.error('Falha ao carregar dados:', e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId, cacheKeys.eventsKey, cacheKeys.todosKey]);

  useEffect(() => {
    let isMounted = true;
    if (!currentUserId || !api.getToken()) {
      setEvents([]);
      setTodos([]);
      setLoading(false);
      return;
    }

    // 1. Hidratação Instantânea de Cache (< 5ms) da conta autenticada
    AsyncStorage.multiGet([cacheKeys.eventsKey, cacheKeys.todosKey]).then(([eventsEntry, todosEntry]) => {
      if (!isMounted) return;
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
    });

    // 2. Sincronização em background local + reconciliação inbound com Google Calendar da conta ativa
    loadData(true).then(() => {
      if (isMounted && syncedRemoteUserRef.current !== currentUserId) {
        syncedRemoteUserRef.current = currentUserId;
        api.syncCalendar('google')
          .then(() => {
            if (isMounted) loadData(true);
          })
          .catch(() => {});
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentUserId, cacheKeys.eventsKey, cacheKeys.todosKey, loadData]);

  useEffect(() => {
    const unsubEvents = dataSync.subscribe('refresh_events', () => loadData(true));
    const unsubTodos = dataSync.subscribe('refresh_todos', () => loadData(true));
    const unsubAll = dataSync.subscribe('refresh_all', () => loadData(true));
    return () => {
      unsubEvents();
      unsubTodos();
      unsubAll();
    };
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    api.syncCalendar('google')
      .catch(() => {})
      .finally(() => {
        loadData(false);
      });
  };

  const handleCreateEvent = async (eventData: { title: string; description?: string; location?: string; start_at: string; end_at: string }) => {
    try {
      const res = await api.createEvent(eventData);
      if (res?.event) {
        setEvents((prev) => {
          const next = [...prev, res.event];
          AsyncStorage.setItem(cacheKeys.eventsKey, JSON.stringify(next)).catch(() => {});
          return next;
        });
        notificationService.scheduleEventDualReminders(res.event).catch(() => {});
      }
      await loadData(true);
      // Reconciliação transparente em segundo plano com o Google Calendar
      api.syncCalendar('google').catch(() => {});
      return res;
    } catch (e) {
      console.error('Erro ao criar evento diretamente:', e);
      throw e;
    }
  };

  const handleCreateTodo = async (todoData: { title: string; priority?: string; category?: string; due_date?: string; remind_at?: string; remind_repeat?: string; remind_advance_minutes?: number; event_id?: string; event_title?: string }) => {
    try {
      const newTodo = await api.createTodo(todoData);
      if (newTodo) {
        setTodos((prev) => {
          const next = [...prev, newTodo];
          AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(next)).catch(() => {});
          return next;
        });
        notificationService.scheduleTodoReminder(newTodo).catch(() => {});
        if (newTodo.remind_at) {
          notificationService.schedulePendingReminder(newTodo).catch(() => {});
        }
      }
      await loadData(true);
      return newTodo;
    } catch (e) {
      console.error('Erro ao criar tarefa diretamente:', e);
      throw e;
    }
  };

  const handleUpdateTodo = async (id: string, todoData: { title?: string; priority?: string; category?: string; due_date?: string; remind_at?: string; remind_repeat?: string; remind_advance_minutes?: number }) => {
    try {
      const updated = await api.updateTodo(id, todoData);
      if (updated) {
        setTodos((prev) => {
          const next = prev.map((t) => (t.id === id ? { ...t, ...updated } : t));
          AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(next)).catch(() => {});
          return next;
        });
        notificationService.cancelTodoReminder(id).catch(() => {});
        if (updated.status !== 'completed') {
          notificationService.scheduleTodoReminder(updated).catch(() => {});
          if (updated.remind_at) {
            notificationService.schedulePendingReminder(updated).catch(() => {});
          }
        }
      }
      await loadData(true);
      return updated;
    } catch (e) {
      console.error('Erro ao atualizar tarefa diretamente:', e);
      throw e;
    }
  };

  const handleDeleteEvent = async (id: string, allSeries: boolean = false) => {
    const previousEvents = events;
    const targetEvent = events.find((e) => e.id === id);
    let seriesIds: string[] = [id];
    if (allSeries && targetEvent) {
      const targetTitle = targetEvent.title.trim().toLowerCase();
      seriesIds = events
        .filter((e) => e.title.trim().toLowerCase() === targetTitle || e.id === id)
        .map((e) => e.id);
      if (seriesIds.length === 0) seriesIds = [id];
    }

    // 1. Optimistic Update instantâneo (< 16ms)
    let nextEvents: Event[];
    if (allSeries && targetEvent) {
      const targetTitle = targetEvent.title.trim().toLowerCase();
      nextEvents = events.filter((e) => e.title.trim().toLowerCase() !== targetTitle && e.id !== id);
    } else {
      nextEvents = events.filter((e) => e.id !== id);
    }
    setEvents(nextEvents);
    AsyncStorage.setItem(cacheKeys.eventsKey, JSON.stringify(nextEvents)).catch(() => {});
    notificationService.reconcileOrphanReminders(nextEvents, todos).catch(() => {});

    try {
      await api.deleteEvent(id, allSeries);
      notificationService.cancelEventReminders(seriesIds).catch(() => {});
      dataSync.notify('refresh_events');
      if (allSeries) {
        loadData(true);
      }
    } catch (e) {
      console.error('Erro ao deletar evento, revertendo:', e);
      setEvents(previousEvents);
      AsyncStorage.setItem(cacheKeys.eventsKey, JSON.stringify(previousEvents)).catch(() => {});
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
          AsyncStorage.setItem(cacheKeys.eventsKey, JSON.stringify(next)).catch(() => {});
          return next;
        });
        notificationService.scheduleEventDualReminders(res.event).catch(() => {});
      }
      return res;
    } catch (e) {
      console.error('Erro ao atualizar evento:', e);
      throw e;
    }
  };

  const handleToggleTodo = async (id: string) => {
    const current = todos.find((t) => t.id === id);
    if (!current) return;
    const reopening = current.status === 'completed';
    const nextStatus = reopening ? ('pending' as const) : ('completed' as const);

    // 1. Optimistic Update instantâneo (< 16ms)
    const previousTodos = todos;
    const nextTodos = todos.map((t) =>
      t.id === id ? { ...t, status: nextStatus } : t
    );
    setTodos(nextTodos);
    AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(nextTodos)).catch(() => {});

    try {
      if (reopening) {
        await api.reopenTodo(id);
      } else {
        await api.completeTodo(id);
        notificationService.cancelTodoReminder(id).catch(() => {});
      }
      dataSync.notify('refresh_todos');
    } catch (e) {
      console.error('Erro ao alternar tarefa, revertendo:', e);
      setTodos(previousTodos);
      AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(previousTodos)).catch(() => {});
    }
  };

  const handleDeleteTodo = async (id: string) => {
    const previousTodos = todos;
    const target = todos.find((t) => t.id === id);
    if (!target) return;

    // 1. Optimistic Update instantâneo
    const nextTodos = todos.filter((t) => t.id !== id);
    setTodos(nextTodos);
    AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(nextTodos)).catch(() => {});

    try {
      await api.deleteTodo(id);
      notificationService.cancelTodoReminder(id).catch(() => {});
      dataSync.notify('refresh_todos');
    } catch (e) {
      console.error('Erro ao deletar tarefa, revertendo:', e);
      setTodos(previousTodos);
      AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(previousTodos)).catch(() => {});
    }
  };

  const handleToggleSubtask = async (todoId: string, subtaskId: string) => {
    const previousTodos = todos;
    const nextTodos = todos.map((t) => {
      if (t.id !== todoId) return t;
      const subtasks = (t.subtasks || []).map((st) =>
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
      );
      return { ...t, subtasks };
    });
    setTodos(nextTodos);
    AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(nextTodos)).catch(() => {});

    try {
      const updated = await api.toggleSubtask(todoId, subtaskId);
      setTodos((prev) => {
        const confirmed = prev.map((t) => {
          if (t.id !== todoId) return t;
          const subtasks = (t.subtasks || []).map((st) =>
            st.id === subtaskId ? { ...st, completed: updated.completed } : st
          );
          return { ...t, subtasks };
        });
        AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(confirmed)).catch(() => {});
        return confirmed;
      });
      dataSync.notify('refresh_todos');
    } catch (e) {
      console.error('Erro ao alternar subtarefa, revertendo:', e);
      setTodos(previousTodos);
      AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(previousTodos)).catch(() => {});
    }
  };

  const handleAddSubtask = async (todoId: string, title: string) => {
    try {
      const newSubtask = await api.addSubtask(todoId, title);
      setTodos((prev) => {
        const next = prev.map((t) => {
          if (t.id !== todoId) return t;
          const subtasks = [...(t.subtasks || []), newSubtask];
          return { ...t, subtasks };
        });
        AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
      dataSync.notify('refresh_todos');
    } catch (e) {
      console.error('Erro ao adicionar subtarefa:', e);
    }
  };

  const handleDeleteSubtask = async (todoId: string, subtaskId: string) => {
    const previousTodos = todos;
    const nextTodos = todos.map((t) => {
      if (t.id !== todoId) return t;
      const subtasks = (t.subtasks || []).filter((st) => st.id !== subtaskId);
      return { ...t, subtasks };
    });
    setTodos(nextTodos);
    AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(nextTodos)).catch(() => {});

    try {
      await api.deleteSubtask(todoId, subtaskId);
      dataSync.notify('refresh_todos');
    } catch (e) {
      console.error('Erro ao excluir subtarefa, revertendo:', e);
      setTodos(previousTodos);
      AsyncStorage.setItem(cacheKeys.todosKey, JSON.stringify(previousTodos)).catch(() => {});
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
  const upcomingEvents = useMemo(() => getUpcomingGroupedEvents(events), [events]);

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
    handleUpdateTodo,
    handleDeleteEvent,
    handleToggleTodo,
    handleDeleteTodo,
    handleToggleSubtask,
    handleAddSubtask,
    handleDeleteSubtask,
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
