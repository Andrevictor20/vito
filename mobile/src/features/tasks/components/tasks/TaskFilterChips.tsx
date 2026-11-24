import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { getBezier } from '../../../../ds/tokens';
import { tokens } from '../../../../theme/tokens';
import { hapticFeedback } from '../../../../theme/motion';
import { useReduceMotion } from '../../../../theme/vitoMotion';
import { TASK_FILTER_CHIPS, TaskFilterType } from '../../utils/taskBuckets';

interface TaskFilterChipsProps {
  selectedFilter: TaskFilterType;
  onSelectFilter: (filter: TaskFilterType) => void;
  counts: Record<TaskFilterType, number>;
}

/**
 * Faixa de chips horizontais (.chips) fiel a vito-telas.html:
 * - Pill sem borda (`background: var(--btn)` inativo, `var(--ink)` ativo)
 * - Micro-animação chipPop (0.92 -> 1.04 -> 1 em 340ms ease-q)
 */
export const TaskFilterChips: React.FC<TaskFilterChipsProps> = ({
  selectedFilter,
  onSelectFilter,
  counts,
}) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const popAnim = useRef(new Animated.Value(1)).current;
  const prevFilterRef = useRef(selectedFilter);

  useEffect(() => {
    if (prevFilterRef.current === selectedFilter) return;
    prevFilterRef.current = selectedFilter;
    if (reduceMotion) {
      popAnim.setValue(1);
      return;
    }
    popAnim.setValue(0.92);
    const easeQ = Easing.bezier(...getBezier('--ease-q'));
    Animated.sequence([
      Animated.timing(popAnim, {
        toValue: 1.04,
        duration: 204,
        easing: easeQ,
        useNativeDriver: true,
      }),
      Animated.timing(popAnim, {
        toValue: 1,
        duration: 136,
        easing: easeQ,
        useNativeDriver: true,
      }),
    ]).start();
  }, [selectedFilter, reduceMotion, popAnim]);

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

          const chipBg = isActive ? colors.ink : colors.surf;
          const textColor = isActive
            ? colors.bg
            : isWarn
            ? colors.red
            : colors.ink;

          return (
            <Animated.View
              key={chip.id}
              style={isActive ? { transform: [{ scale: popAnim }] } : undefined}
            >
              <TouchableOpacity
                style={[styles.chip, { backgroundColor: chipBg }]}
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
                <Text style={[styles.chipLabel, { color: textColor }]}>
                  {chip.label}
                </Text>
                <Text style={[styles.chipCount, { color: textColor }]}>
                  {count}
                </Text>
              </TouchableOpacity>
            </Animated.View>
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
    height: 38,
    borderRadius: 999,
    borderWidth: 0,
    paddingHorizontal: 14,
    gap: 6,
  },
  chipLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  chipCount: {
    fontFamily: 'Geist',
    fontSize: 11.5,
    opacity: 0.72,
    lineHeight: 14,
  },
});
