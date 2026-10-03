import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event, Todo, AssistantChatResponse } from '../types';
import { api } from '../services/api';

const CACHE_EVENTS_KEY = '@vito_cache_events';
const CACHE_TODOS_KEY = '@vito_cache_todos';

const formatLocalDate = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
      setEvents(fetchedEvents);
      setTodos(fetchedTodos);
      AsyncStorage.setItem(CACHE_EVENTS_KEY, JSON.stringify(fetchedEvents)).catch(() => {});
      AsyncStorage.setItem(CACHE_TODOS_KEY, JSON.stringify(fetchedTodos)).catch(() => {});
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
          setEvents(JSON.parse(eventsEntry[1]));
          hasCachedData = true;
        } catch {}
      }
      if (todosEntry && todosEntry[1]) {
        try {
          setTodos(JSON.parse(todosEntry[1]));
          hasCachedData = true;
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

  const handleDeleteEvent = async (id: string) => {
    try {
      await api.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      console.error('Erro ao deletar evento:', e);
    }
  };

  const handleToggleTodo = async (id: string) => {
    try {
      await api.completeTodo(id);
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'completed' as const } : t))
      );
    } catch (e) {
      console.error('Erro ao completar tarefa:', e);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await api.deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
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
      await loadData();
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
      await loadData();
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

  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    events.forEach((ev) => {
      try {
        const start = new Date(ev.start_at);
        const end = ev.end_at ? new Date(ev.end_at) : start;
        const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

        // Se o evento termina à meia-noite exata de um dia posterior, não colore o dia seguinte
        if (last > cur && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
          last.setDate(last.getDate() - 1);
        }

        while (cur <= last) {
          dates.add(formatLocalDate(cur));
          cur.setDate(cur.getDate() + 1);
        }
      } catch {}
    });
    return dates;
  }, [events]);

  const selectedDateStr = formatLocalDate(selectedDate);
  const dayEvents = events.filter((ev) => {
    try {
      const start = new Date(ev.start_at);
      const end = ev.end_at ? new Date(ev.end_at) : start;
      const startStr = formatLocalDate(start);
      let endStr = formatLocalDate(end);

      // Tratamento para término à meia-noite em eventos de dia inteiro do Google
      if (endStr > startStr && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
        const adj = new Date(end.getTime() - 1000);
        endStr = formatLocalDate(adj);
      }

      return selectedDateStr >= startStr && selectedDateStr <= endStr;
    } catch {
      return false;
    }
  });
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
    isTodaySelected,
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
  };
}
