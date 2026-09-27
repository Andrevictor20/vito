import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { tokens } from '../../theme/tokens';
import { Event } from '../../types';

interface CalendarViewProps {
  events: Event[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  selectedDate,
  onSelectDate,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(today);
  };

  const isToday = (d: number) => {
    const today = new Date();
    return (
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isSelected = (d: number) => {
    return (
      d === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear()
    );
  };

  const hasEventsOnDay = (d: number) => {
    const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return events.some((e) => {
      // Suporta eventos de um dia ou múltiplos dias
      const startDay = e.start_at.substring(0, 10);
      const endDay = e.end_at.substring(0, 10);
      return targetDateStr >= startDay && targetDateStr <= endDay;
    });
  };

  const daysGrid: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    daysGrid.push(d);
  }

  return (
    <View style={styles.card}>
      {/* Header do Mês e Navegação */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <TouchableOpacity style={styles.navButton} onPress={prevMonth} hitSlop={tokens.hitSlop.sm}>
            <Text style={styles.navIcon}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.monthTitle}>
            {MONTH_NAMES[month]} {year}
          </Text>

          <TouchableOpacity style={styles.navButton} onPress={nextMonth} hitSlop={tokens.hitSlop.sm}>
            <Text style={styles.navIcon}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.todayButton} onPress={jumpToToday} activeOpacity={0.75}>
          <Text style={styles.todayButtonText}>Hoje</Text>
        </TouchableOpacity>
      </View>

      {/* Dias da semana */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, idx) => (
          <Text key={idx} style={styles.weekText}>
            {w}
          </Text>
        ))}
      </View>

      {/* Grade de Dias */}
      <View style={styles.grid}>
        {daysGrid.map((day, idx) => {
          if (day === null) {
            return <View key={idx} style={styles.dayCell} />;
          }

          const selected = isSelected(day);
          const today = isToday(day);
          const hasEvents = hasEventsOnDay(day);

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.dayCell,
                selected && styles.dayCellSelected,
                today && !selected && styles.dayCellToday,
              ]}
              onPress={() => onSelectDate(new Date(year, month, day))}
            >
              <Text
                style={[
                  styles.dayText,
                  selected && styles.dayTextSelected,
                  today && !selected && styles.dayTextToday,
                ]}
              >
                {day}
              </Text>
              {hasEvents && (
                <View
                  style={[
                    styles.eventDot,
                    selected && styles.eventDotSelected,
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.textPrimary,
    letterSpacing: -0.3,
  },
  navButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  navIcon: {
    fontSize: 20,
    color: tokens.colors.textSecondary,
    fontWeight: '600',
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  todayButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.surfaceBorder,
  },
  weekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: tokens.colors.outline,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
  },
  dayText: {
    fontSize: 13,
    color: tokens.colors.textSecondary,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#00285d',
    fontWeight: '700',
  },
  dayTextToday: {
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.primary,
    marginTop: 2,
  },
  eventDotSelected: {
    backgroundColor: '#00285d',
  },
});
