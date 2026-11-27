import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { PlusSvgIcon, ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { api } from '../../../services/api';
import { chatPromptBus } from '../../../services/dataSync';
import { styles } from './TasksScreen.styles';
import { tokens } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { hapticFeedback } from '../../../theme/motion';
import { StaggerItem } from '../../../theme/vitoMotion';
import type { Todo } from '../../../types';
import { TaskRow } from '../components/TaskRow';
import { TaskListChips } from '../components/TaskListChips';
import { DailyTasksSummaryCard } from '../components/DailyTasksSummaryCard';
import { TaskQuickAddSheet } from '../components/TaskQuickAddSheet';
import { TaskDetailSheet } from '../components/TaskDetailSheet';
import { TaskGroupHeader } from '../components/TaskGroupHeader';
import { CompletedAccordion } from '../components/CompletedAccordion';
import { VitoMascot } from '../../../components/common/VitoMascot';
import { usePendingItems } from '../hooks/usePendingItems';
import { toUnifiedRows, sortUnifiedRows, TaskSort, UnifiedRow } from '../utils/unifiedTasks';
import { DEFAULT_TASK_LISTS, formatIsoDate, TaskListDef } from '../utils/taskQuickAddParser';
import {
  TaskBucket,
  TaskFilterType,
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
  const [activeFilter] = useState<TaskFilterType>('all');
  const [selectedListId, setSelectedListId] = useState<string>('all');
  const [lists, setLists] = useState<TaskListDef[]>(DEFAULT_TASK_LISTS);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    AsyncStorage.getItem('@vito_task_custom_lists')
      .then((raw) => {
        if (!raw) return;
        const custom = JSON.parse(raw) as TaskListDef[];
        if (Array.isArray(custom) && custom.length > 0) {
          const defaultIds = new Set(DEFAULT_TASK_LISTS.map((l) => l.id));
          setLists([...DEFAULT_TASK_LISTS, ...custom.filter((c) => !defaultIds.has(c.id))]);
        }
      })
      .catch(() => {});
  }, []);
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
      const cat = (row.sourceTodo?.category || row.sourcePending?.category || '').toLowerCase();
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
  const taskGroups = useMemo(
    () => groupTasksByBucket(listFilteredRows, activeFilter, query, now),
    [listFilteredRows, activeFilter, query, now]
  );

  const todayIso = useMemo(() => formatIsoDate(new Date()), []);
  const completedTodayCount = useMemo(
    () =>
      doneRows.filter((r) => {
        const rawStamp = r.sourceTodo?.updated_at || r.sourcePending?.updated_at || '';
        return typeof rawStamp === 'string' && rawStamp.slice(0, 10) === todayIso;
      }).length,
    [doneRows, todayIso]
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
            <ProtoUiIcon name="search" size={20} color={colors.muted} />
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

      <StaggerItem index={0}>
        <TaskListChips
          lists={lists}
          selectedListId={selectedListId}
          onSelectList={setSelectedListId}
          countsByList={countsByList}
          onCreateList={(newList) => {
            setLists((prev) => {
              const next = [...prev, newList];
              const defaultIds = new Set(DEFAULT_TASK_LISTS.map((l) => l.id));
              const customOnly = next.filter((l) => !defaultIds.has(l.id));
              void AsyncStorage.setItem('@vito_task_custom_lists', JSON.stringify(customOnly));
              return next;
            });
          }}
        />
      </StaggerItem>

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
          <StaggerItem index={1}>
            <DailyTasksSummaryCard
              completedTodayCount={completedTodayCount}
              pendingTodayCount={todayCount}
              overdueCount={overdueCount}
            />
          </StaggerItem>
        )}

        {initialLoading ? (
          <ActivityIndicator color={colors.ink} style={{ marginVertical: 32 }} />
        ) : taskGroups.length === 0 ? (
          <StaggerItem index={2} style={styles.emptyContainer}>
            <VitoMascot size={72} state="success" animated />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>
              {activeFilter === 'hoje' ? 'Nada para hoje' : 'Tudo em dia!'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {query
                ? 'Nenhuma tarefa corresponde à busca.'
                : 'Aproveite o tempo livre ou planeje o que vem a seguir.'}
            </Text>
          </StaggerItem>
        ) : (
          taskGroups.map((group, gIdx) => {
            const isCollapsed = !!collapsedBuckets[group.bucket];
            return (
              <StaggerItem key={`group-${group.bucket}`} index={2 + gIdx} style={styles.groupBlock}>
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
                          onAiAction={() =>
                            chatPromptBus.askAssistant(
                              `Me ajude com a tarefa "${row.title}"${rowList ? ` (lista ${rowList.name})` : ''}.`,
                            )
                          }
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
              </StaggerItem>
            );
          })
        )}

        <StaggerItem index={2 + taskGroups.length}>
          <CompletedAccordion
            completedRows={doneRows}
            onToggleRow={handleToggleRow}
            onEditRow={setDetailRow}
            onAiRow={(row) =>
              chatPromptBus.askAssistant(`Sobre a tarefa concluída "${row.title}", há algum próximo passo?`)
            }
            onDeleteRow={handleDeleteRow}
          />
        </StaggerItem>
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
        <PlusSvgIcon size={24} color={colors.bg} />
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
        onSuggestSubtasks={async (todoId) => {
          await api.suggestSubtasks(todoId);
          onRefresh();
        }}
        onDeleteSubtask={(sid) => activeDetailRow?.sourceTodo && onDeleteSubtask(activeDetailRow.sourceTodo.id, sid)}
        onDeleteTask={() => activeDetailRow && handleDeleteRow(activeDetailRow)}
      />
    </View>
  );
};
