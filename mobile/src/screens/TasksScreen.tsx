import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { Todo, PendingItem } from '../types';
import { TodoItem } from '../components/todos/TodoItem';
import { ReminderSheet, RepeatOption } from '../components/pending/ReminderSheet';
import { usePendingItems } from '../hooks/usePendingItems';
import { toUnifiedRows, sortUnifiedRows, UnifiedRow } from '../utils/unifiedTasks';

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

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const formatShortDate = (row: UnifiedRow): string | null => {
  const src = row.sourceTodo?.due_date || row.sourcePending?.scheduled_date;
  if (!src) return null;
  const d = new Date(src.length === 10 ? `${src}T12:00:00` : src);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const PendingRow: React.FC<{
  row: UnifiedRow;
  onToggle: (item: PendingItem) => void;
  onDelete: (id: string) => void;
  onSchedule: (item: PendingItem, dateStr: string) => void;
  onReminder: (item: PendingItem) => void;
}> = ({ row, onToggle, onDelete, onSchedule, onReminder }) => {
  const { colors } = useTheme();
  const item = row.sourcePending!;
  const dateLabel = formatShortDate(row);
  const scheduled = item.status === 'scheduled';

  return (
    <View style={[styles.pendingRow, row.overdue && { backgroundColor: colors.errorContainer }]}>
      <TouchableOpacity
        style={[
          styles.checkCircle,
          { borderColor: row.done ? colors.primary : colors.outline },
          row.done && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
        onPress={() => onToggle(item)}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.done }}
        accessibilityLabel={row.done ? 'Reabrir pendência' : 'Concluir pendência'}
      >
        {row.done && <MaterialIcons name="check" size={16} color={colors.onPrimary} />}
      </TouchableOpacity>

      <View style={styles.pendingBody}>
        <Text
          style={[styles.pendingTitle, { color: colors.onSurface }, row.done && styles.struck]}
          numberOfLines={2}
        >
          {row.title}
        </Text>
        <View style={styles.pendingMeta}>
          <View style={[styles.badge, { backgroundColor: colors.tertiaryContainer }]}>
            <Text style={[styles.badgeText, { color: colors.onTertiaryContainer }]}>Pendência</Text>
          </View>
          {dateLabel && (
            <Text style={[styles.dateText, { color: row.overdue ? colors.error : colors.onSurfaceVariant }]}>
              {row.overdue ? `Atrasada · ${dateLabel}` : dateLabel}
            </Text>
          )}
          {!dateLabel && <Text style={[styles.dateText, { color: colors.onSurfaceVariant }]}>Sem data</Text>}
        </View>
        {!row.done && !scheduled && (
          <View style={styles.quickSchedule}>
            <TouchableOpacity
              style={[styles.schedChip, { borderColor: colors.outlineVariant }]}
              onPress={() => onSchedule(item, isoDay(0))}
              activeOpacity={0.7}
              accessibilityLabel="Agendar para hoje"
            >
              <Text style={[styles.schedChipText, { color: colors.primary }]}>Hoje</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.schedChip, { borderColor: colors.outlineVariant }]}
              onPress={() => onSchedule(item, isoDay(1))}
              activeOpacity={0.7}
              accessibilityLabel="Agendar para amanhã"
            >
              <Text style={[styles.schedChipText, { color: colors.primary }]}>Amanhã</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={() => onReminder(item)}
        hitSlop={tokens.hitSlop.sm}
        activeOpacity={0.7}
        accessibilityLabel={item.remind_at ? 'Editar lembrete' : 'Configurar lembrete'}
      >
        <MaterialIcons
          name={item.remind_at ? 'notifications-active' : 'notifications-none'}
          size={20}
          color={item.remind_at ? colors.primary : colors.onSurfaceVariant}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        hitSlop={tokens.hitSlop.sm}
        activeOpacity={0.7}
        accessibilityLabel="Excluir pendência"
      >
        <MaterialIcons name="delete-outline" size={20} color={colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
};

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
  const [showCompleted, setShowCompleted] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [reminderItem, setReminderItem] = useState<PendingItem | null>(null);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const pending = usePendingItems(onOpenEventCreate);

  const rows = useMemo(
    () => toUnifiedRows([...pendingTodos, ...completedTodosList], pending.items, Date.now()),
    [pendingTodos, completedTodosList, pending.items],
  );
  const activeRows = useMemo(() => sortUnifiedRows(rows), [rows]);
  const doneRows = useMemo(() => rows.filter((r) => r.done), [rows]);
  const overdueCount = useMemo(() => activeRows.filter((r) => r.overdue).length, [activeRows]);

  const handleQuickAdd = async () => {
    if (!quickTitle.trim()) return;
    const created = await pending.create(quickTitle);
    if (created) setQuickTitle('');
  };

  const handleSaveReminder = async (reminder: { remind_at: string; remind_repeat: RepeatOption; remind_advance_minutes: number }) => {
    if (!reminderItem) return;
    setReminderSaving(true);
    setReminderError(null);
    try {
      await pending.updateReminder(reminderItem, reminder);
      setReminderItem(null);
    } catch (err) {
      console.warn('[TasksScreen] Falha ao salvar lembrete:', err);
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
        {/* Cabeçalho da página única */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Tarefas e Pendências</Text>
          <Text style={[styles.checklistSubtitle, { color: colors.textMuted }]}>
            {activeRows.length} {activeRows.length === 1 ? 'ativa' : 'ativas'}
            {overdueCount > 0 ? ` · ${overdueCount} atrasada${overdueCount === 1 ? '' : 's'}` : ''}
            {completedCount > 0 ? ` · ${completedCount} concluída${completedCount === 1 ? '' : 's'}` : ''}
          </Text>
        </View>

        {/* Criação rápida de pendência */}
        <View style={[styles.quickCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
          <TextInput
            style={[styles.quickInput, { color: colors.onSurface }]}
            placeholder="Guardar algo para resolver depois..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={quickTitle}
            onChangeText={setQuickTitle}
            onSubmitEditing={handleQuickAdd}
            returnKeyType="done"
            accessibilityLabel="Criar pendência rápida"
          />
          <TouchableOpacity
            style={[styles.quickAdd, { backgroundColor: colors.primary }]}
            onPress={handleQuickAdd}
            activeOpacity={0.8}
            accessibilityLabel="Adicionar pendência"
          >
            <MaterialIcons name="add" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {pending.error && (
          <View style={[styles.errorCard, { backgroundColor: colors.errorContainer, borderColor: colors.error }]}>
            <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>{pending.error}</Text>
            <TouchableOpacity onPress={pending.retry} activeOpacity={0.7} accessibilityLabel="Tentar carregar pendências de novo">
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
            {activeRows.map((row) =>
              row.kind === 'todo' && row.sourceTodo ? (
                <TodoItem
                  key={`todo-${row.id}`}
                  todo={row.sourceTodo}
                  onToggle={onToggleTodo}
                  onDelete={onDeleteTodo}
                  onToggleSubtask={onToggleSubtask}
                  onAddSubtask={onAddSubtask}
                  onDeleteSubtask={onDeleteSubtask}
                  grouped
                />
              ) : row.sourcePending ? (
                <PendingRow
                  key={`pending-${row.id}`}
                  row={row}
                  onToggle={pending.toggleComplete}
                  onDelete={pending.remove}
                  onSchedule={pending.schedule}
                  onReminder={setReminderItem}
                />
              ) : null,
            )}
          </View>
        )}

        {/* Gaveta de concluídas (tarefas + pendências) */}
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
              accessibilityLabel="Alternar visualização de concluídas"
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
                {doneRows.map((row) =>
                  row.kind === 'todo' && row.sourceTodo ? (
                    <TodoItem
                      key={`todo-${row.id}`}
                      todo={row.sourceTodo}
                      onToggle={onToggleTodo}
                      onDelete={onDeleteTodo}
                      onToggleSubtask={onToggleSubtask}
                      onAddSubtask={onAddSubtask}
                      onDeleteSubtask={onDeleteSubtask}
                      grouped
                    />
                  ) : row.sourcePending ? (
                    <PendingRow
                      key={`pending-${row.id}`}
                      row={row}
                      onToggle={pending.toggleComplete}
                      onDelete={pending.remove}
                      onSchedule={pending.schedule}
                      onReminder={setReminderItem}
                    />
                  ) : null,
                )}
              </View>
            )}
          </View>
        )}

        {/* Criação de tarefa completa (modal com prioridade) */}
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

      <ReminderSheet
        visible={!!reminderItem}
        item={reminderItem}
        saving={reminderSaving}
        error={reminderError}
        onClose={() => setReminderItem(null)}
        onSave={handleSaveReminder}
        onClear={handleClearReminder}
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  checklistSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: tokens.spacing.md,
    paddingRight: 8,
    paddingVertical: 8,
    marginBottom: tokens.spacing.sm,
    gap: 8,
  },
  quickInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  quickAdd: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pendingBody: {
    flex: 1,
    gap: 6,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  struck: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  pendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 12,
  },
  quickSchedule: {
    flexDirection: 'row',
    gap: 8,
  },
  schedChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  schedChipText: {
    fontSize: 12,
    fontWeight: '700',
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
});
