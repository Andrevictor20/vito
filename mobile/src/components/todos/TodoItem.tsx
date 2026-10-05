import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Todo } from '../../types';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSubtask?: (todoId: string, subtaskId: string) => void;
  onAddSubtask?: (todoId: string, title: string) => void;
  onDeleteSubtask?: (todoId: string, subtaskId: string) => void;
  isLast?: boolean;
  grouped?: boolean;
}

export const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  onToggle,
  onDelete,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  isLast = false,
  grouped = true,
}) => {
  const { colors, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const isCompleted = todo.status === 'completed';
  const subtasks = todo.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  const priorityStyle =
    todo.priority === 'high'
      ? { bg: colors.errorContainer, text: colors.onErrorContainer, label: 'ALTA' }
      : todo.priority === 'medium'
      ? { bg: isDark ? 'rgba(251, 191, 36, 0.18)' : 'rgba(245, 158, 11, 0.12)', text: colors.warning, label: 'MÉDIA' }
      : { bg: colors.surfaceContainerHighest, text: colors.onSurfaceVariant, label: 'BAIXA' };

  const handleCreateSubtask = () => {
    if (!newSubtaskTitle.trim()) {
      setIsAdding(false);
      return;
    }
    onAddSubtask?.(todo.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
    setIsAdding(false);
    setExpanded(true);
  };

  return (
    <View
      style={[
        grouped
          ? styles.groupedContainer
          : [styles.container, { backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant }],
        grouped && !isLast && [styles.bottomBorder, { borderBottomColor: colors.outlineVariant }],
      ]}
    >
      <View style={styles.mainRow}>
        {/* Checkbox M3 com cantos levemente arredondados */}
      <TouchableOpacity
        style={[
          styles.checkbox,
          { borderColor: isCompleted ? colors.primary : colors.outline },
          isCompleted && { backgroundColor: colors.primary },
        ]}
        onPress={() => onToggle(todo.id)}
        activeOpacity={0.75}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted }}
        accessibilityLabel={isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'}
        hitSlop={tokens.hitSlop.sm}
      >
        {isCompleted && <MaterialIcons name="check" size={14} color={colors.onPrimary} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.textContainer}
        onPress={() => onToggle(todo.id)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.title,
            { color: colors.onSurface },
            isCompleted && [styles.titleCompleted, { color: colors.textMuted }],
          ]}
          numberOfLines={2}
        >
          {todo.title}
        </Text>

        <View style={styles.badgesRow}>
          {todo.due_date ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={11} color={colors.onSurfaceVariant} />
              <Text style={[styles.dueDate, { color: colors.onSurfaceVariant }]}>
                {new Date(todo.due_date).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          ) : null}

          {todo.event_title ? (
            <View style={[styles.eventBadge, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
              <MaterialIcons name="event" size={11} color={colors.primary} />
              <Text style={[styles.eventBadgeText, { color: colors.onSurface }]} numberOfLines={1}>
                {todo.event_title}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Badge de Checklist / Subtarefas se existirem */}
      {(subtasks.length > 0 || isAdding) && (
        <TouchableOpacity
          style={[styles.checklistBadge, { backgroundColor: colors.surfaceContainerHighest }]}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
          accessibilityLabel="Alternar visualização de subtarefas"
        >
          <MaterialIcons name="checklist" size={13} color={colors.primary} />
          <Text style={[styles.checklistBadgeText, { color: colors.onSurface }]}>
            {completedSubtasks}/{subtasks.length}
          </Text>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={14}
            color={colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      )}

      {/* Badge de prioridade (se não for baixa) */}
      {todo.priority !== 'low' && !isCompleted && (
        <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
          <Text style={[styles.priorityText, { color: priorityStyle.text }]}>
            {priorityStyle.label}
          </Text>
        </View>
      )}

      {/* Botões de Ação */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            setExpanded(true);
            setIsAdding(true);
          }}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Adicionar subtarefa"
        >
          <MaterialIcons name="add-task" size={16} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => onDelete(todo.id)}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Excluir tarefa"
        >
          <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </View>

    {/* Seção Expansível de Subtarefas */}
    {expanded && (
      <View style={[styles.subtasksSection, { borderTopColor: colors.outlineVariant }]}>
        {subtasks.map((st) => (
          <View key={st.id} style={styles.subtaskRow}>
            <TouchableOpacity
              style={[
                styles.subtaskCheckbox,
                { borderColor: st.completed ? colors.primary : colors.outline },
                st.completed && { backgroundColor: colors.primary },
              ]}
              onPress={() => onToggleSubtask?.(todo.id, st.id)}
              activeOpacity={0.75}
              hitSlop={tokens.hitSlop.sm}
            >
              {st.completed && <MaterialIcons name="check" size={11} color={colors.onPrimary} />}
            </TouchableOpacity>

            <Text
              style={[
                styles.subtaskTitle,
                { color: colors.onSurface },
                st.completed && [styles.subtaskTitleCompleted, { color: colors.textMuted }],
              ]}
              numberOfLines={2}
              onPress={() => onToggleSubtask?.(todo.id, st.id)}
            >
              {st.title}
            </Text>

            <TouchableOpacity
              style={styles.subtaskDeleteBtn}
              onPress={() => onDeleteSubtask?.(todo.id, st.id)}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Excluir subtarefa"
            >
              <MaterialIcons name="close" size={13} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Formulário de inclusão rápida de subtarefa */}
        {isAdding ? (
          <View style={styles.addSubtaskRow}>
            <TextInput
              style={[
                styles.subtaskInput,
                {
                  color: colors.onSurface,
                  backgroundColor: colors.surfaceContainerHighest,
                  borderColor: colors.outlineVariant,
                },
              ]}
              placeholder="Título da subtarefa..."
              placeholderTextColor={colors.onSurfaceVariant}
              value={newSubtaskTitle}
              onChangeText={setNewSubtaskTitle}
              autoFocus
              onSubmitEditing={handleCreateSubtask}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.subtaskActionBtn, { backgroundColor: colors.primary }]}
              onPress={handleCreateSubtask}
            >
              <MaterialIcons name="check" size={14} color={colors.onPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subtaskActionBtn, { backgroundColor: colors.surfaceContainerHighest }]}
              onPress={() => {
                setIsAdding(false);
                setNewSubtaskTitle('');
              }}
            >
              <MaterialIcons name="close" size={14} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addInlineBtn}
            onPress={() => setIsAdding(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add" size={14} color={colors.primary} />
            <Text style={[styles.addInlineText, { color: colors.primary }]}>Adicionar subtarefa</Text>
          </TouchableOpacity>
        )}
      </View>
    )}
  </View>
  );
};

const styles = StyleSheet.create({
  groupedContainer: {
    paddingVertical: tokens.spacing.sm,
  },
  bottomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.outlineVariant,
  },
  container: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: MD3Shapes.medium,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: tokens.spacing.sm + 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: tokens.typography.size.bodyMedium,
    color: tokens.colors.onSurface,
    fontWeight: tokens.typography.weight.medium,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: tokens.colors.textMuted,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dueDate: {
    fontSize: 10,
    color: tokens.colors.textMuted,
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: MD3Shapes.extraSmall,
    borderWidth: 1,
    maxWidth: 160,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.medium,
  },
  checklistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: MD3Shapes.small,
  },
  checklistBadgeText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.semibold,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: MD3Shapes.small,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconButton: {
    padding: tokens.spacing.xs,
  },
  subtasksSection: {
    marginTop: tokens.spacing.xs,
    paddingTop: tokens.spacing.xs,
    paddingLeft: 14,
    marginLeft: 10,
    borderLeftWidth: 2,
    borderTopWidth: 0,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  subtaskCheckbox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: tokens.typography.weight.regular,
  },
  subtaskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  subtaskDeleteBtn: {
    padding: 3,
  },
  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  subtaskInput: {
    flex: 1,
    height: 32,
    fontSize: 12,
    paddingHorizontal: 8,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
  },
  subtaskActionBtn: {
    width: 28,
    height: 28,
    borderRadius: MD3Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    marginTop: 2,
  },
  addInlineText: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.medium,
  },
});
