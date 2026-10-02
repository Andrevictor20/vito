import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { Todo } from '../../types';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete }) => {
  const isCompleted = todo.status === 'completed';

  const priorityStyle =
    todo.priority === 'high'
      ? { bg: tokens.colors.errorContainer, text: tokens.colors.error, label: 'ALTA' }
      : todo.priority === 'medium'
      ? { bg: 'rgba(255, 217, 102, 0.16)', text: tokens.colors.warning, label: 'MÉDIA' }
      : { bg: tokens.colors.surfaceContainerHighest, text: tokens.colors.onSurfaceVariant, label: 'BAIXA' };

  return (
    <View style={[styles.container, isCompleted && styles.containerCompleted]}>
      {/* Checkbox Circular M3 */}
      <TouchableOpacity
        style={[styles.checkbox, isCompleted && styles.checkboxChecked]}
        onPress={() => onToggle(todo.id)}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted }}
        accessibilityLabel={isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'}
      >
        {isCompleted && <MaterialIcons name="done" size={14} color={tokens.colors.onPrimary} />}
      </TouchableOpacity>

      <View style={styles.textContainer}>
        <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={2}>
          {todo.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
            <Text style={[styles.priorityText, { color: priorityStyle.text }]}>
              {priorityStyle.label}
            </Text>
          </View>
          {todo.due_date && (
            <Text style={styles.dueDate}>
              {new Date(todo.due_date).toLocaleDateString('pt-BR')}
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(todo.id)}
        hitSlop={tokens.hitSlop.sm}
        accessibilityLabel="Excluir tarefa"
      >
        <MaterialIcons name="close" size={15} color={tokens.colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Card M3 Outlined (Surface Container com borda outlineVariant)
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    borderRadius: MD3Shapes.medium,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  containerCompleted: {
    opacity: 0.65,
    backgroundColor: tokens.colors.surfaceContainerLow,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: MD3Shapes.full,
    borderWidth: 1.5,
    borderColor: tokens.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
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
    fontSize: tokens.typography.size.titleSmall,
    color: tokens.colors.onSurface,
    fontWeight: tokens.typography.weight.medium,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: tokens.colors.onSurfaceVariant,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: MD3Shapes.small,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.4,
  },
  dueDate: {
    fontSize: tokens.typography.size.labelSmall,
    color: tokens.colors.onSurfaceVariant,
  },
  deleteButton: {
    padding: tokens.spacing.xs,
  },
});
