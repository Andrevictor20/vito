import React, { useState, useMemo } from 'react';
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
import { Todo, PendingItem } from '../types';
import { TaskRow } from '../components/tasks/TaskRow';
import { TaskSheet, TaskPayload } from '../components/tasks/TaskSheet';
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
}

const FILTERS: Array<{ id: TaskFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'today', label: 'Hoje' },
  { id: 'overdue', label: 'Atrasadas' },
  { id: 'nodate', label: 'Sem data' },
];

const SORTS: Array<{ id: TaskSort; label: string }> = [
  { id: 'date', label: 'Data' },
  { id: 'priority', label: 'Prioridade' },
  { id: 'alpha', label: 'A–Z' },
];

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
  onSaveTodoFull,
  onUpdateTodoFull,
  onOpenEventCreate,
}) => {
  const { colors, isDark } = useTheme();
  const [showCompleted, setShowCompleted] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [sort, setSort] = useState<TaskSort>('date');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  // Pendência legada em conversão para tarefa unificada.
  const [convertingPending, setConvertingPending] = useState<PendingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pending = usePendingItems(onOpenEventCreate);

  const rows = useMemo(
    () => toUnifiedRows([...pendingTodos, ...completedTodosList], pending.items, Date.now()),
    [pendingTodos, completedTodosList, pending.items],
  );
  const now = Date.now();
  const activeRows = useMemo(
    () => sortUnifiedRows(filterUnifiedRows(rows, filter, now), sort),
    [rows, filter, sort],
  );
  const doneRows = useMemo(() => rows.filter((r) => r.done), [rows]);
  const overdueCount = useMemo(() => rows.filter((r) => !r.done && r.overdue).length, [rows]);

  const renderRow = (row: (typeof activeRows)[number]) => {
    if (row.kind === 'todo' && row.sourceTodo) {
      const t = row.sourceTodo;
      return (
        <TaskRow
          key={`todo-${row.id}`}
          row={row}
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
        <View style={styles.sectionHeader}>
          <Text style={[styles.checklistSubtitle, { color: colors.textMuted }]}>
            {activeRows.length} {activeRows.length === 1 ? 'ativa' : 'ativas'}
            {overdueCount > 0 ? ` · ${overdueCount} atrasada${overdueCount === 1 ? '' : 's'}` : ''}
            {completedCount > 0 ? ` · ${completedCount} concluída${completedCount === 1 ? '' : 's'}` : ''}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filterStrip}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, { borderColor: active ? colors.primary : colors.outlineVariant, backgroundColor: active ? colors.primary : 'transparent' }]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filtrar ${f.label}`}
              >
                <Text style={[styles.filterText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={[styles.sortDivider, { backgroundColor: colors.outlineVariant }]} />
          {SORTS.map((s) => {
            const active = sort === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.filterChip, { borderColor: active ? colors.primary : colors.outlineVariant, backgroundColor: active ? colors.primary : 'transparent' }]}
                onPress={() => setSort(s.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Ordenar por ${s.label}`}
              >
                <Text style={[styles.filterText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
              <MaterialIcons name="done-all" size={20} color={colors.success} />
            </View>
            <View style={styles.emptyContent}>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Tudo em Dia</Text>
              <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
                Nenhuma tarefa neste filtro.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.checklistCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
            {activeRows.map(renderRow)}
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
                {doneRows.map(renderRow)}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* FAB fixo padronizado: pill compacta, sempre visível mesmo com 300 itens */}
      <View style={styles.fabOverlay} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => { setEditingTodo(null); setConvertingPending(null); setSaveError(null); setSheetVisible(true); }}
          activeOpacity={0.85}
          accessibilityLabel="Nova tarefa"
          accessibilityRole="button"
        >
          <MaterialIcons name="add" size={22} color={colors.onPrimary} />
          <Text style={[styles.fabText, { color: colors.onPrimary }]}>Nova</Text>
        </TouchableOpacity>
      </View>

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
  checklistSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  filterStrip: {
    gap: 8,
    paddingRight: 8,
    marginBottom: tokens.spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sortDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 2,
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
