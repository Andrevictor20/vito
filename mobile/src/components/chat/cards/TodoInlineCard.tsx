import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../../theme/tokens';
import { Todo } from '../../../types';

interface TodoInlineCardProps {
  todo: Todo;
  onToggle?: (id: string) => void;
}

export const TodoInlineCard: React.FC<TodoInlineCardProps> = ({ todo, onToggle }) => {
  const [completed, setCompleted] = useState(todo.status === 'completed');

  const handleToggle = () => {
    const next = !completed;
    setCompleted(next);
    if (onToggle) {
      onToggle(todo.id);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.leftGroup}>
        <TouchableOpacity
          style={[styles.checkbox, completed && styles.checkboxCompleted]}
          onPress={handleToggle}
          activeOpacity={0.8}
        >
          {completed && (
            <MaterialIcons name="done" size={14} color={tokens.colors.textPrimary} />
          )}
        </TouchableOpacity>

        <View style={styles.titleCol}>
          <Text
            style={[styles.title, completed && styles.titleCompleted]}
            numberOfLines={1}
          >
            {todo.title}
          </Text>
          <Text style={styles.subtitle}>
            {completed ? 'Concluída com sucesso' : 'Prazo estimado: hoje'}
          </Text>
        </View>
      </View>

      <View style={styles.priorityBadge}>
        <Text style={styles.priorityBadgeText}>ALTA</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: tokens.radii.full,
    borderWidth: 1.5,
    borderColor: tokens.colors.outline,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: tokens.colors.tertiaryContainer,
    borderColor: tokens.colors.tertiary,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: tokens.colors.textMuted,
  },
  subtitle: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
    marginTop: 1,
  },
  priorityBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: tokens.radii.full,
  },
  priorityBadgeText: {
    color: tokens.colors.danger,
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.5,
  },
});
