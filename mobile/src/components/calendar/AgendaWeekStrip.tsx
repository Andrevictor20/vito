import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface AgendaWeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onExpandCalendar: () => void;
  eventDates?: Set<string>;
}

export const AgendaWeekStrip: React.FC<AgendaWeekStripProps> = ({
  selectedDate,
  onSelectDate,
  onExpandCalendar,
  eventDates = new Set(),
}) => {
  const { colors, isDark } = useTheme();
  const today = useMemo(() => new Date(), []);

  // Obter o primeiro dia da semana (Domingo) correspondente à data selecionada
  const weekDays = useMemo(() => {
    const current = new Date(selectedDate);
    const dayOfWeek = current.getDay(); // 0 = Domingo
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const monthName = selectedDate.toLocaleDateString('pt-BR', { month: 'long' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const yearStr = selectedDate.getFullYear().toString();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.surfaceContainer : colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      {/* Top Header do Card: Título e Botão de Expandir */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={onExpandCalendar}
        activeOpacity={0.75}
        accessibilityLabel="Abrir calendário em tela cheia"
        accessibilityRole="button"
      >
        <View style={styles.monthYearRow}>
          <Text style={[styles.monthTitle, { color: colors.onSurface }]}>{capitalizedMonth}</Text>
          <Text style={[styles.yearSubtitle, { color: colors.textMuted }]}>{yearStr}</Text>
        </View>

        <View style={[styles.expandBtn, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
          <MaterialIcons name="fullscreen" size={16} color={colors.primary} />
          <Text style={[styles.expandBtnText, { color: colors.onSurface }]}>Ver Mês</Text>
        </View>
      </TouchableOpacity>

      {/* Week Strip (7 Colunas de Domingo a Sábado) */}
      <View style={styles.daysGrid}>
        {weekDays.map((dayDate, idx) => {
          const weekdayLabel = dayDate
            .toLocaleDateString('pt-BR', { weekday: 'short' })
            .slice(0, 3)
            .toUpperCase();
          const isSelected = isSameDay(dayDate, selectedDate);
          const isToday = isSameDay(dayDate, today);
          const dateKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
          const hasEvent = eventDates.has(dateKey);

          return (
            <TouchableOpacity
              key={idx}
              style={styles.dayColumn}
              onPress={() => onSelectDate(dayDate)}
              activeOpacity={0.7}
              accessibilityLabel={`Selecionar ${weekdayLabel} dia ${dayDate.getDate()}`}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: isSelected
                      ? colors.primary
                      : isToday
                      ? colors.accents.sky
                      : colors.textMuted,
                  },
                ]}
              >
                {weekdayLabel}
              </Text>

              <View
                style={[
                  styles.dayCircle,
                  isSelected && { backgroundColor: colors.primary },
                  !isSelected && isToday && {
                    borderWidth: 1.5,
                    borderColor: colors.accents.sky,
                    backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    {
                      color: isSelected
                        ? colors.onPrimary
                        : isToday
                        ? colors.accents.sky
                        : colors.onSurface,
                      fontWeight: isSelected || isToday ? '700' : '500',
                    },
                  ]}
                >
                  {dayDate.getDate()}
                </Text>

                {hasEvent && !isSelected && (
                  <View
                    style={[
                      styles.eventDot,
                      { backgroundColor: isToday ? colors.accents.sky : colors.accents.emerald },
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: MD3Shapes.largeIncreased,
    borderWidth: 1,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm + 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm + 2,
    paddingHorizontal: 2,
  },
  monthYearRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  monthTitle: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
  },
  yearSubtitle: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: '500',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayNumber: {
    fontSize: 14,
  },
  eventDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
