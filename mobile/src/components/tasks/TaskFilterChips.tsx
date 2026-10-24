import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import { hapticFeedback } from '../../theme/motion';
import { TASK_FILTER_CHIPS, TaskFilterType } from '../../utils/taskBuckets';

interface TaskFilterChipsProps {
  selectedFilter: TaskFilterType;
  onSelectFilter: (filter: TaskFilterType) => void;
  counts: Record<TaskFilterType, number>;
}

/**
 * Faixa de chips horizontais (.chips) fiel a vito-telas.html.
 * - Chip ativo (.on): fundo colors.ink, texto colors.bg, borda colors.ink.
 * - Chip inativo: fundo colors.bg, borda colors.line, texto colors.ink.
 * - Chip de atrasadas (.warn): texto e borda vermelha quando houver atrasadas e não estiver ativo.
 * - Contador (em): 11.5px com opacidade 0.7.
 */
export const TaskFilterChips: React.FC<TaskFilterChipsProps> = ({
  selectedFilter,
  onSelectFilter,
  counts,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TASK_FILTER_CHIPS.map((chip) => {
          const isActive = selectedFilter === chip.id;
          const isWarn = chip.id === 'atr' && counts.atr > 0 && !isActive;
          const count = counts[chip.id] ?? 0;

          const chipBg = isActive
            ? colors.ink
            : colors.bg;

          const chipBorder = isActive
            ? colors.ink
            : isWarn
            ? colors.red
            : colors.line;

          const textColor = isActive
            ? colors.bg
            : isWarn
            ? colors.red
            : colors.ink;

          return (
            <TouchableOpacity
              key={chip.id}
              style={[
                styles.chip,
                {
                  backgroundColor: chipBg,
                  borderColor: chipBorder,
                },
              ]}
              onPress={() => {
                hapticFeedback.selection();
                onSelectFilter(chip.id);
              }}
              activeOpacity={0.75}
              hitSlop={tokens.hitSlop.sm}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filtro ${chip.label}: ${count} tarefas`}
            >
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: textColor,
                    fontFamily: tokens.typography.family.semibold,
                  },
                ]}
              >
                {chip.label}
              </Text>
              <Text
                style={[
                  styles.chipCount,
                  {
                    color: textColor,
                    fontFamily: tokens.typography.family.regular,
                  },
                ]}
              >
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 6,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 6,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  chipCount: {
    fontSize: 11.5,
    opacity: 0.75,
    lineHeight: 14,
  },
});
