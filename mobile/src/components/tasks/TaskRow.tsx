import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import type { PendingItem, Subtask } from '../../types';
import type { UnifiedRow } from '../../utils/unifiedTasks';

export const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

export const formatRowDate = (row: UnifiedRow): string | null => {
  const src = row.sourceTodo?.due_date || row.sourcePending?.scheduled_date;
  if (!src) return null;
  const d = new Date(src.length === 10 ? `${src}T12:00:00` : src);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

interface TaskRowProps {
  row: UnifiedRow;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onSchedule?: (dateStr: string) => void;
  onReminder?: () => void;
  /** Última linha do grupo: sem divisor inferior. */
  isLast?: boolean;
  subtasks?: Subtask[];
  onToggleSubtask?: (subtaskId: string) => void;
  onAddSubtask?: (title: string) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
}

const PRIORITY_LABEL: Record<string, string> = { high: 'ALTA', medium: 'MÉDIA', low: 'BAIXA' };

/** Linha única p/ tarefa e pendência: mesmo checkbox, título, meta e ações. */
const PRIORITY_DOT: Record<string, 'error' | 'warning' | 'muted'> = { high: 'error', medium: 'warning', low: 'muted' };

export const TaskRow: React.FC<TaskRowProps> = ({
  row,
  onToggle,
  onDelete,
  onEdit,
  onSchedule,
  onReminder,
  isLast = false,
  subtasks,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
}) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const isTodo = row.kind === 'todo';
  const todo = row.sourceTodo;
  const pending: PendingItem | undefined = row.sourcePending;
  const dateLabel = formatRowDate(row);
  const showSchedule = !isTodo && !row.done && pending?.status !== 'scheduled' && onSchedule;
  const hasReminder = !!pending?.remind_at || !!todo?.remind_at;

  const submitSubtask = () => {
    if (!draft.trim() || !onAddSubtask) return;
    onAddSubtask(draft.trim());
    setDraft('');
  };

  const dotKind = PRIORITY_DOT[todo?.priority || 'medium'] || 'muted';
  const dotColor = dotKind === 'error' ? colors.error : dotKind === 'warning' ? colors.warning : colors.onSurfaceVariant;

  return (
    <View style={[styles.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant }]}>
      <TouchableOpacity
        style={[
          styles.checkCircle,
          { borderColor: row.done ? colors.primary : colors.outline },
          row.done && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
        onPress={() => {
          hapticFeedback.selection();
          onToggle();
        }}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.done }}
        accessibilityLabel={row.done ? 'Reabrir (desfazer conclusão)' : 'Concluir'}
      >
        {row.done && <MaterialIcons name="check" size={16} color={colors.onPrimary} />}
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.onSurface }, row.done && styles.struck]} numberOfLines={3}>
          {row.title}
        </Text>

        <View style={styles.meta}>
          {isTodo && todo ? (
            <View style={[styles.badge, { backgroundColor: colors.secondaryContainer }]}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              <Text style={[styles.badgeText, { color: colors.onSecondaryContainer }]}>
                {PRIORITY_LABEL[todo.priority] || 'MÉDIA'}
              </Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: colors.tertiaryContainer }]}>
              <Text style={[styles.badgeText, { color: colors.onTertiaryContainer }]}>Pendência</Text>
            </View>
          )}
          {dateLabel ? (
            <Text style={[styles.dateText, { color: row.overdue ? colors.error : colors.onSurfaceVariant }]}>
              {row.overdue ? `Atrasada · ${dateLabel}` : dateLabel}
            </Text>
          ) : (
            <Text style={[styles.dateText, { color: colors.onSurfaceVariant }]}>Sem data</Text>
          )}
          {hasReminder && !row.done && (
            <MaterialIcons name="notifications-active" size={14} color={colors.primary} />
          )}
          {isTodo && ((subtasks?.length || 0) > 0 || onAddSubtask) ? (
            <TouchableOpacity
              onPress={() => setExpanded(!expanded)}
              hitSlop={tokens.hitSlop.sm}
              activeOpacity={0.7}
              accessibilityLabel={expanded ? 'Ocultar subtarefas' : 'Ver subtarefas'}
            >
              <Text style={[styles.subCount, { color: colors.primary }]}>
                {(subtasks?.length || 0) > 0
                  ? `${subtasks?.filter((s) => s.completed).length || 0}/${subtasks?.length || 0}`
                  : '+ subtarefas'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {showSchedule && (
          <View style={styles.quickSchedule}>
            <TouchableOpacity
              style={[styles.schedChip, { borderColor: colors.outlineVariant }]}
              onPress={() => onSchedule(isoDay(0))}
              activeOpacity={0.7}
              accessibilityLabel="Agendar para hoje"
            >
              <Text style={[styles.schedChipText, { color: colors.primary }]}>Hoje</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.schedChip, { borderColor: colors.outlineVariant }]}
              onPress={() => onSchedule(isoDay(1))}
              activeOpacity={0.7}
              accessibilityLabel="Agendar para amanhã"
            >
              <Text style={[styles.schedChipText, { color: colors.primary }]}>Amanhã</Text>
            </TouchableOpacity>
          </View>
        )}

        {isTodo && expanded && (
          <View style={styles.subList}>
            {(subtasks || []).map((s) => (
              <View key={s.id} style={styles.subRow}>
                <TouchableOpacity
                  style={[
                    styles.subCheck,
                    { borderColor: colors.outline },
                    s.completed && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => onToggleSubtask?.(s.id)}
                  activeOpacity={0.7}
                  accessibilityLabel={s.completed ? 'Reabrir subtarefa' : 'Concluir subtarefa'}
                >
                  {s.completed && <MaterialIcons name="check" size={12} color={colors.onPrimary} />}
                </TouchableOpacity>
                <Text
                  style={[styles.subTitle, { color: colors.onSurfaceVariant }, s.completed && styles.struck]}
                  numberOfLines={2}
                >
                  {s.title}
                </Text>
                <TouchableOpacity
                  onPress={() => onDeleteSubtask?.(s.id)}
                  hitSlop={tokens.hitSlop.sm}
                  accessibilityLabel="Excluir subtarefa"
                >
                  <MaterialIcons name="close" size={14} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            ))}
            {onAddSubtask && (
              <View style={styles.subAddRow}>
                <TextInput
                  style={[styles.subInput, { color: colors.onSurface }]}
                  placeholder="Adicionar subtarefa"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={submitSubtask}
                  returnKeyType="done"
                  accessibilityLabel="Nova subtarefa"
                />
                <TouchableOpacity onPress={submitSubtask} hitSlop={tokens.hitSlop.sm} accessibilityLabel="Adicionar subtarefa">
                  <MaterialIcons name="add" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {onReminder && !row.done && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onReminder}
            hitSlop={tokens.hitSlop.sm}
            activeOpacity={0.7}
            accessibilityLabel={hasReminder ? 'Editar lembrete' : 'Configurar lembrete'}
          >
            <MaterialIcons
              name={hasReminder ? 'notifications-active' : 'notifications-none'}
              size={20}
              color={hasReminder ? colors.primary : colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
        {onEdit && !row.done && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onEdit}
            hitSlop={tokens.hitSlop.sm}
            activeOpacity={0.7}
            accessibilityLabel="Editar item"
          >
            <MaterialIcons name="edit" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onDelete}
          hitSlop={tokens.hitSlop.sm}
          activeOpacity={0.7}
          accessibilityLabel="Excluir item"
        >
          <MaterialIcons name="delete-outline" size={20} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
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
  body: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  struck: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  subCount: {
    fontSize: 12,
    fontWeight: '700',
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
  subList: {
    gap: 8,
    marginTop: 2,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTitle: {
    flex: 1,
    fontSize: 13,
  },
  subAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
