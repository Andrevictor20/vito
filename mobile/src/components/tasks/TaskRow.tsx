import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import type { PendingItem, Subtask } from '../../types';
import type { UnifiedRow } from '../../utils/unifiedTasks';
import { formatRelativeTaskDate, getTaskDiffDays } from '../../utils/taskBuckets';
import { TaskSubtasksInline } from './TaskSubtasksInline';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

export const formatRowDate = (row: UnifiedRow): string | null => {
  const src = row.sourceTodo?.due_date || row.sourcePending?.scheduled_date;
  if (!src) return null;
  return formatRelativeTaskDate(src);
};

interface TaskRowProps {
  row: UnifiedRow;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onSchedule?: (dateStr: string) => void;
  onReminder?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  subtasks?: Subtask[];
  onToggleSubtask?: (subtaskId: string) => void;
  onAddSubtask?: (title: string) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
}

/**
 * Linha de tarefa (.task) fiel a vito-telas.html.
 * - Checkbox circular .chk (26x26px) que preenche de roxo (colors.purple)
 * - Título em 15.5px semibold (Inter_600SemiBold)
 * - Pill de prazo relativo (vermelho se atrasada)
 * - Mini barra de progresso para subtarefas (.prog: 34x4px)
 * - Ícone de sino de lembrete em pill
 */
export const TaskRow: React.FC<TaskRowProps> = ({
  row,
  onToggle,
  onDelete,
  onEdit,
  onSchedule,
  onReminder,
  isFirst = false,
  subtasks,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
}) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isTodo = row.kind === 'todo';
  const todo = row.sourceTodo;
  const pending: PendingItem | undefined = row.sourcePending;

  const dateRaw = todo?.due_date || pending?.scheduled_date;
  const relDate = formatRelativeTaskDate(dateRaw);
  const diffDays = getTaskDiffDays(dateRaw);
  const isOverdue = diffDays !== null && diffDays < 0;

  const showSchedule = !isTodo && !row.done && pending?.status !== 'scheduled' && onSchedule;
  const hasReminder = !!pending?.remind_at || !!todo?.remind_at;

  const totalSubs = subtasks?.length || 0;
  const doneSubs = subtasks?.filter((s) => s.completed).length || 0;
  const subPercent = totalSubs > 0 ? (doneSubs / totalSubs) * 100 : 0;

  const toggleSubtasks = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View
      style={[
        styles.row,
        !isFirst && { borderTopWidth: 1, borderTopColor: colors.line },
      ]}
    >
      {/* Checkbox circular .chk 26x26px */}
      <TouchableOpacity
        style={[
          styles.chk,
          {
            borderColor: row.done ? colors.purple : colors.muted,
            backgroundColor: row.done ? colors.purple : 'transparent',
          },
        ]}
        onPress={() => {
          hapticFeedback.selection();
          onToggle();
        }}
        activeOpacity={0.7}
        hitSlop={tokens.hitSlop.sm}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.done }}
        accessibilityLabel={row.done ? 'Reabrir tarefa' : 'Concluir tarefa'}
      >
        {row.done && <MaterialIcons name="check" size={14} color="#ffffff" />}
      </TouchableOpacity>

      {/* Conteúdo da tarefa */}
      <View style={styles.body}>
        <TouchableOpacity
          onPress={onEdit}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Editar tarefa: ${row.title}`}
        >
          <Text
            style={[
              styles.title,
              {
                color: colors.ink,
                fontFamily: tokens.typography.family.semibold,
              },
              row.done && styles.struck,
            ]}
            numberOfLines={3}
          >
            {row.title}
          </Text>
        </TouchableOpacity>

        {/* Metadados: prazo relativo, subtarefas, sino */}
        {(relDate || totalSubs > 0 || hasReminder || onAddSubtask) && (
          <View style={styles.metaRow}>
            {relDate ? (
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: isOverdue ? colors.redBg : colors.surf,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    {
                      color: isOverdue ? colors.red : colors.muted,
                      fontFamily: tokens.typography.family.semibold,
                    },
                  ]}
                >
                  {relDate}
                </Text>
              </View>
            ) : null}

            {/* Mini barra de progresso para subtarefas (.prog: 34x4px) */}
            {isTodo && (totalSubs > 0 || onAddSubtask) ? (
              <TouchableOpacity
                style={styles.progContainer}
                onPress={toggleSubtasks}
                activeOpacity={0.7}
                hitSlop={tokens.hitSlop.sm}
                accessibilityRole="button"
                accessibilityLabel={`${doneSubs} de ${totalSubs} subtarefas`}
              >
                {totalSubs > 0 ? (
                  <>
                    <View style={[styles.progTrack, { backgroundColor: colors.line }]}>
                      <View
                        style={[
                          styles.progBar,
                          {
                            width: `${subPercent}%`,
                            backgroundColor: colors.purple,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.progText,
                        {
                          color: colors.muted,
                          fontFamily: tokens.typography.family.semibold,
                        },
                      ]}
                    >
                      {doneSubs}/{totalSubs}
                    </Text>
                  </>
                ) : (
                  <View style={[styles.pill, { backgroundColor: colors.surf }]}>
                    <Text
                      style={[
                        styles.pillText,
                        {
                          color: colors.muted,
                          fontFamily: tokens.typography.family.semibold,
                        },
                      ]}
                    >
                      + subtarefas
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}

            {/* Sino de lembrete */}
            {hasReminder && !row.done && (
              <View style={[styles.pill, styles.bellPill, { backgroundColor: colors.surf }]}>
                <MaterialIcons name="notifications" size={12} color={colors.purple} />
              </View>
            )}
          </View>
        )}

        {/* Agendamento rápido de pendências */}
        {showSchedule && (
          <View style={styles.quickSchedule}>
            <TouchableOpacity
              style={[styles.schedChip, { borderColor: colors.line, backgroundColor: colors.bg }]}
              onPress={() => onSchedule(isoDay(0))}
              activeOpacity={0.7}
              accessibilityLabel="Agendar para hoje"
            >
              <Text style={[styles.schedChipText, { color: colors.ink }]}>Hoje</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.schedChip, { borderColor: colors.line, backgroundColor: colors.bg }]}
              onPress={() => onSchedule(isoDay(1))}
              activeOpacity={0.7}
              accessibilityLabel="Agendar para amanhã"
            >
              <Text style={[styles.schedChipText, { color: colors.ink }]}>Amanhã</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Subtarefas inline */}
        {isTodo && expanded && (
          <TaskSubtasksInline
            subtasks={subtasks}
            onToggleSubtask={onToggleSubtask}
            onAddSubtask={onAddSubtask}
            onDeleteSubtask={onDeleteSubtask}
          />
        )}
      </View>

      {/* Ações laterais discretas */}
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
              name={hasReminder ? 'notifications' : 'notifications-none'}
              size={18}
              color={hasReminder ? colors.purple : colors.muted}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onDelete}
          hitSlop={tokens.hitSlop.sm}
          activeOpacity={0.7}
          accessibilityLabel="Excluir tarefa"
        >
          <MaterialIcons name="delete-outline" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  chk: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15.5,
    fontWeight: '600',
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  struck: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 7,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 10,
  },
  bellPill: {
    paddingHorizontal: 7,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  progContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progTrack: {
    width: 34,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progBar: {
    height: '100%',
    borderRadius: 2,
  },
  progText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  quickSchedule: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  schedChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  schedChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  actionBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
