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
import { CreateTaskSheet, NewItemPayload } from '../components/tasks/CreateTaskSheet';
import { EditTaskSheet, EditTarget, EditItemPayload } from '../components/tasks/EditTaskSheet';
import { ReminderSheet, RepeatOption } from '../components/pending/ReminderSheet';
import { usePendingItems } from '../hooks/usePendingItems';
import { toUnifiedRows, sortUnifiedRows } from '../utils/unifiedTasks';

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
    due_date?: string;
    remind_at?: string;
    remind_repeat?: string;
    remind_advance_minutes?: number;
  }) => Promise<any>;
  onUpdateTodoFull: (id: string, input: {
    title?: string;
    priority?: string;
    due_date?: string;
    remind_at?: string;
    remind_repeat?: string;
    remind_advance_minutes?: number;
  }) => Promise<any>;
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
  onSaveTodoFull,
  onUpdateTodoFull,
  onOpenEventCreate,
}) => {
  const { colors, isDark } = useTheme();
  const [showCompleted, setShowCompleted] = useState(false);
  const [reminderItem, setReminderItem] = useState<PendingItem | null>(null);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const pending = usePendingItems(onOpenEventCreate);

  const rows = useMemo(
    () => toUnifiedRows([...pendingTodos, ...completedTodosList], pending.items, Date.now()),
    [pendingTodos, completedTodosList, pending.items],
  );
  const activeRows = useMemo(() => sortUnifiedRows(rows), [rows]);
  const doneRows = useMemo(() => rows.filter((r) => r.done), [rows]);
  const overdueCount = useMemo(() => activeRows.filter((r) => r.overdue).length, [activeRows]);

  const renderRow = (row: (typeof activeRows)[number]) => {
    if (row.kind === 'todo' && row.sourceTodo) {
      const t = row.sourceTodo;
      return (
        <TaskRow
          key={`todo-${row.id}`}
          row={row}
          onToggle={() => onToggleTodo(t.id)}
          onDelete={() => onDeleteTodo(t.id)}
          onEdit={() => setEditTarget({ kind: 'todo', todo: t })}
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
          onEdit={() => setEditTarget({ kind: 'pending', pending: p })}
          onSchedule={(dateStr) => pending.schedule(p, dateStr)}
          onReminder={() => setReminderItem(p)}
        />
      );
    }
    return null;
  };

  const handleSaveNew = async (payload: NewItemPayload) => {
    setCreateSaving(true);
    setCreateError(null);
    try {
      if (payload.kind === 'todo') {
        await onSaveTodoFull({
          title: payload.title,
          priority: payload.priority,
          due_date: payload.dateISO,
          remind_at: payload.remind_at,
          remind_repeat: payload.remind_repeat,
          remind_advance_minutes: payload.remind_advance_minutes,
        });
      } else {
        await pending.create(payload.title, payload.category || 'geral', {
          scheduled_date: payload.dateOnly,
          remind_at: payload.remind_at,
          remind_repeat: payload.remind_repeat,
          remind_advance_minutes: payload.remind_advance_minutes,
        });
      }
      setCreateVisible(false);
    } catch (err) {
      console.warn('[TasksScreen] Falha ao criar item:', err);
      setCreateError('Não foi possível criar. Tente de novo.');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleSaveEdit = async (id: string, kind: 'todo' | 'pending', payload: EditItemPayload) => {
    setEditSaving(true);
    setEditError(null);
    try {
      if (kind === 'todo') {
        await onUpdateTodoFull(id, {
          title: payload.title,
          priority: payload.priority,
          due_date: payload.dateISO,
          remind_at: payload.remind_at,
          remind_repeat: payload.remind_repeat,
          remind_advance_minutes: payload.remind_advance_minutes,
        });
      } else {
        const full = editTarget?.kind === 'pending' && editTarget.pending
          ? editTarget.pending
          : ({ id } as PendingItem);
        await pending.updateItem(
          full,
          {
            title: payload.title,
            category: payload.category,
            scheduled_date: payload.dateOnly,
            remind_at: payload.remind_at,
            remind_repeat: payload.remind_repeat,
            remind_advance_minutes: payload.remind_advance_minutes,
          },
        );
      }
      setEditTarget(null);
    } catch (err) {
      console.warn('[TasksScreen] Falha ao editar item:', err);
      setEditError('Não foi possível salvar. Tente de novo.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteFromEdit = async (id: string, kind: 'todo' | 'pending') => {
    try {
      if (kind === 'todo') onDeleteTodo(id);
      else await pending.remove(id);
      setEditTarget(null);
    } catch (err) {
      setEditError('Não foi possível excluir. Tente de novo.');
    }
  };

  const handleSaveReminder = async (reminder: { remind_at: string; remind_repeat: RepeatOption; remind_advance_minutes: number }) => {
    if (!reminderItem) return;
    setReminderSaving(true);
    setReminderError(null);
    try {
      await pending.updateReminder(reminderItem, reminder);
      setReminderItem(null);
    } catch (err) {
      setReminderError('Não foi possível salvar o lembrete. Tente de novo.');
    } finally {
      setReminderSaving(false);
    }
  };

  const handleClearReminder = async () => {
    if (!reminderItem) return;
    setReminderSaving(true);
    setReminderError(null);
    try {
      await pending.updateReminder(reminderItem, { remind_at: null, remind_repeat: 'none', remind_advance_minutes: 0 });
      setReminderItem(null);
    } catch (err) {
      setReminderError('Não foi possível remover o lembrete. Tente de novo.');
    } finally {
      setReminderSaving(false);
    }
  };

  const initialLoading = loading && todos.length === 0 && pending.loading && pending.items.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
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
        {/* Linha de contexto (o Header global já titula a página) */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.checklistSubtitle, { color: colors.textMuted }]}>
            {activeRows.length} {activeRows.length === 1 ? 'ativa' : 'ativas'}
            {overdueCount > 0 ? ` · ${overdueCount} atrasada${overdueCount === 1 ? '' : 's'}` : ''}
            {completedCount > 0 ? ` · ${completedCount} concluída${completedCount === 1 ? '' : 's'}` : ''}
          </Text>
        </View>

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
                Nenhuma tarefa ou pendência no momento.
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

        {/* Entrada única de criação */}
        <View style={styles.createBtnWrapper}>
          <TouchableOpacity
            style={[styles.createFab, { backgroundColor: colors.primary }]}
            onPress={() => setCreateVisible(true)}
            activeOpacity={0.85}
            accessibilityLabel="Criar tarefa ou pendência"
          >
            <MaterialIcons name="add" size={22} color={colors.onPrimary} />
            <Text style={[styles.createFabText, { color: colors.onPrimary }]}>Novo item</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CreateTaskSheet
        visible={createVisible}
        saving={createSaving}
        error={createError}
        onClose={() => setCreateVisible(false)}
        onSave={handleSaveNew}
      />

      <ReminderSheet
        visible={!!reminderItem}
        item={reminderItem}
        saving={reminderSaving}
        error={reminderError}
        onClose={() => setReminderItem(null)}
        onSave={handleSaveReminder}
        onClear={handleClearReminder}
      />

      <EditTaskSheet
        target={editTarget}
        saving={editSaving}
        error={editError}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveEdit}
        onDelete={handleDeleteFromEdit}
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
    paddingBottom: 110,
  },
  sectionHeader: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  checklistSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
  createBtnWrapper: {
    marginTop: tokens.spacing.md,
    alignItems: 'center',
  },
  createFab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    elevation: 3,
  },
  createFabText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
