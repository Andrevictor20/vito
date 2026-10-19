import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { TokiMonthData, TokiDayCell, getEventCompactEmoji } from '../../utils/tokiCalendarUtils';
import type { Event } from '../../types';

interface TokiMonthBlockProps {
  monthData: TokiMonthData;
  events: Event[];
  selectedDate: Date;
  todayDate: Date;
  isExpanded: boolean;
  onSelectDay: (date: Date) => void;
}

export const TokiMonthBlock: React.FC<TokiMonthBlockProps> = ({
  monthData,
  events,
  selectedDate,
  todayDate,
  isExpanded,
  onSelectDay,
}) => {
  const { colors, isDark } = useTheme();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  // Mapear eventos por dateKey para lookup instantâneo O(1)
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach((ev) => {
      try {
        const d = new Date(ev.start_at);
        if (!Number.isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const arr = map.get(key) || [];
          arr.push(ev);
          map.set(key, arr);
        }
      } catch {}
    });
    return map;
  }, [events]);

  const capitalizedTitle =
    monthData.title.charAt(0).toUpperCase() + monthData.title.slice(1);

  return (
    <View style={styles.monthContainer}>
      {/* Título do Mês */}
      <Text style={[styles.monthSectionTitle, { color: isDark ? '#A1A1AA' : '#52525B' }]}>
        {capitalizedTitle}
      </Text>

      {/* Grade de 7 Colunas */}
      <View style={styles.daysGrid}>
        {monthData.grid.map((cell: TokiDayCell, idx: number) => {
          if (!cell.isCurrentMonth) {
            return (
              <View
                key={`empty-${idx}`}
                style={[
                  styles.dayCellContainer,
                  isExpanded ? styles.cellContainerExpanded : styles.cellContainerCompact,
                ]}
              />
            );
          }

          const isSelected = isSameDay(cell.date, selectedDate);
          const isToday = isSameDay(cell.date, todayDate);
          const dayEvents = eventsByDate.get(cell.dateKey) || [];

          return (
            <TouchableOpacity
              key={cell.dateKey}
              style={[
                styles.dayCellContainer,
                isExpanded ? styles.cellContainerExpanded : styles.cellContainerCompact,
                isSelected && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' },
              ]}
              onPress={() => onSelectDay(cell.date)}
              activeOpacity={0.7}
              accessibilityLabel={`${cell.dayNumber} de ${capitalizedTitle}`}
              accessibilityRole="button"
            >
              {/* Círculo do Número do Dia */}
              <View
                style={[
                  styles.dayBadge,
                  isToday && {
                    backgroundColor: '#FFFFFF',
                  },
                  isSelected && !isToday && {
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumberText,
                    {
                      color: isToday
                        ? '#000000'
                        : isDark
                        ? '#FFFFFF'
                        : colors.onSurface,
                      fontWeight: isToday || isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {cell.dayNumber < 10 ? `0${cell.dayNumber}` : cell.dayNumber}
                </Text>
              </View>

              {/* Indicadores de Eventos: Expandido (Cards com título e hora) ou Compacto (Emojis) */}
              {dayEvents.length > 0 && (
                <View style={styles.eventsWrapper}>
                  {isExpanded ? (
                    dayEvents.slice(0, 2).map((ev) => {
                      const isAllDay = !ev.end_at || ev.start_at.includes('T00:00:00');
                      const timeStr = isAllDay
                        ? 'Dia todo'
                        : new Date(ev.start_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                      return (
                        <View
                          key={ev.id}
                          style={[
                            styles.eventCard,
                            {
                              backgroundColor: isDark
                                ? 'rgba(38, 77, 89, 0.65)'
                                : '#E0F2FE',
                              borderColor: isDark
                                ? 'rgba(56, 189, 248, 0.25)'
                                : '#BAE6FD',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.eventTitle,
                              { color: isDark ? '#E0F2FE' : '#0369A1' },
                            ]}
                            numberOfLines={1}
                          >
                            {ev.title}
                          </Text>
                          <Text
                            style={[
                              styles.eventTime,
                              { color: isDark ? '#7DD3FC' : '#0284C7' },
                            ]}
                            numberOfLines={1}
                          >
                            {timeStr}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.emojiRow}>
                      {dayEvents.slice(0, 3).map((ev) => (
                        <Text key={ev.id} style={styles.emojiText}>
                          {getEventCompactEmoji(ev)}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  monthContainer: {
    marginBottom: tokens.spacing.lg,
    paddingHorizontal: 6,
  },
  monthSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
    paddingHorizontal: 8,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellContainer: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  cellContainerCompact: {
    minHeight: 52,
    justifyContent: 'flex-start',
  },
  cellContainerExpanded: {
    minHeight: 88,
    justifyContent: 'flex-start',
  },
  dayBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayNumberText: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  eventsWrapper: {
    width: '100%',
    alignItems: 'center',
    gap: 3,
  },
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 2,
  },
  emojiText: {
    fontSize: 13,
  },
  eventCard: {
    width: '96%',
    borderRadius: 6,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  eventTitle: {
    fontSize: 9.5,
    fontWeight: '700',
    lineHeight: 12,
  },
  eventTime: {
    fontSize: 8.5,
    fontWeight: '500',
    marginTop: 1,
  },
});
