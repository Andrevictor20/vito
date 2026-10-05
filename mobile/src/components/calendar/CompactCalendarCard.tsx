import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface CompactCalendarCardProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenFullCalendar: () => void;
  eventDates?: Set<string>;
}

export const CompactCalendarCard: React.FC<CompactCalendarCardProps> = ({
  selectedDate,
  onSelectDate,
  onOpenFullCalendar,
  eventDates = new Set(),
}) => {
  const { colors, isDark } = useTheme();
  const today = new Date();

  // Obter o primeiro dia da semana (Domingo) correspondente à data selecionada
  const current = new Date(selectedDate);
  const dayOfWeek = current.getDay(); // 0 = Domingo
  const startOfWeek = new Date(current);
  startOfWeek.setDate(current.getDate() - dayOfWeek);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const monthName = selectedDate.toLocaleDateString('pt-BR', { month: 'long' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const yearStr = selectedDate.getFullYear().toString();
  const formattedDate = selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).toUpperCase();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
      {/* Top Header do Card */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleColumn}>
          <Text style={[styles.dateSubtitle, { color: colors.textMuted }]}>{formattedDate}</Text>
          <View style={styles.monthYearRow}>
            <Text style={[styles.monthTitle, { color: colors.onSurface }]}>{capitalizedMonth}</Text>
            <Text style={[styles.yearSubtitle, { color: colors.textMuted }]}>{yearStr}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.openBtn, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant, borderWidth: 1 }]}
          onPress={onOpenFullCalendar}
          activeOpacity={0.75}
          accessibilityLabel="Abrir calendário completo"
          hitSlop={tokens.hitSlop.sm}
        >
          <MaterialIcons name="calendar-month" size={15} color={colors.primary} />
          <Text style={[styles.openBtnText, { color: colors.onSurface }]}>Ver Mês</Text>
        </TouchableOpacity>
      </View>

      {/* Week Strip (7 Colunas) */}
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
            >
              <Text style={[styles.dayLabel, { color: isSelected ? colors.primary : isToday ? colors.onSurface : colors.textMuted }]}>
                {weekdayLabel}
              </Text>
              <View
                style={[
                  styles.dayCircle,
                  isSelected && { backgroundColor: colors.primary },
                  !isSelected && isToday && {
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                    backgroundColor: colors.surfaceContainerHigh,
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
                        ? colors.primary
                        : colors.onSurface,
                      fontWeight: isSelected || isToday ? '700' : '500',
                    },
                  ]}
                >
                  {dayDate.getDate()}
                </Text>
                {hasEvent && !isSelected && (
                  <View style={[styles.eventDot, { backgroundColor: isToday ? colors.primary : colors.textMuted }]} />
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
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: MD3Shapes.large,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  headerTitleColumn: {
    flexDirection: 'column',
    gap: 2,
  },
  dateSubtitle: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textMuted,
    letterSpacing: 0.8,
  },
  monthYearRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  monthTitle: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSurface,
  },
  yearSubtitle: {
    fontSize: tokens.typography.size.labelSmall,
    color: tokens.colors.textMuted,
  },
  openBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: MD3Shapes.full,
    paddingHorizontal: tokens.spacing.md - 2,
    paddingVertical: tokens.spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openBtnText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: '700',
    color: tokens.colors.onPrimaryContainer,
  },
  daysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.textMuted,
  },
  dayLabelSelected: {
    color: tokens.colors.primary,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCircleSelected: {
    backgroundColor: tokens.colors.primary,
  },
  dayNumber: {
    fontSize: tokens.typography.size.labelLarge,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.onSurfaceVariant,
  },
  dayNumberSelected: {
    color: tokens.colors.onPrimary,
    fontWeight: tokens.typography.weight.bold,
  },
  eventDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.primary,
  },
});
