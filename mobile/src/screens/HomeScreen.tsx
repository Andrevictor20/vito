import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { tokens } from '../theme/tokens';
import { Event, Todo, AssistantChatResponse } from '../types';
import { api } from '../services/api';
import { Header } from '../components/common/Header';
import { EventCard } from '../components/calendar/EventCard';
import { TodoItem } from '../components/todos/TodoItem';
import { AssistantBar } from '../components/assistant/AssistantBar';
import { AssistantResultModal } from '../components/assistant/AssistantResultModal';

export const HomeScreen: React.FC<{
  serverUrl: string;
  onToggleServer: () => void;
}> = ({ serverUrl, onToggleServer }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Assistant state
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResult, setAssistantResult] = useState<AssistantChatResponse | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [fetchedEvents, fetchedTodos] = await Promise.all([
        api.getEvents(),
        api.getTodos(),
      ]);
      setEvents(fetchedEvents);
      setTodos(fetchedTodos);
    } catch (e) {
      console.error('Falha ao carregar dados:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
        {/* Section: Timeline da Agenda */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Agenda de Hoje</Text>
          <Text style={styles.countBadge}>{events.length}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={tokens.colors.primary} style={{ marginVertical: 20 }} />
        ) : events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🗓️</Text>
            <Text style={styles.emptyText}>Nenhum compromisso marcado para hoje.</Text>
            <Text style={styles.emptySub}>
              Use a barra abaixo para falar ou digitar seu próximo evento!
            </Text>
          </View>
        ) : (
          events.map((ev) => (
            <EventCard key={ev.id} event={ev} onDelete={handleDeleteEvent} />
          ))
        )}

        {/* Section: Tarefas Pendentes */}
        <View style={[styles.sectionHeader, { marginTop: tokens.spacing.lg }]}>
          <Text style={styles.sectionTitle}>Tarefas & Lembretes</Text>
          <Text style={styles.countBadge}>{todos.length}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={tokens.colors.primary} style={{ marginVertical: 20 }} />
        ) : todos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⚡</Text>
            <Text style={styles.emptyText}>Tudo em dia! Nenhuma tarefa pendente.</Text>
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

      {/* Floating Toki Assistant Bar */}
      <AssistantBar onSubmit={handleAssistantSubmit} isLoading={assistantLoading} />

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
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyText: {
    color: tokens.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptySub: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
});
