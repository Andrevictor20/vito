import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { tokens } from '../../theme/tokens';
import { Todo } from '../../types';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete }) => {
  const isCompleted = todo.status === 'completed';

  const priorityColor =
    todo.priority === 'high'
      ? tokens.colors.danger
      : todo.priority === 'medium'
      ? tokens.colors.warning
      : tokens.colors.accent;

  return (
    <View style={[styles.container, isCompleted && styles.containerCompleted]}>
      <TouchableOpacity
        style={[styles.checkbox, isCompleted && styles.checkboxChecked]}
        onPress={() => onToggle(todo.id)}
      >
        {isCompleted && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      <View style={styles.textContainer}>
        <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={2}>
          {todo.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.priorityBadge, { borderColor: priorityColor }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {todo.priority.toUpperCase()}
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
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  containerCompleted: {
    opacity: 0.5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
  },
  checkboxChecked: {
    backgroundColor: tokens.colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    color: tokens.colors.textPrimary,
    fontWeight: '500',
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: tokens.colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  priorityBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
  },
  dueDate: {
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  deleteButton: {
    padding: tokens.spacing.xs,
  },
  deleteText: {
    color: tokens.colors.textMuted,
    fontSize: 14,
  },
});
