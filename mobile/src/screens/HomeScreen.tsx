import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokens } from '../theme/tokens';
import { Event, Todo, AssistantChatResponse } from '../types';
import { api } from '../services/api';
import { Header } from '../components/common/Header';
import { CalendarView } from '../components/calendar/CalendarView';
import { EventCard } from '../components/calendar/EventCard';
import { TodoItem } from '../components/todos/TodoItem';
import { AssistantBar } from '../components/assistant/AssistantBar';
import { AssistantResultModal } from '../components/assistant/AssistantResultModal';

const CACHE_EVENTS_KEY = '@vito_cache_events';
const CACHE_TODOS_KEY = '@vito_cache_todos';

export const HomeScreen: React.FC<{
  serverUrl: string;
  onToggleServer: () => void;
}> = ({ serverUrl, onToggleServer }) => {
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

  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const dayEvents = events.filter((ev) => {
    const startDay = ev.start_at.substring(0, 10);
    const endDay = ev.end_at.substring(0, 10);
    return selectedDateStr >= startDay && selectedDateStr <= endDay;
  });
  const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();

  return (
    <View style={styles.container}>
      <Header serverUrl={serverUrl} onToggleServer={onToggleServer} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primary}
          />
        }
      >
        {/* Calendário Interativo do Mês */}
        <CalendarView
          events={events}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* Section: Timeline da Agenda */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isTodaySelected
              ? 'Agenda de Hoje'
              : `Agenda (${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`}
          </Text>
          <Text style={styles.countBadge}>{dayEvents.length}</Text>
        </View>

        {loading && events.length === 0 ? (
          <ActivityIndicator color={tokens.colors.primary} style={{ marginVertical: 20 }} />
        ) : dayEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIconSymbol}>📅</Text>
            </View>
            <View style={styles.emptyContent}>
              <Text style={styles.emptyTitle}>Dia Livre</Text>
              <Text style={styles.emptySub}>
                {isTodaySelected
                  ? 'Nenhum compromisso marcado para hoje.'
                  : `Nenhum compromisso marcado para ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.`}
              </Text>
            </View>
          </View>
        ) : (
          dayEvents.map((ev) => (
            <EventCard key={ev.id} event={ev} onDelete={handleDeleteEvent} />
          ))
        )}

        {/* Section: Tarefas Pendentes */}
        <View style={[styles.sectionHeader, { marginTop: tokens.spacing.lg }]}>
          <Text style={styles.sectionTitle}>Tarefas & Lembretes</Text>
          <Text style={styles.countBadge}>{todos.length}</Text>
        </View>

        {loading && todos.length === 0 ? (
          <ActivityIndicator color={tokens.colors.primary} style={{ marginVertical: 20 }} />
        ) : todos.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
              <Text style={styles.emptyIconSymbol}>⚡</Text>
            </View>
            <View style={styles.emptyContent}>
              <Text style={styles.emptyTitle}>Tudo em Dia</Text>
              <Text style={styles.emptySub}>Nenhuma tarefa pendente no momento.</Text>
            </View>
          </View>
        ) : (
          todos.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={handleToggleTodo}
              onDelete={handleDeleteTodo}
            />
          ))
        )}
      </ScrollView>

      {/* Floating Vito Assistant Bar */}
      <AssistantBar
        onSubmit={handleAssistantSubmit}
        onAudioSubmit={handleAssistantAudioSubmit}
        isLoading={assistantLoading}
      />

      {/* Result feedback Modal */}
      <AssistantResultModal
        visible={modalVisible}
        result={assistantResult}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.lg,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.textPrimary,
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    color: tokens.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.radii.full,
  },
  emptyCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: tokens.spacing.md,
  },
  emptyIconContainer: {
    width: 38,
    height: 38,
    borderRadius: tokens.radii.md,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconSymbol: {
    fontSize: 18,
  },
  emptyContent: {
    flex: 1,
  },
  emptyTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptySub: {
    color: tokens.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
