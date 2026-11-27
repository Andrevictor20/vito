import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { tokens } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { hapticFeedback } from '../../../theme/motion';
import type { PendingItem, Subtask } from '../../../types';
import type { UnifiedRow } from '../utils/unifiedTasks';
import { formatRelativeTaskDate, getTaskDiffDays } from '../utils/taskBuckets';
import type { TaskListDef } from '../utils/taskQuickAddParser';
import { TaskSubtasksInline } from './TaskSubtasksInline';
import { TaskVfxBurst } from './TaskVfxBurst';
import { ConfirmDeleteModal } from '../../../components/ui/ConfirmDeleteModal';

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
  listDef?: TaskListDef;
  hideList?: boolean;
  onToggle: () => void;
  onPostpone?: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onAiAction?: () => void;
  onSchedule?: (dateStr: string) => void;
  onReminder?: () => void;
  isFirst?: boolean;
  subtasks?: Subtask[];
  onToggleSubtask?: (subtaskId: string) => void;
  onAddSubtask?: (title: string) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
}

const SWIPE_THRESHOLD = 90;

export const TaskRow: React.FC<TaskRowProps> = ({
  row,
  listDef,
  hideList = false,
  onToggle,
  onPostpone,
  onDelete,
  onEdit,
  onAiAction,
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
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [vfxKey, setVfxKey] = useState(0);
  const [swipeSide, setSwipeSide] = useState<'none' | 'right' | 'left'>('none');

  const translateX = useRef(new Animated.Value(0)).current;

  const triggerCompleteWithBurst = () => {
    hapticFeedback.success();
    setVfxKey((k) => k + 1);
    setTimeout(() => {
      onToggle();
    }, 260);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          !row.done && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
        onPanResponderMove: (_evt, g) => {
          const damp = Math.abs(g.dx) > 100 ? 100 + (Math.abs(g.dx) - 100) * 0.35 : Math.abs(g.dx);
          const signed = g.dx < 0 ? -damp : damp;
          translateX.setValue(signed);
          setSwipeSide(g.dx > 12 ? 'right' : g.dx < -12 ? 'left' : 'none');
        },
        onPanResponderRelease: (_evt, g) => {
          if (g.dx > SWIPE_THRESHOLD) {
            Animated.timing(translateX, { toValue: 0, duration: 180, useNativeDriver: true }).start();
            setSwipeSide('none');
            triggerCompleteWithBurst();
            return;
          }
          if (g.dx < -SWIPE_THRESHOLD && onPostpone) {
            Animated.timing(translateX, { toValue: 0, duration: 180, useNativeDriver: true }).start();
            setSwipeSide('none');
            hapticFeedback.selection();
            onPostpone();
            return;
          }
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() =>
            setSwipeSide('none')
          );
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() =>
            setSwipeSide('none')
          );
        },
      }),
    [row.done, onPostpone, translateX]
  );

  const isTodo = row.kind === 'todo';
  const todo = row.sourceTodo;
  const pending: PendingItem | undefined = row.sourcePending;

  const dateRaw = todo?.due_date || pending?.scheduled_date;
  const relDate = formatRelativeTaskDate(dateRaw);
  const diffDays = getTaskDiffDays(dateRaw);
  const isOverdue = diffDays !== null && diffDays < 0;
  const isToday = diffDays === 0;
  const isTomorrow = diffDays === 1;

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
    <>
      <View style={styles.swipeWrap}>
        {swipeSide !== 'none' && (
          <View
            style={[
              styles.swipeBg,
              {
                backgroundColor: swipeSide === 'right' ? colors.greenBg : colors.blueBg,
                justifyContent: swipeSide === 'right' ? 'flex-start' : 'flex-end',
              },
            ]}
          >
            <ProtoUiIcon
              name={swipeSide === 'right' ? 'check-circle' : 'schedule'}
              size={20}
              color={swipeSide === 'right' ? colors.acc : colors.blue}
            />
            <Text
              style={[
                styles.swipeBgText,
                { color: swipeSide === 'right' ? colors.acc : colors.blue },
              ]}
            >
              {swipeSide === 'right' ? 'Concluir' : 'Amanhã'}
            </Text>
          </View>
        )}

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.row,
            { backgroundColor: colors.bg, transform: [{ translateX }] },
            !isFirst && { borderTopWidth: 1, borderTopColor: colors.line },
          ]}
        >
          <TaskVfxBurst triggerKey={vfxKey} />

          <TouchableOpacity
            style={[
              styles.chk,
              {
                borderColor: row.done ? colors.purple : colors.muted,
                backgroundColor: row.done ? colors.purple : 'transparent',
              },
            ]}
            onPress={() => (row.done ? onToggle() : triggerCompleteWithBurst())}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: row.done }}
            accessibilityLabel={row.done ? 'Reabrir tarefa' : 'Concluir tarefa'}
          >
            {row.done && <ProtoUiIcon name="check" size={14} color="#ffffff" />}
          </TouchableOpacity>

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
                  { color: colors.ink, fontFamily: tokens.typography.family.semibold },
                  row.done && styles.struck,
                ]}
                numberOfLines={3}
              >
                {row.title}
              </Text>
            </TouchableOpacity>

            {(relDate || (!hideList && listDef) || row.priority === 'high' || totalSubs > 0 || hasReminder || onAddSubtask) && (
              <View style={styles.metaRow}>
                {relDate ? (
                  <View
                    style={[
                      styles.pill,
                      {
                        backgroundColor: isOverdue
                          ? colors.redBg
                          : isToday
                            ? colors.greenBg
                            : isTomorrow
                              ? colors.orangeBg
                              : colors.surf,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        {
                          color: isOverdue
                            ? colors.red
                            : isToday
                              ? colors.acc
                              : isTomorrow
                                ? colors.orange
                                : colors.muted,
                          fontFamily: tokens.typography.family.semibold,
                        },
                      ]}
                    >
                      {relDate}
                    </Text>
                  </View>
                ) : null}

                {!hideList && listDef && (
                  <View style={[styles.pill, { backgroundColor: colors.surf }]}>
                    <View style={[styles.listDot, { backgroundColor: listDef.color }]} />
                    <Text style={[styles.pillText, { color: colors.ink }]}>{listDef.name}</Text>
                  </View>
                )}

                {row.priority === 'high' && (
                  <View style={[styles.pill, { backgroundColor: colors.redBg }]}>
                    <Text style={[styles.pillText, { color: colors.red }]}>Alta</Text>
                  </View>
                )}

                {isTodo && (totalSubs > 0 || onAddSubtask) ? (
                  <TouchableOpacity
                    style={styles.progContainer}
                    onPress={toggleSubtasks}
                    activeOpacity={0.7}
                    hitSlop={tokens.hitSlop.sm}
                  >
                    {totalSubs > 0 ? (
                      <>
                        <View style={[styles.progTrack, { backgroundColor: colors.line }]}>
                          <View
                            style={[
                              styles.progBar,
                              { width: `${subPercent}%`, backgroundColor: colors.purple },
                            ]}
                          />
                        </View>
                        <Text style={[styles.progText, { color: colors.muted }]}>
                          {doneSubs}/{totalSubs}
                        </Text>
                      </>
                    ) : (
                      <View style={[styles.pill, { backgroundColor: colors.surf }]}>
                        <Text style={[styles.pillText, { color: colors.muted }]}>+ subtarefas</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : null}

                {hasReminder && !row.done && (
                  <View style={[styles.pill, styles.bellPill, { backgroundColor: colors.surf }]}>
                    <ProtoUiIcon name="notifications" size={12} color={colors.purple} />
                  </View>
                )}
              </View>
            )}

            {showSchedule && (
              <View style={styles.quickSchedule}>
                <TouchableOpacity
                  style={[styles.schedChip, { borderColor: colors.line, backgroundColor: colors.bg }]}
                  onPress={() => onSchedule(isoDay(0))}
                >
                  <Text style={[styles.schedChipText, { color: colors.ink }]}>Hoje</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.schedChip, { borderColor: colors.line, backgroundColor: colors.bg }]}
                  onPress={() => onSchedule(isoDay(1))}
                >
                  <Text style={[styles.schedChipText, { color: colors.ink }]}>Amanhã</Text>
                </TouchableOpacity>
              </View>
            )}

            {isTodo && expanded && (
              <TaskSubtasksInline
                subtasks={subtasks}
                onToggleSubtask={onToggleSubtask}
                onAddSubtask={onAddSubtask}
                onDeleteSubtask={onDeleteSubtask}
              />
            )}
          </View>

          <View style={styles.actions}>
            {onReminder && !row.done && (
              <TouchableOpacity style={styles.actionBtn} onPress={onReminder} hitSlop={tokens.hitSlop.sm}>
                <ProtoUiIcon
                  name={hasReminder ? 'notifications' : 'notifications-none'}
                  size={18}
                  color={hasReminder ? colors.purple : colors.muted}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={onAiAction || onEdit} hitSlop={tokens.hitSlop.sm}>
              <ProtoUiIcon name="auto-awesome" size={17} color={colors.purple} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setDeleteModalVisible(true)}
              hitSlop={tokens.hitSlop.sm}
            >
              <ProtoUiIcon name="delete-outline" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      <ConfirmDeleteModal
        visible={deleteModalVisible}
        title="Excluir tarefa"
        message={`Deseja realmente excluir "${row.title}"?`}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={onDelete}
      />
    </>
  );
};

const styles = StyleSheet.create({
  swipeWrap: { position: 'relative', overflow: 'hidden' },
  swipeBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    gap: 8,
  },
  swipeBgText: { fontSize: 13, fontWeight: '700' },
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
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 15.5, fontWeight: '600', lineHeight: 21, letterSpacing: -0.1 },
  struck: { textDecorationLine: 'line-through', opacity: 0.6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  listDot: { width: 7, height: 7, borderRadius: 3.5 },
  bellPill: { paddingHorizontal: 7 },
  pillText: { fontSize: 12, fontWeight: '600', lineHeight: 15 },
  progContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progTrack: { width: 34, height: 4, borderRadius: 2, overflow: 'hidden' },
  progBar: { height: '100%', borderRadius: 2 },
  progText: { fontSize: 12, fontWeight: '600', lineHeight: 15, fontVariant: ['tabular-nums'] },
  quickSchedule: { flexDirection: 'row', gap: 8, marginTop: 8 },
  schedChip: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  schedChipText: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  actionBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
