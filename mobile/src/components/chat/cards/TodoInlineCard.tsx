import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { Todo } from '../../../types';

interface TodoInlineCardProps {
  todo: Todo;
  onToggle?: (id: string) => void;
}

export const TodoInlineCard: React.FC<TodoInlineCardProps> = ({ todo, onToggle }) => {
  const { colors, isDark } = useTheme();
  const [completed, setCompleted] = useState(todo.status === 'completed');

  const handleToggle = () => {
    const next = !completed;
    setCompleted(next);
    if (onToggle) {
      onToggle(todo.id);
    }
  };

  const priorityColor =
    todo.priority === 'high'
      ? { bg: colors.errorContainer, text: colors.onErrorContainer, label: 'ALTA' }
      : todo.priority === 'medium'
      ? { bg: isDark ? 'rgba(251, 191, 36, 0.18)' : 'rgba(245, 158, 11, 0.12)', text: colors.warning, label: 'MÉDIA' }
      : { bg: colors.surfaceContainerHighest, text: colors.onSurfaceVariant, label: 'BAIXA' };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
        completed && [styles.cardCompleted, { backgroundColor: colors.surfaceContainerLow }],
      ]}
    >
      <View style={styles.leftGroup}>
        {/* Checkbox Circular M3 */}
        <TouchableOpacity
          style={[
            styles.checkbox,
            { borderColor: completed ? colors.primary : colors.outline },
            completed && { backgroundColor: colors.primary },
          ]}
          onPress={handleToggle}
          activeOpacity={0.8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: completed }}
        >
          {completed && (
            <MaterialIcons name="done" size={14} color={colors.onPrimary} />
          )}
        </TouchableOpacity>

        <View style={styles.titleCol}>
          <Text
            style={[
              styles.title,
              { color: completed ? colors.textMuted : colors.onSurface },
            ]}
            numberOfLines={1}
          >
            {todo.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {completed ? 'Concluída com sucesso' : 'Prazo estimado: hoje'}
          </Text>
        </View>
      </View>

      {/* Tag Tonal M3 de Urgência */}
      <View style={[styles.priorityBadge, { backgroundColor: priorityColor.bg }]}>
        <Text style={[styles.priorityBadgeText, { color: priorityColor.text }]}>
          {priorityColor.label}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Card M3 Outlined (Borda em outline-variant, fundo surface-container)
  card: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: MD3Shapes.medium,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  cardCompleted: {
    opacity: 0.7,
    backgroundColor: tokens.colors.surfaceContainerLow,
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
    borderRadius: MD3Shapes.full,
    borderWidth: 1.5,
    borderColor: tokens.colors.outline,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    color: tokens.colors.onSurface,
    fontSize: tokens.typography.size.titleSmall,
    fontWeight: tokens.typography.weight.medium,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: tokens.colors.onSurfaceVariant,
  },
  subtitle: {
    color: tokens.colors.onSurfaceVariant,
    fontSize: tokens.typography.size.labelSmall,
    marginTop: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.small,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.4,
  },
});
