import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { useTheme } from '../../../../context/ThemeContext';
import { hapticFeedback } from '../../../../theme/motion';
import { BottomSheetModal } from '../../../../components/ui/BottomSheetModal';
import type { UnifiedRow } from '../../utils/unifiedTasks';
import { formatRelativeTaskDate } from '../../utils/taskBuckets';
import { formatIsoDate, TaskListDef } from '../../utils/taskQuickAddParser';

interface TaskDetailSheetProps {
  visible: boolean;
  row: UnifiedRow | null;
  lists: TaskListDef[];
  onClose: () => void;
  onUpdateTodo: (id: string, data: { category?: string; due_date?: string; priority?: string }) => Promise<void> | void;
  onToggleTodo: () => void;
  onToggleSubtask: (subId: string) => void;
  onAddSubtask: (title: string) => Promise<void> | void;
  onDeleteSubtask: (subId: string) => void;
  onDeleteTask: () => void;
}

function offsetIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatIsoDate(d);
}

export const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({
  visible,
  row,
  lists,
  onClose,
  onUpdateTodo,
  onToggleTodo,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onDeleteTask,
}) => {
  const { colors } = useTheme();
  const [subDraft, setSubDraft] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  if (!row) return null;

  const todo = row.sourceTodo;
  const subtasks = todo?.subtasks || [];
  const doneSubs = subtasks.filter((s) => s.completed).length;
  const dueRaw = todo?.due_date || row.sourcePending?.scheduled_date;
  const relDate = formatRelativeTaskDate(dueRaw) || 'Sem prazo';
  const listId = todo?.category || lists[0]?.id || 'trabalho';
  const activeList = lists.find((l) => l.id === listId) || lists[0];

  const todayIso = offsetIso(0);
  const tomorrowIso = offsetIso(1);
  const nextWeekIso = offsetIso(7);
  const dueDatePrefix = dueRaw ? dueRaw.slice(0, 10) : '';

  const handleAddSub = async () => {
    const val = subDraft.trim();
    if (!val) return;
    setSubDraft('');
    await onAddSubtask(val);
  };

  const handleAiSubtasks = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    hapticFeedback.medium();
    try {
      await onAddSubtask('Definir escopo e checklist inicial');
      await onAddSubtask('Executar etapa principal e revisar');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={row.title}
      subtitle={`${activeList?.name || 'Geral'} · ${relDate}`}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {todo && (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>Lista</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {lists.map((l) => {
                const active = l.id === listId;
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.ink : colors.surf,
                        borderColor: active ? colors.ink : colors.line,
                      },
                    ]}
                    onPress={() => onUpdateTodo(todo.id, { category: l.id })}
                  >
                    <View style={[styles.dot, { backgroundColor: l.color }]} />
                    <Text style={[styles.chipText, { color: active ? colors.bg : colors.ink }]}>
                      {l.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: colors.muted }]}>Prazo e prioridade</Text>
            <View style={styles.wrapRow}>
              {[
                { label: 'Hoje', val: todayIso },
                { label: 'Amanhã', val: tomorrowIso },
                { label: 'Próx. semana', val: nextWeekIso },
                { label: 'Sem data', val: '' },
              ].map((opt) => {
                const active = dueDatePrefix === opt.val;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.ink : colors.surf,
                        borderColor: active ? colors.ink : colors.line,
                      },
                    ]}
                    onPress={() => onUpdateTodo(todo.id, { due_date: opt.val })}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.bg : colors.ink }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: todo.priority === 'high' ? colors.red : colors.surf,
                    borderColor: todo.priority === 'high' ? colors.red : colors.line,
                  },
                ]}
                onPress={() =>
                  onUpdateTodo(todo.id, {
                    priority: todo.priority === 'high' ? 'medium' : 'high',
                  })
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: todo.priority === 'high' ? '#fff' : colors.ink },
                  ]}
                >
                  Prioridade alta
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.muted }]}>
              Subtarefas ({doneSubs}/{subtasks.length})
            </Text>
            {subtasks.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.surf }]}>
                <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhuma subtarefa.</Text>
              </View>
            ) : (
              <View style={[styles.subList, { backgroundColor: colors.surf }]}>
                {subtasks.map((s) => (
                  <View key={s.id} style={styles.subRow}>
                    <TouchableOpacity
                      style={[
                        styles.subChk,
                        {
                          borderColor: s.completed ? colors.purple : colors.muted,
                          backgroundColor: s.completed ? colors.purple : 'transparent',
                        },
                      ]}
                      onPress={() => onToggleSubtask(s.id)}
                    >
                      {s.completed && <ProtoUiIcon name="check" size={12} color="#fff" />}
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.subTitle,
                        { color: colors.ink },
                        s.completed && styles.struck,
                      ]}
                    >
                      {s.title}
                    </Text>
                    <TouchableOpacity onPress={() => onDeleteSubtask(s.id)} hitSlop={8}>
                      <ProtoUiIcon name="close" size={16} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.subAddRow}>
              <TextInput
                style={[
                  styles.subInput,
                  { backgroundColor: colors.surf, borderColor: colors.line, color: colors.ink },
                ]}
                value={subDraft}
                onChangeText={setSubDraft}
                placeholder="Nova subtarefa..."
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                onSubmitEditing={handleAddSub}
              />
              <TouchableOpacity
                style={[styles.subAddBtn, { backgroundColor: colors.surf, borderColor: colors.line }]}
                onPress={handleAddSub}
              >
                <Text style={[styles.subAddBtnText, { color: colors.ink }]}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.footerActions}>
          {todo && (
            <TouchableOpacity
              style={[styles.secBtn, { backgroundColor: colors.surf, borderColor: colors.line }]}
              onPress={handleAiSubtasks}
              disabled={aiBusy}
            >
              <ProtoUiIcon name="auto-awesome" size={16} color={colors.purple} />
              <Text style={[styles.secBtnText, { color: colors.ink }]}>Subtarefas IA</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.priBtn, { backgroundColor: colors.ink }]}
            onPress={() => {
              onToggleTodo();
              onClose();
            }}
          >
            <Text style={[styles.priBtnText, { color: colors.bg }]}>
              {row.done ? 'Reabrir' : 'Concluir'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.delBtn, { borderColor: colors.red }]}
          onPress={() => {
            onDeleteTask();
            onClose();
          }}
        >
          <Text style={[styles.delBtnText, { color: colors.red }]}>Excluir tarefa</Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 28 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 8,
  },
  chipsRow: { gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  emptyBox: { borderRadius: 14, padding: 12 },
  emptyText: { fontSize: 13 },
  subList: { borderRadius: 16, padding: 12, gap: 10 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subChk: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTitle: { flex: 1, fontSize: 13.5 },
  struck: { textDecorationLine: 'line-through', opacity: 0.6 },
  subAddRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  subInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13.5,
  },
  subAddBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  subAddBtnText: { fontSize: 13, fontWeight: '600' },
  footerActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  secBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secBtnText: { fontSize: 13.5, fontWeight: '600' },
  priBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priBtnText: { fontSize: 14, fontWeight: '600' },
  delBtn: {
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  delBtnText: { fontSize: 13.5, fontWeight: '600' },
});
