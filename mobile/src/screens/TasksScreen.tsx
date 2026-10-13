import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { Todo } from '../types';
import { TodoItem } from '../components/todos/TodoItem';
import { PendingItemsView } from './PendingItemsView';

type TasksSegment = 'todos' | 'pending';

interface TasksScreenProps {
  todos: Todo[];
  pendingTodos: Todo[];
  completedTodosList: Todo[];
  completedCount: number;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onToggleSubtask: (todoId: string, subtaskId: string) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onDeleteSubtask: (todoId: string, subtaskId: string) => void;
  onCreateTodo: () => void;
  onOpenEventCreate?: (title: string, date?: string) => void;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({
  todos,
  pendingTodos,
  completedTodosList,
  completedCount,
  loading,
  refreshing,
  onRefresh,
  onToggleTodo,
  onDeleteTodo,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onCreateTodo,
  onOpenEventCreate,
}) => {
  const { colors, isDark } = useTheme();
  const [segment, setSegment] = useState<TasksSegment>('todos');
  const [showCompletedTodos, setShowCompletedTodos] = useState(false);

  const handleSegmentChange = (next: TasksSegment) => {
    if (next !== segment) hapticFeedback.selection();
    setSegment(next);
  };

  const segmentBtn = (active: boolean) => [
    styles.segmentBtn,
    {
      backgroundColor: active
        ? (isDark ? colors.surfaceContainerHighest : colors.primary)
        : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
      borderColor: active ? 'transparent' : colors.outlineVariant,
    },
    active && styles.segmentBtnActive,
  ];

  const segmentContent = (active: boolean) => ({
    color: active ? (isDark ? colors.onSurface : colors.onPrimary) : colors.onSurfaceVariant,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Seletor Segmentado Tarefas vs Pendências */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          style={segmentBtn(segment === 'todos')}
          onPress={() => handleSegmentChange('todos')}
          activeOpacity={0.75}
          accessibilityRole="tab"
          accessibilityState={{ selected: segment === 'todos' }}
          accessibilityLabel="Ver tarefas"
        >
          <MaterialIcons
            name="check-circle-outline"
            size={16}
            color={segmentContent(segment === 'todos').color}
          />
          <Text
            style={[
              styles.segmentText,
              segmentContent(segment === 'todos'),
              segment === 'todos' && styles.segmentTextActive,
            ]}
          >
            Tarefas ({pendingTodos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={segmentBtn(segment === 'pending')}
          onPress={() => handleSegmentChange('pending')}
          activeOpacity={0.75}
          accessibilityRole="tab"
          accessibilityState={{ selected: segment === 'pending' }}
          accessibilityLabel="Ver pendências"
        >
          <MaterialIcons
            name="inbox"
            size={16}
            color={segmentContent(segment === 'pending').color}
          />
          <Text
            style={[
              styles.segmentText,
              segmentContent(segment === 'pending'),
              segment === 'pending' && styles.segmentTextActive,
            ]}
          >
            Pendências
          </Text>
        </TouchableOpacity>
      </View>

      {segment === 'todos' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Tarefas</Text>
              <Text style={[styles.checklistSubtitle, { color: colors.textMuted }]}>
                {completedCount}/{todos.length} concluídas
              </Text>
            </View>
          </View>

          {loading && todos.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : pendingTodos.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
                <MaterialIcons name="done-all" size={20} color={colors.success} />
              </View>
              <View style={styles.emptyContent}>
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Tudo em Dia</Text>
                <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>Nenhuma tarefa pendente no momento.</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.checklistCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
              {pendingTodos.map((t, idx) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  onToggle={onToggleTodo}
                  onDelete={onDeleteTodo}
                  onToggleSubtask={onToggleSubtask}
                  onAddSubtask={onAddSubtask}
                  onDeleteSubtask={onDeleteSubtask}
                  isLast={idx === pendingTodos.length - 1}
                  grouped
                />
              ))}
            </View>
          )}

          {/* Gaveta Colapsável de Concluídas */}
          {completedTodosList.length > 0 && (
            <View style={styles.completedSectionWrapper}>
              <TouchableOpacity
                style={[
                  styles.completedSectionToggle,
                  {
                    backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => setShowCompletedTodos(!showCompletedTodos)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Alternar visualização de tarefas concluídas"
              >
                <View style={styles.completedToggleLeft}>
                  <MaterialIcons name="done-all" size={16} color={colors.accents.emerald} />
                  <Text style={[styles.completedToggleText, { color: colors.onSurfaceVariant }]}>
                    Concluídas ({completedTodosList.length})
                  </Text>
                </View>
                <MaterialIcons
                  name={showCompletedTodos ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </TouchableOpacity>

              {showCompletedTodos && (
                <View
                  style={[
                    styles.checklistCard,
                    {
                      backgroundColor: colors.surfaceContainer,
                      borderColor: colors.outlineVariant,
                      borderWidth: 1,
                      marginTop: 8,
                      opacity: 0.85,
                    },
                  ]}
                >
                  {completedTodosList.map((t, idx) => (
                    <TodoItem
                      key={t.id}
                      todo={t}
                      onToggle={onToggleTodo}
                      onDelete={onDeleteTodo}
                      onToggleSubtask={onToggleSubtask}
                      onAddSubtask={onAddSubtask}
                      onDeleteSubtask={onDeleteSubtask}
                      isLast={idx === completedTodosList.length - 1}
                      grouped
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Botão de Criação Rápida de Tarefa */}
          <View style={styles.createBtnWrapper}>
            <TouchableOpacity
              style={[styles.createFab, { backgroundColor: colors.primary }]}
              onPress={() => {
                hapticFeedback.medium();
                onCreateTodo();
              }}
              activeOpacity={0.85}
              accessibilityLabel="Criar nova tarefa"
            >
              <MaterialIcons name="add" size={22} color={colors.onPrimary} />
              <Text style={[styles.createFabText, { color: colors.onPrimary }]}>Nova Tarefa</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.pendingWrapper}>
          <PendingItemsView onOpenEventCreate={onOpenEventCreate} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedContainer: {
    flexDirection: 'row',
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    gap: 0,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    gap: 6,
  },
  segmentBtnActive: {
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 110,
  },
  sectionHeader: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  checklistSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  checklistCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: tokens.spacing.md,
    gap: 12,
  },
  emptyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContent: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12,
    marginTop: 2,
  },
  completedSectionWrapper: {
    marginTop: tokens.spacing.md,
  },
  completedSectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  completedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  createBtnWrapper: {
    marginTop: tokens.spacing.md,
    alignItems: 'center',
  },
  createFab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    elevation: 3,
  },
  createFabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pendingWrapper: {
    flex: 1,
  },
});
