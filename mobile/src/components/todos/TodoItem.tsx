import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { Todo } from '../../types';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  isLast?: boolean;
  grouped?: boolean;
}

export const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  onToggle,
  onDelete,
  isLast = false,
  grouped = true,
}) => {
  const isCompleted = todo.status === 'completed';

  const priorityStyle =
    todo.priority === 'high'
      ? { bg: tokens.colors.errorContainer, text: tokens.colors.error, label: 'ALTA' }
      : todo.priority === 'medium'
      ? { bg: 'rgba(255, 217, 102, 0.2)', text: tokens.colors.warning, label: 'MÉDIA' }
      : { bg: tokens.colors.surfaceContainerHighest, text: tokens.colors.onSurfaceVariant, label: 'BAIXA' };

  return (
    <View
      style={[
        grouped ? styles.groupedRow : styles.container,
        grouped && !isLast && styles.bottomBorder,
      ]}
    >
      {/* Checkbox M3 com cantos levemente arredondados */}
      <TouchableOpacity
        style={[styles.checkbox, isCompleted && styles.checkboxChecked]}
        onPress={() => onToggle(todo.id)}
        activeOpacity={0.75}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted }}
        accessibilityLabel={isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'}
        hitSlop={tokens.hitSlop.sm}
      >
        {isCompleted && <MaterialIcons name="check" size={14} color={tokens.colors.onPrimary} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.textContainer}
        onPress={() => onToggle(todo.id)}
        activeOpacity={0.7}
      >
        <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={2}>
          {todo.title}
        </Text>
        {todo.due_date ? (
          <Text style={styles.dueDate}>
            {new Date(todo.due_date).toLocaleDateString('pt-BR')}
          </Text>
        ) : null}
      </TouchableOpacity>

      {/* Badge de prioridade (se não for baixa) */}
      {todo.priority !== 'low' && !isCompleted && (
        <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
          <Text style={[styles.priorityText, { color: priorityStyle.text }]}>
            {priorityStyle.label}
          </Text>
        </View>
      )}

      {/* Botão de Excluir */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(todo.id)}
        hitSlop={tokens.hitSlop.sm}
        accessibilityLabel="Excluir tarefa"
      >
        <MaterialIcons name="close" size={16} color={tokens.colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm + 2,
  },
  bottomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.outlineVariant,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: MD3Shapes.medium,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
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
  checkboxChecked: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
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
  dueDate: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    marginTop: 2,
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
  deleteButton: {
    padding: tokens.spacing.xs,
  },
});
