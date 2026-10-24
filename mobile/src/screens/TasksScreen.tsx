import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import type { Todo, PendingItem } from '../types';
import { TaskRow } from '../components/tasks/TaskRow';
import { TaskSheet, TaskPayload } from '../components/tasks/TaskSheet';
import { TaskFilterChips } from '../components/tasks/TaskFilterChips';
import { VitoSuggestionCard } from '../components/tasks/VitoSuggestionCard';
import { TaskGroupHeader } from '../components/tasks/TaskGroupHeader';
import { CompletedAccordion } from '../components/tasks/CompletedAccordion';
import { TaskFilterModal, PriorityFilter } from '../components/tasks/TaskFilterModal';
import { usePendingItems } from '../hooks/usePendingItems';
import { toUnifiedRows, sortUnifiedRows, TaskSort, UnifiedRow } from '../utils/unifiedTasks';
import {
  TaskFilterType,
  computeChipCounts,
  groupTasksByBucket,
  getRowDateStr,
  getTaskBucket,
} from '../utils/taskBuckets';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface TasksScreenProps {
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
  onSaveTodoFull: (input: {
    title: string;
    priority?: string;
    category?: string;
    due_date?: string;
    remind_at?: string;
    remind_repeat?: string;
    remind_advance_minutes?: number;
  }) => Promise<any>;
  onUpdateTodoFull: (id: string, input: {
    title?: string;
    priority?: string;
    category?: string;
    due_date?: string;
    remind_at?: string;
    remind_repeat?: string;
    remind_advance_minutes?: number;
  }) => Promise<any>;
  onOpenEventCreate?: (title: string, date?: string) => void;
  createRequestId?: number;
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  searchOpen?: boolean;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({
  todos,
  pendingTodos,
  completedTodosList,
  loading,
  refreshing,
  onRefresh,
  onToggleTodo,
  onDeleteTodo,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onSaveTodoFull,
  onUpdateTodoFull,
  onOpenEventCreate,
  createRequestId,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
  searchOpen: externalSearchOpen,
}) => {
  const { colors, isDark } = useTheme();

  const [activeFilter, setActiveFilter] = useState<TaskFilterType>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [sort, setSort] = useState<TaskSort>('date');
  const [internalQuery, setInternalQuery] = useState('');
  const [internalSearchOpen, setInternalSearchOpen] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [convertingPending, setConvertingPending] = useState<PendingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [vitoDismissed, setVitoDismissed] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  const pending = usePendingItems(onOpenEventCreate);

  const query = (externalSearchQuery !== undefined ? externalSearchQuery : internalQuery).trim().toLowerCase();
  const isSearchOpen = externalSearchOpen !== undefined ? externalSearchOpen : internalSearchOpen;

  const handleQueryChange = (text: string) => {
    if (externalOnSearchChange) externalOnSearchChange(text);
    else setInternalQuery(text);
  };

  // CTA (+ Nova tarefa): abre o sheet em modo criação
  const firstCreateRender = useRef(true);
  useEffect(() => {
    if (firstCreateRender.current) {
      firstCreateRender.current = false;
      return;
    }
    if ((createRequestId ?? 0) > 0) {
      setEditingTodo(null);
      setConvertingPending(null);
      setSaveError(null);
      setSheetVisible(true);
    }
  }, [createRequestId]);

  const now = Date.now();
  const rawRows = useMemo(
    () => toUnifiedRows([...pendingTodos, ...completedTodosList], pending.items, now),
    [pendingTodos, completedTodosList, pending.items, now],
  );

  const activeRows = useMemo(() => {
    let list = rawRows.filter((r) => !r.done);
    if (priorityFilter !== 'all') {
      list = list.filter((r) => r.priority === priorityFilter);
    }
    if (sort !== 'date') {
      list = sortUnifiedRows(list, sort);
    }
    return list;
  }, [rawRows, priorityFilter, sort]);

  const doneRows = useMemo(() => rawRows.filter((r) => r.done), [rawRows]);

  const chipCounts = useMemo(() => computeChipCounts(rawRows, now), [rawRows, now]);

  const taskGroups = useMemo(
    () => groupTasksByBucket(activeRows, activeFilter, query, now),
    [activeRows, activeFilter, query, now],
  );

  const overdueRows = useMemo(
    () => activeRows.filter((r) => getTaskBucket(getRowDateStr(r), now) === 'atr'),
    [activeRows, now],
  );

  const showVitoSuggestion =
    !vitoDismissed &&
    overdueRows.length > 0 &&
    activeFilter === 'all' &&
    !query;

  // Reagendar todas as tarefas atrasadas para a data de hoje
  const handleRescheduleAllOverdue = useCallback(async () => {
    setRescheduling(true);
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const updates = overdueRows.map(async (row) => {
        if (row.kind === 'todo' && row.sourceTodo) {
          return onUpdateTodoFull(row.sourceTodo.id, { due_date: todayISO });
        }
        if (row.sourcePending) {
          return pending.schedule(row.sourcePending, todayISO);
        }
      });
      await Promise.all(updates);
      setVitoDismissed(true);
      hapticFeedback.success();
    } catch (err) {
      console.warn('[TasksScreen] Falha ao reagendar atrasadas:', err);
    } finally {
      setRescheduling(false);
    }
  }, [overdueRows, onUpdateTodoFull, pending]);

  const handleOpenEdit = useCallback((row: UnifiedRow) => {
    if (row.kind === 'todo' && row.sourceTodo) {
      setEditingTodo(row.sourceTodo);
      setConvertingPending(null);
      setSaveError(null);
      setSheetVisible(true);
    } else if (row.sourcePending) {
      const p = row.sourcePending;
      setConvertingPending(p);
      setEditingTodo({
        id: p.id,
        user_id: '',
        title: p.title,
        priority: 'medium',
        category: p.category || 'geral',
        status: 'pending',
        due_date: p.scheduled_date ? `${p.scheduled_date}T09:00:00` : undefined,
        remind_at: p.remind_at || undefined,
        remind_repeat: p.remind_repeat || 'none',
        remind_advance_minutes: p.remind_advance_minutes || 0,
        created_at: '',
      } as Todo);
      setSaveError(null);
      setSheetVisible(true);
    }
  }, []);

  const handleToggleRow = useCallback((row: UnifiedRow) => {
    if (row.kind === 'todo' && row.sourceTodo) {
      onToggleTodo(row.sourceTodo.id);
    } else if (row.sourcePending) {
      pending.toggleComplete(row.sourcePending);
    }
  }, [onToggleTodo, pending]);

  const handleDeleteRow = useCallback((row: UnifiedRow) => {
    if (row.kind === 'todo' && row.sourceTodo) {
      onDeleteTodo(row.sourceTodo.id);
    } else if (row.sourcePending) {
      pending.remove(row.sourcePending.id);
    }
  }, [onDeleteTodo, pending]);

  const handleSave = async (payload: TaskPayload) => {
    setSaving(true);
    setSaveError(null);
    try {
      const input = {
        title: payload.title,
        priority: payload.priority,
        category: payload.category,
        due_date: payload.dateISO,
        remind_at: payload.remind_at,
        remind_repeat: payload.remind_repeat,
        remind_advance_minutes: payload.remind_advance_minutes,
      };
      if (editingTodo && !convertingPending) {
        await onUpdateTodoFull(editingTodo.id, input);
      } else if (convertingPending) {
        await onSaveTodoFull(input);
        await pending.remove(convertingPending.id);
      } else {
        await onSaveTodoFull(input);
      }
      setSheetVisible(false);
      setEditingTodo(null);
      setConvertingPending(null);
    } catch (err) {
      console.warn('[TasksScreen] Falha ao salvar tarefa:', err);
      setSaveError('Não foi possível salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSheet = async (id: string) => {
    try {
      if (convertingPending) await pending.remove(convertingPending.id);
      else onDeleteTodo(id);
      setSheetVisible(false);
      setEditingTodo(null);
      setConvertingPending(null);
    } catch (err) {
      setSaveError('Não foi possível excluir. Tente de novo.');
    }
  };

  const initialLoading = loading && todos.length === 0 && pending.loading && pending.items.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Barra de busca retrátil se não fornecida externamente */}
      {isSearchOpen && externalSearchOpen === undefined && (
        <View style={styles.searchSection}>
          <View style={[styles.searchBar, { backgroundColor: colors.surf, borderColor: colors.line }]}>
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.ink }]}
              value={internalQuery}
              onChangeText={handleQueryChange}
              placeholder="Pesquisar tarefas..."
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              accessibilityLabel="Pesquisar tarefas"
              autoFocus
            />
            {internalQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => handleQueryChange('')}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Limpar busca"
              >
                <MaterialIcons name="close" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Faixa de chips horizontais (.chips) */}
      <TaskFilterChips
        selectedFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        counts={chipCounts}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing || pending.refreshing}
            onRefresh={() => {
              onRefresh();
              pending.refresh();
            }}
            tintColor={colors.ink}
          />
        }
      >
        {/* Card de sugestão inteligente do Vito (.vsug) */}
        {showVitoSuggestion && (
          <VitoSuggestionCard
            overdueCount={overdueRows.length}
            onReschedule={handleRescheduleAllOverdue}
            onDismiss={() => setVitoDismissed(true)}
            loading={rescheduling}
          />
        )}

        {/* Indicador de carregamento */}
        {initialLoading ? (
          <ActivityIndicator color={colors.ink} style={{ marginVertical: 32 }} />
        ) : taskGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {query ? 'Nenhuma tarefa encontrada para esta busca.' : 'Nenhuma tarefa aqui.'}
            </Text>
          </View>
        ) : (
          /* Grupos por prazo (.grp) */
          taskGroups.map((group) => (
            <View key={`group-${group.bucket}`} style={styles.groupBlock}>
              <TaskGroupHeader
                bucket={group.bucket}
                title={group.label}
                count={group.rows.length}
              />
              <View style={styles.groupList}>
                {group.rows.map((row, idx) => (
                  <TaskRow
                    key={`task-${row.kind}-${row.id}`}
                    row={row}
                    isFirst={idx === 0}
                    onToggle={() => handleToggleRow(row)}
                    onDelete={() => handleDeleteRow(row)}
                    onEdit={() => handleOpenEdit(row)}
                    subtasks={row.sourceTodo?.subtasks}
                    onToggleSubtask={(sid) => row.sourceTodo && onToggleSubtask(row.sourceTodo.id, sid)}
                    onAddSubtask={(title) => row.sourceTodo && onAddSubtask(row.sourceTodo.id, title)}
                    onDeleteSubtask={(sid) => row.sourceTodo && onDeleteSubtask(row.sourceTodo.id, sid)}
                    onSchedule={(dateStr) => row.sourcePending && pending.schedule(row.sourcePending, dateStr)}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {/* Acordeão de tarefas concluídas (.dn e .dl) */}
        <CompletedAccordion
          completedRows={doneRows}
          onToggleRow={handleToggleRow}
          onEditRow={handleOpenEdit}
          onDeleteRow={handleDeleteRow}
        />
      </ScrollView>

      {/* Modal de filtros adicionais (Prioridade e Ordenação) */}
      <TaskFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        priorityFilter={priorityFilter}
        onSelectPriority={setPriorityFilter}
        sort={sort}
        onSelectSort={setSort}
        onReset={() => {
          setPriorityFilter('all');
          setSort('date');
          setActiveFilter('all');
          handleQueryChange('');
        }}
        activeCount={activeRows.length}
      />

      {/* Sheet de Criação / Edição de Tarefas */}
      <TaskSheet
        visible={sheetVisible}
        editingTodo={editingTodo}
        saving={saving}
        error={saveError}
        onClose={() => {
          setSheetVisible(false);
          setEditingTodo(null);
          setConvertingPending(null);
        }}
        onSave={handleSave}
        onDelete={handleDeleteSheet}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: tokens.typography.family.regular,
    paddingVertical: 8,
  },
  groupBlock: {
    marginTop: 6,
  },
  groupList: {
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: tokens.typography.family.regular,
  },
});
