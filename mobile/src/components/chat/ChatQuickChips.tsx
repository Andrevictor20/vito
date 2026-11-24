import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { token } from '../../ds/tokens';
import { SgCalIcon, SgCupIcon, SgTasksIcon } from '../../icons/ChatProtoIcons';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';

interface PromptChipItem {
  kind: 'cal' | 'tasks' | 'cup';
  label: string;
  prompt: string;
  colorVar: '--blue' | '--purple' | '--orange';
}

const QUICK_PROMPTS: PromptChipItem[] = [
  {
    kind: 'cal',
    label: 'O que tenho hoje?',
    prompt: 'O que tenho hoje?',
    colorVar: '--blue',
  },
  {
    kind: 'tasks',
    label: 'Minhas tarefas',
    prompt: 'Minhas tarefas',
    colorVar: '--purple',
  },
  {
    kind: 'cup',
    label: 'Almoço amanhã',
    prompt: 'Almoço amanhã',
    colorVar: '--orange',
  },
];

interface ChatQuickChipsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export const ChatQuickChips: React.FC<ChatQuickChipsProps> = ({ onSelectPrompt, disabled }) => {
  const { isDark } = useTheme();
  const surf = token('--surf', isDark);
  const line = token('--line', isDark);
  const ink = token('--ink', isDark);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {QUICK_PROMPTS.map((item, idx) => {
          const iconColor = token(item.colorVar, isDark);
          const IconComp =
            item.kind === 'cal' ? SgCalIcon : item.kind === 'tasks' ? SgTasksIcon : SgCupIcon;

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.chip,
                {
                  backgroundColor: surf,
                  borderColor: line,
                },
              ]}
              onPress={() => {
                hapticFeedback.light();
                onSelectPrompt(item.prompt);
              }}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <IconComp size={15} color={iconColor} />
              <Text style={[styles.chipLabel, { color: ink }]}>{item.label}</Text>
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
    paddingHorizontal: 16,
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
    fontFamily: 'Geist_500Medium',
  },
});
