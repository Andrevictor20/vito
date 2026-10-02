import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';

interface PromptChipItem {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  label: string;
  prompt: string;
}

const QUICK_PROMPTS: PromptChipItem[] = [
  {
    icon: 'calendar-month',
    iconColor: tokens.colors.primary,
    label: 'O que tenho hoje?',
    prompt: 'O que tenho na agenda hoje?',
  },
  {
    icon: 'check-circle',
    iconColor: tokens.colors.tertiary,
    label: 'Minhas tarefas',
    prompt: 'Listar tarefas pendentes e prazos',
  },
  {
    icon: 'local-cafe',
    iconColor: tokens.colors.secondary,
    label: 'Almoço amanhã 12h',
    prompt: 'Agendar almoço amanhã às 12h',
  },
  {
    icon: 'bolt',
    iconColor: tokens.colors.primary,
    label: 'Briefing diário',
    prompt: 'Faça um briefing executivo das minhas prioridades',
  },
];

interface ChatQuickChipsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export const ChatQuickChips: React.FC<ChatQuickChipsProps> = ({ onSelectPrompt, disabled }) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {QUICK_PROMPTS.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.chip}
            onPress={() => onSelectPrompt(item.prompt)}
            disabled={disabled}
            activeOpacity={0.75}
          >
            <MaterialIcons name={item.icon} size={15} color={item.iconColor} />
            <Text style={styles.chipLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: tokens.spacing.xs,
  },
  scrollList: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  // M3 Suggestion Chip (8dp radius)
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.surfaceContainerLow,
    paddingHorizontal: tokens.spacing.md - 2,
    paddingVertical: 6,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  chipLabel: {
    color: tokens.colors.onSurfaceVariant,
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.medium,
  },
});
