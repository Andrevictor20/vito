import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import type { Todo } from '../types';
import { TaskRow } from '../components/tasks/TaskRow';
import { TaskFilterChips } from '../components/tasks/TaskFilterChips';
import { TaskListChips } from '../components/tasks/TaskListChips';
import { DailyTasksSummaryCard } from '../components/tasks/DailyTasksSummaryCard';
import { TaskQuickAddSheet } from '../components/tasks/TaskQuickAddSheet';
import { TaskDetailSheet } from '../components/tasks/TaskDetailSheet';
import { TaskGroupHeader } from '../components/tasks/TaskGroupHeader';
import { CompletedAccordion } from '../components/tasks/CompletedAccordion';
import { VitoMascot } from '../components/common/VitoMascot';
import { usePendingItems } from '../hooks/usePendingItems';
import { toUnifiedRows, sortUnifiedRows, TaskSort, UnifiedRow } from '../utils/unifiedTasks';
import { DEFAULT_TASK_LISTS, formatIsoDate, TaskListDef } from '../utils/taskQuickAddParser';
import {
  TaskBucket,
  TaskFilterType,
  computeChipCounts,
  getRowDateStr,
  getTaskBucket,
  groupTasksByBucket,
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
  }) => Promise<unknown>;
  onUpdateTodoFull: (
    id: string,
    input: {
      title?: string;
      priority?: string;
      category?: string;
      due_date?: string;
      remind_at?: string;
      remind_repeat?: string;
      remind_advance_minutes?: number;
    }
  ) => Promise<unknown>;
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
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
  searchOpen: externalSearchOpen,
}) => {
  const { colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState<TaskFilterType>('all');
  const [selectedListId, setSelectedListId] = useState<string>('all');
  const [lists, setLists] = useState<TaskListDef[]>(DEFAULT_TASK_LISTS);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Record<string, boolean>>({});
  const [sort] = useState<TaskSort>('date');
  const [internalQuery, setInternalQuery] = useState('');
  const [detailRow, setDetailRow] = useState<UnifiedRow | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [undoToast, setUndoToast] = useState<{ msg: string; onUndo?: () => void } | null>(null);

  const pending = usePendingItems(onOpenEventCreate);
  const query = (externalSearchQuery !== undefined ? externalSearchQuery : internalQuery)
    .trim()
    .toLowerCase();
  const isSearchOpen = externalSearchOpen !== undefined ? externalSearchOpen : false;

  const showUndoToast = useCallback((msg: string, onUndo?: () => void) => {
    setUndoToast({ msg, onUndo });
    setTimeout(() => {
      setUndoToast((cur) => (cur?.msg === msg ? null : cur));
    }, 3500);
  }, []);

  const now = Date.now();
  const rawRows = useMemo(
    () => toUnifiedRows([...pendingTodos, ...completedTodosList], pending.items, now),
    [pendingTodos, completedTodosList, pending.items, now]
  );

  const resolveListId = useCallback(
    (row: UnifiedRow): string => {
      const cat = (row.sourceTodo?.category || '').toLowerCase();
      const match = lists.find((l) => l.id === cat || l.name.toLowerCase() === cat);
      return match ? match.id : lists[0].id;
    },
    [lists]
  );

  const activeRows = useMemo(() => {
    const base = rawRows.filter((r) => !r.done);
    return sort !== 'date' ? sortUnifiedRows(base, sort) : base;
  }, [rawRows, sort]);

  const listFilteredRows = useMemo(
    () =>
      selectedListId === 'all'
        ? activeRows
        : activeRows.filter((r) => resolveListId(r) === selectedListId),
    [activeRows, selectedListId, resolveListId]
  );

  const countsByList = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of activeRows) {
      const id = resolveListId(r);
      map[id] = (map[id] || 0) + 1;
    }
    return map;
  }, [activeRows, resolveListId]);

  const doneRows = useMemo(() => rawRows.filter((r) => r.done), [rawRows]);
  const chipCounts = useMemo(() => computeChipCounts(listFilteredRows, now), [listFilteredRows, now]);
  const taskGroups = useMemo(
    () => groupTasksByBucket(listFilteredRows, activeFilter, query, now),
    [listFilteredRows, activeFilter, query, now]
  );

  const todayCount = useMemo(
    () => activeRows.filter((r) => getTaskBucket(getRowDateStr(r), now) === 'hoje').length,
    [activeRows, now]
  );
  const overdueCount = useMemo(
    () => activeRows.filter((r) => getTaskBucket(getRowDateStr(r), now) === 'atr').length,
    [activeRows, now]
  );

  const handleToggleRow = useCallback(
    (row: UnifiedRow) => {
      if (row.kind === 'todo' && row.sourceTodo) {
        const todoId = row.sourceTodo.id;
        const wasDone = row.done;
        onToggleTodo(todoId);
        if (!wasDone) showUndoToast('Tarefa concluída', () => onToggleTodo(todoId));
      } else if (row.sourcePending) {
        pending.toggleComplete(row.sourcePending);
      }
    },
    [onToggleTodo, pending, showUndoToast]
  );

  const handlePostponeTomorrow = useCallback(
    async (row: UnifiedRow) => {
      const tm = new Date();
      tm.setDate(tm.getDate() + 1);
      const tomorrowIso = formatIsoDate(tm);
      const prevDate = row.sourceTodo?.due_date || row.sourcePending?.scheduled_date || '';
      if (row.kind === 'todo' && row.sourceTodo) {
        const todoId = row.sourceTodo.id;
        await onUpdateTodoFull(todoId, { due_date: tomorrowIso });
        showUndoToast('Adiada para amanhã', () => {
          onUpdateTodoFull(todoId, { due_date: prevDate });
        });
      } else if (row.sourcePending) {
        await pending.schedule(row.sourcePending, tomorrowIso);
        showUndoToast('Adiada para amanhã');
      }
    },
    [onUpdateTodoFull, pending, showUndoToast]
  );

  const handleDeleteRow = useCallback(
    (row: UnifiedRow) => {
      if (row.kind === 'todo' && row.sourceTodo) onDeleteTodo(row.sourceTodo.id);
      if (row.sourcePending) pending.remove(row.sourcePending.id);
    },
    [onDeleteTodo, pending]
  );

  const toggleGroupCollapse = (bucket: TaskBucket) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedBuckets((prev) => ({ ...prev, [bucket]: !prev[bucket] }));
  };

  const handleQueryChange = (text: string) => {
    if (externalOnSearchChange) externalOnSearchChange(text);
    else setInternalQuery(text);
  };

  const initialLoading = loading && todos.length === 0 && pending.loading && pending.items.length === 0;
  const activeDetailRow = detailRow
    ? rawRows.find((r) => r.id === detailRow.id && r.kind === detailRow.kind) || detailRow
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
            />
          </View>
        </View>
      )}

      <TaskFilterChips
        selectedFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        counts={chipCounts}
      />

      <TaskListChips
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={setSelectedListId}
        countsByList={countsByList}
        onCreateList={(newList) => setLists((prev) => [...prev, newList])}
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
        {!query && (
          <DailyTasksSummaryCard
            completedTodayCount={completedTodosList.length}
            pendingTodayCount={todayCount}
            overdueCount={overdueCount}
          />
        )}

        {initialLoading ? (
          <ActivityIndicator color={colors.ink} style={{ marginVertical: 32 }} />
        ) : taskGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <VitoMascot size={72} state="success" animated />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>
              {activeFilter === 'hoje' ? 'Nada para hoje' : 'Tudo em dia!'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {query
                ? 'Nenhuma tarefa corresponde à busca.'
                : 'Aproveite o tempo livre ou planeje o que vem a seguir.'}
            </Text>
          </View>
        ) : (
          taskGroups.map((group) => {
            const isCollapsed = !!collapsedBuckets[group.bucket];
            return (
              <View key={`group-${group.bucket}`} style={styles.groupBlock}>
                <TaskGroupHeader
                  bucket={group.bucket}
                  title={group.label}
                  count={group.rows.length}
                  collapsed={isCollapsed}
                  onToggleCollapse={() => toggleGroupCollapse(group.bucket)}
                />
                {!isCollapsed && (
                  <View style={styles.groupList}>
                    {group.rows.map((row, idx) => {
                      const rowList = lists.find((l) => l.id === resolveListId(row));
                      return (
                        <TaskRow
                          key={`task-${row.kind}-${row.id}`}
                          row={row}
                          listDef={rowList}
                          hideList={selectedListId !== 'all'}
                          isFirst={idx === 0}
                          onToggle={() => handleToggleRow(row)}
                          onPostpone={() => handlePostponeTomorrow(row)}
                          onDelete={() => handleDeleteRow(row)}
                          onEdit={() => setDetailRow(row)}
                          onAiAction={() => setDetailRow(row)}
                          subtasks={row.sourceTodo?.subtasks}
                          onToggleSubtask={(sid) => row.sourceTodo && onToggleSubtask(row.sourceTodo.id, sid)}
                          onAddSubtask={(title) => row.sourceTodo && onAddSubtask(row.sourceTodo.id, title)}
                          onDeleteSubtask={(sid) => row.sourceTodo && onDeleteSubtask(row.sourceTodo.id, sid)}
                          onSchedule={(dateStr) => row.sourcePending && pending.schedule(row.sourcePending, dateStr)}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}

        <CompletedAccordion
          completedRows={doneRows}
          onToggleRow={handleToggleRow}
          onEditRow={setDetailRow}
          onDeleteRow={handleDeleteRow}
        />
      </ScrollView>

      {/* FAB Quick Add (#tk-fab) */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.ink }]}
        onPress={() => {
          hapticFeedback.medium();
          setQuickAddOpen(true);
        }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Adicionar tarefa rapidamente"
      >
        <MaterialIcons name="add" size={26} color={colors.bg} />
      </TouchableOpacity>

      {undoToast && (
        <View style={[styles.toast, { backgroundColor: colors.ink }]}>
          <Text style={[styles.toastText, { color: colors.bg }]}>{undoToast.msg}</Text>
          {undoToast.onUndo && (
            <TouchableOpacity
              onPress={() => {
                undoToast.onUndo?.();
                setUndoToast(null);
              }}
            >
              <Text style={[styles.toastUndo, { color: colors.acc }]}>Desfazer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TaskQuickAddSheet
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        lists={lists}
        defaultListId={selectedListId}
        onAddTask={async (payload) => {
          await onSaveTodoFull(payload);
        }}
      />

      <TaskDetailSheet
        visible={!!activeDetailRow}
        row={activeDetailRow}
        lists={lists}
        onClose={() => setDetailRow(null)}
        onUpdateTodo={async (id, data) => {
          await onUpdateTodoFull(id, data);
        }}
        onToggleTodo={() => activeDetailRow && handleToggleRow(activeDetailRow)}
        onToggleSubtask={(sid) => activeDetailRow?.sourceTodo && onToggleSubtask(activeDetailRow.sourceTodo.id, sid)}
        onAddSubtask={async (title) => {
          if (activeDetailRow?.sourceTodo) await onAddSubtask(activeDetailRow.sourceTodo.id, title);
        }}
        onDeleteSubtask={(sid) => activeDetailRow?.sourceTodo && onDeleteSubtask(activeDetailRow.sourceTodo.id, sid)}
        onDeleteTask={() => activeDetailRow && handleDeleteRow(activeDetailRow)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 150 },
  searchSection: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  groupBlock: { marginTop: 4 },
  groupList: { marginTop: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 6 },
  emptyText: { fontSize: 13.5, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 106,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  toast: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 88,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toastText: { fontSize: 13.5, fontWeight: '500' },
  toastUndo: { fontSize: 13.5, fontWeight: '700' },
});
