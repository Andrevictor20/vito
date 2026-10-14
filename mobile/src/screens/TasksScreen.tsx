import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { Todo, PendingItem } from '../types';
import { TaskRow } from '../components/tasks/TaskRow';
import { TaskSheet, TaskPayload } from '../components/tasks/TaskSheet';
import { BottomSheetModal } from '../components/ui/BottomSheetModal';
import { usePendingItems } from '../hooks/usePendingItems';
import { toUnifiedRows, sortUnifiedRows, filterUnifiedRows, TaskFilter, TaskSort } from '../utils/unifiedTasks';

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
  /** Sinal do Header (+ Nova tarefa): incrementa para abrir o sheet em criação. */
  createRequestId?: number;
}

const FILTERS: Array<{ id: TaskFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'today', label: 'Hoje' },
  { id: 'overdue', label: 'Atrasadas' },
  { id: 'nodate', label: 'Sem data' },
];

const SORTS: Array<{ id: TaskSort; label: string }> = [
  { id: 'date', label: 'Prazo' },
  { id: 'priority', label: 'Prioridade' },
  { id: 'alpha', label: 'A–Z' },
];

type PriorityFilter = 'all' | 'low' | 'medium' | 'high';

const PRIORITY_FILTERS: Array<{ id: PriorityFilter; label: string }> = [
  { id: 'all', label: 'Todas as prioridades' },
  { id: 'high', label: '• Alta Prioridade' },
  { id: 'medium', label: '• Média Prioridade' },
  { id: 'low', label: '• Baixa Prioridade' },
];

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
}) => {
  const { colors, isDark } = useTheme();
  const [showCompleted, setShowCompleted] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [sort, setSort] = useState<TaskSort>('date');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  // Pendência legada em conversão para tarefa unificada.
  const [convertingPending, setConvertingPending] = useState<PendingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pending = usePendingItems(onOpenEventCreate);

  // CTA do Header (+ Nova tarefa): abre o sheet em modo criação.
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

  const rows = useMemo(
    () => toUnifiedRows([...pendingTodos, ...completedTodosList], pending.items, Date.now()),
    [pendingTodos, completedTodosList, pending.items],
  );
  const now = Date.now();
  const query = searchQuery.trim().toLowerCase();
  const baseRows = useMemo(
    () => sortUnifiedRows(filterUnifiedRows(rows, filter, now), sort),
    [rows, filter, sort],
  );
  const activeRows = useMemo(() => {
    let list = baseRows;
    if (priorityFilter !== 'all') {
      list = list.filter((r) => r.priority === priorityFilter);
    }
    if (query) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.detail.toLowerCase().includes(query)
      );
    }
    return list;
  }, [baseRows, priorityFilter, query]);
  // Contagens vivas por período (para o sheet de filtro).
  const counts = useMemo(() => {
    const c: Record<TaskFilter, number> = { all: 0, today: 0, overdue: 0, nodate: 0 };
    (Object.keys(c) as TaskFilter[]).forEach((f) => {
      c[f] = filterUnifiedRows(rows, f, now).length;
    });
    return c;
  }, [rows, now]);
  const doneRows = useMemo(() => rows.filter((r) => r.done), [rows]);

  const renderRow = (row: (typeof activeRows)[number], isLast = false) => {
    if (row.kind === 'todo' && row.sourceTodo) {
      const t = row.sourceTodo;
      return (
        <TaskRow
          key={`todo-${row.id}`}
          row={row}
          isLast={isLast}
          onToggle={() => onToggleTodo(t.id)}
          onDelete={() => onDeleteTodo(t.id)}
          onEdit={() => { setEditingTodo(t); setConvertingPending(null); setSaveError(null); setSheetVisible(true); }}
          onReminder={undefined}
          subtasks={t.subtasks}
          onToggleSubtask={(sid) => onToggleSubtask(t.id, sid)}
          onAddSubtask={(title) => onAddSubtask(t.id, title)}
          onDeleteSubtask={(sid) => onDeleteSubtask(t.id, sid)}
        />
      );
    }
    if (row.sourcePending) {
      const p = row.sourcePending;
      return (
        <TaskRow
          key={`pending-${row.id}`}
          row={row}
          isLast={isLast}
          onToggle={() => pending.toggleComplete(p)}
          onDelete={() => pending.remove(p.id)}
          onEdit={() => {
            // Converte pendência legada: preenche o sheet unificado.
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
              remind_repeat: (p.remind_repeat as any) || 'none',
              remind_advance_minutes: p.remind_advance_minutes || 0,
              created_at: '',
            } as Todo);
            setSaveError(null);
            setSheetVisible(true);
          }}
          onSchedule={(dateStr) => pending.schedule(p, dateStr)}
          onReminder={undefined}
        />
      );
    }
    return null;
  };

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
        // Migração on-the-fly: cria tarefa unificada e apaga a pendência legada.
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

  const handleDelete = async (id: string) => {
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
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing || pending.refreshing}
            onRefresh={() => {
              onRefresh();
              pending.refresh();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <MaterialIcons name="search" size={18} color={colors.onSurfaceVariant} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Pesquisar tarefas..."
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              accessibilityLabel="Pesquisar tarefas"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Limpar busca"
                accessibilityRole="button"
              >
                <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              {
                backgroundColor: (filter !== 'all' || priorityFilter !== 'all' || sort !== 'date')
                  ? colors.primary
                  : colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
            onPress={() => setFilterVisible(true)}
            activeOpacity={0.8}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Filtrar e ordenar tarefas"
            accessibilityRole="button"
          >
            <MaterialIcons
              name="filter-list"
              size={20}
              color={(filter !== 'all' || priorityFilter !== 'all' || sort !== 'date') ? colors.onPrimary : colors.onSurface}
            />
          </TouchableOpacity>
        </View>

        {(filter !== 'all' || priorityFilter !== 'all' || query) && (
          <Text style={[styles.activeFilterLine, { color: colors.textMuted }]}>
            {activeRows.length} {activeRows.length === 1 ? 'tarefa' : 'tarefas'}
            {query ? ` para "${searchQuery.trim()}"` : ''}
          </Text>
        )}

        {pending.error && (
          <View style={[styles.errorCard, { backgroundColor: colors.errorContainer, borderColor: colors.error }]}>
            <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>{pending.error}</Text>
            <TouchableOpacity onPress={pending.retry} activeOpacity={0.7} accessibilityLabel="Tentar carregar de novo">
              <Text style={[styles.retryText, { color: colors.error }]}>Tentar de novo</Text>
            </TouchableOpacity>
          </View>
        )}

        {initialLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : activeRows.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
              <MaterialIcons name={query ? 'search-off' : 'done-all'} size={20} color={colors.success} />
            </View>
            <View style={styles.emptyContent}>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                {query ? `Nada para "${searchQuery.trim()}"` : 'Tudo em Dia'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
                {query ? 'Tente outro termo ou limpe a busca.' : 'Nenhuma tarefa neste filtro.'}
              </Text>
              {query ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} accessibilityLabel="Limpar busca">
                  <Text style={[styles.retryText, { color: colors.primary }]}>Limpar busca</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={[styles.checklistCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
            {activeRows.map((r, i) => renderRow(r, i === activeRows.length - 1))}
          </View>
        )}

        {doneRows.length > 0 && (
          <View style={styles.completedSectionWrapper}>
            <TouchableOpacity
              style={[
                styles.completedSectionToggle,
                {
                  backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={() => setShowCompleted(!showCompleted)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Alternar concluídas (toque para reabrir)"
            >
              <View style={styles.completedToggleLeft}>
                <MaterialIcons name="done-all" size={16} color={colors.accents.emerald} />
                <Text style={[styles.completedToggleText, { color: colors.onSurfaceVariant }]}>
                  Concluídas ({doneRows.length})
                </Text>
              </View>
              <MaterialIcons
                name={showCompleted ? 'expand-less' : 'expand-more'}
                size={20}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            {showCompleted && (
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
                {doneRows.map((r, i) => renderRow(r, i === doneRows.length - 1))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* CTA vive no Header (+ Nova tarefa); sem FAB sobre a lista. */}
      <BottomSheetModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        title="Filtrar e Ordenar"
        subtitle="Refine sua visualização de tarefas ativas"
      >
        <Text style={[styles.sheetGroupLabel, { color: colors.textMuted }]}>PERÍODO / STATUS</Text>
        <View style={styles.sheetGrid}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.sheetChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filtrar ${f.label}`}
              >
                <Text style={[styles.sheetChipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {f.label} ({counts[f.id]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sheetGroupLabel, { color: colors.textMuted }]}>PRIORIDADE</Text>
        <View style={styles.sheetGrid}>
          {PRIORITY_FILTERS.map((p) => {
            const active = priorityFilter === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.sheetChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => setPriorityFilter(p.id)}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Prioridade ${p.label}`}
              >
                <Text style={[styles.sheetChipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sheetGroupLabel, { color: colors.textMuted }]}>ORDENAR LISTA POR</Text>
        <View style={styles.sheetGrid}>
          {SORTS.map((s) => {
            const active = sort === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.sheetChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => setSort(s.id)}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Ordenar por ${s.label}`}
              >
                <Text style={[styles.sheetChipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sheetFooter}>
          <TouchableOpacity
            style={[styles.sheetClearBtn, { borderColor: colors.outlineVariant }]}
            onPress={() => { setFilter('all'); setPriorityFilter('all'); setSort('date'); setSearchQuery(''); }}
            activeOpacity={0.8}
            accessibilityLabel="Limpar filtros"
            accessibilityRole="button"
          >
            <Text style={[styles.sheetClearText, { color: colors.onSurface }]}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sheetApplyBtn, { backgroundColor: colors.primary }]}
            onPress={() => setFilterVisible(false)}
            activeOpacity={0.85}
            accessibilityLabel={`Mostrar ${activeRows.length} tarefas`}
            accessibilityRole="button"
          >
            <Text style={[styles.sheetApplyText, { color: colors.onPrimary }]}>
              Mostrar {activeRows.length} tarefas
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      <TaskSheet
        visible={sheetVisible}
        editingTodo={editingTodo}
        saving={saving}
        error={saveError}
        onClose={() => { setSheetVisible(false); setEditingTodo(null); setConvertingPending(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
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
  content: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 150,
  },
  sectionHeader: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterLine: {
    fontSize: 12,
    marginBottom: tokens.spacing.xs,
  },
  sheetGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
  },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  sheetChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: tokens.spacing.lg,
  },
  sheetClearBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  sheetClearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetApplyBtn: {
    flex: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  sheetApplyText: {
    fontSize: 14,
    fontWeight: '700',
  },
  checklistSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 3,
    gap: 2,
    marginBottom: tokens.spacing.xs,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: tokens.spacing.sm,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortChip: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  checklistCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: tokens.spacing.sm,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
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
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
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
  fabOverlay: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    zIndex: 50,
    alignItems: 'flex-end',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
