import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { tokens } from '../../theme/tokens';
import { Event } from '../../types';

export interface CalendarDayItem {
  dayNumber: number;
  isCurrentMonth: boolean;
  date: Date;
}

interface CalendarGridProps {
  days: CalendarDayItem[];
  isExpanded: boolean;
  isSelected: (d: Date) => boolean;
  isToday: (d: Date) => boolean;
  getDayEvents: (d: Date) => Event[];
  onSelectDate: (d: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  days,
  isExpanded,
  isSelected,
  isToday,
  getDayEvents,
  onSelectDate,
}) => {
  return (
    <View style={styles.grid}>
      {days.map((item, idx) => {
        const selected = isSelected(item.date);
        const today = isToday(item.date);
        const dayEventsList = getDayEvents(item.date);
        const hasEvents = dayEventsList.length > 0;

        return (
          <TouchableOpacity
            key={idx}
            style={[
              styles.dayCell,
              isExpanded && styles.dayCellExpanded,
              !item.isCurrentMonth && styles.dayCellTrailing,
              selected && styles.dayCellSelected,
              today && !selected && styles.dayCellToday,
            ]}
            onPress={() => onSelectDate(item.date)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.dayText,
                !item.isCurrentMonth && styles.dayTextTrailing,
                selected && styles.dayTextSelected,
                today && !selected && styles.dayTextToday,
              ]}
            >
              {String(item.dayNumber).padStart(2, '0')}
            </Text>

            {/* Indicadores de Eventos da Categoria */}
            {!isExpanded && (
              <View style={styles.dotsRow}>
                {hasEvents && (
                  <View
                    style={[
                      styles.eventDot,
                      { backgroundColor: selected ? '#fff' : tokens.colors.primary },
                    ]}
                  />
                )}
                {dayEventsList.length > 1 && (
                  <View
                    style={[
                      styles.eventDot,
                      { backgroundColor: selected ? '#fff' : tokens.colors.tertiary },
                    ]}
                  />
                )}
              </View>
            )}

            {/* Visualização Expandida: Título do Evento em Pill (Stitch line 87) */}
            {isExpanded && hasEvents && (
              <View style={styles.expandedEventPill}>
                <Text style={styles.expandedEventText} numberOfLines={1}>
                  {dayEventsList[0].title}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.sm,
    marginVertical: 1,
  },
  dayCellExpanded: {
    height: 68,
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  dayCellTrailing: {
    opacity: 0.25,
  },
  dayCellSelected: {
    backgroundColor: tokens.colors.cobalt,
    borderRadius: tokens.radii.full,
  },
  dayCellToday: {
    backgroundColor: tokens.colors.surfaceContainerHighest,
    borderRadius: tokens.radii.full,
  },
  dayText: {
    fontSize: tokens.typography.size.xs + 1,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.textPrimary,
  },
  dayTextTrailing: {
    color: tokens.colors.outline,
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: tokens.typography.weight.bold,
  },
  dayTextToday: {
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 4,
    marginTop: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: tokens.radii.full,
  },
  expandedEventPill: {
    backgroundColor: 'rgba(77, 142, 255, 0.25)',
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginTop: 2,
    maxWidth: '92%',
  },
  expandedEventText: {
    fontSize: 8.5,
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.medium,
  },
});
