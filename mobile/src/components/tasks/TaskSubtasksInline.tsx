import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import type { Subtask } from '../../types';

interface TaskSubtasksInlineProps {
  subtasks?: Subtask[];
  onToggleSubtask?: (subtaskId: string) => void;
  onAddSubtask?: (title: string) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
}

export const TaskSubtasksInline: React.FC<TaskSubtasksInlineProps> = ({
  subtasks,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
}) => {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const submitSubtask = () => {
    if (!draft.trim() || !onAddSubtask) return;
    hapticFeedback.selection();
    onAddSubtask(draft.trim());
    setDraft('');
  };

  return (
    <View style={styles.subList}>
      {(subtasks || []).map((s) => (
        <View key={s.id} style={styles.subRow}>
          <TouchableOpacity
            style={[
              styles.subCheck,
              {
                borderColor: s.completed ? colors.purple : colors.muted,
                backgroundColor: s.completed ? colors.purple : 'transparent',
              },
            ]}
            onPress={() => {
              hapticFeedback.selection();
              onToggleSubtask?.(s.id);
            }}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: s.completed }}
            accessibilityLabel={s.completed ? 'Reabrir subtarefa' : 'Concluir subtarefa'}
          >
            {s.completed && <MaterialIcons name="check" size={10} color="#ffffff" />}
          </TouchableOpacity>

          <Text
            style={[
              styles.subTitle,
              { color: colors.ink, fontFamily: tokens.typography.family.regular },
              s.completed && styles.struck,
            ]}
            numberOfLines={2}
          >
            {s.title}
          </Text>

          <TouchableOpacity
            onPress={() => {
              hapticFeedback.selection();
              onDeleteSubtask?.(s.id);
            }}
            hitSlop={tokens.hitSlop.sm}
            accessibilityRole="button"
            accessibilityLabel="Excluir subtarefa"
          >
            <MaterialIcons name="close" size={14} color={colors.muted} />
          </TouchableOpacity>
        </View>
      ))}

      {onAddSubtask && (
        <View style={styles.subAddRow}>
          <TextInput
            style={[
              styles.subInput,
              { color: colors.ink, borderColor: colors.line, fontFamily: tokens.typography.family.regular },
            ]}
            placeholder="Adicionar subtarefa"
            placeholderTextColor={colors.muted}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submitSubtask}
            returnKeyType="done"
            accessibilityLabel="Nova subtarefa"
          />
          <TouchableOpacity
            onPress={submitSubtask}
            hitSlop={tokens.hitSlop.sm}
            accessibilityRole="button"
            accessibilityLabel="Adicionar subtarefa"
          >
            <MaterialIcons name="add" size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  subList: {
    gap: 8,
    marginTop: 10,
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
  struck: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  subAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  subInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
});
