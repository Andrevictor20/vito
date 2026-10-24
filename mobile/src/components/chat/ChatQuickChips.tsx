import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';

interface PromptChipItem {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  prompt: string;
  colorKey: 'blue' | 'purple' | 'orange' | 'acc';
}

const QUICK_PROMPTS: PromptChipItem[] = [
  {
    icon: 'calendar-month',
    label: 'O que tenho hoje?',
    prompt: 'O que tenho hoje?',
    colorKey: 'blue',
  },
  {
    icon: 'check-circle-outline',
    label: 'Minhas tarefas',
    prompt: 'Minhas tarefas',
    colorKey: 'purple',
  },
  {
    icon: 'local-cafe',
    label: 'Almoço amanhã',
    prompt: 'Almoço amanhã',
    colorKey: 'orange',
  },
];

interface ChatQuickChipsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export const ChatQuickChips: React.FC<ChatQuickChipsProps> = ({ onSelectPrompt, disabled }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {QUICK_PROMPTS.map((item, idx) => {
          const iconColor = colors[item.colorKey] || colors.ink;

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.surf,
                  borderColor: colors.line,
                },
              ]}
              onPress={() => {
                hapticFeedback.light();
                onSelectPrompt(item.prompt);
              }}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <MaterialIcons name={item.icon} size={15} color={iconColor} />
              <Text style={[styles.chipLabel, { color: colors.ink }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  scrollList: {
    paddingHorizontal: tokens.spacing.md,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: tokens.typography.family.medium,
  },
});
