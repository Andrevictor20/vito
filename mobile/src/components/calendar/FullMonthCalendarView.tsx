import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { SelectedDayInspector } from './SelectedDayInspector';
import type { Event } from '../../types';

interface FullMonthCalendarViewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onBack: () => void;
  events: Event[];
  dayEvents: Event[];
  eventDates: Set<string>;
  totalTodos: number;
  completedTodos: number;
  onEditEvent?: (ev: Event) => void;
  onDeleteEvent?: (id: string) => void;
  onCreateEvent?: () => void;
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const FullMonthCalendarView: React.FC<FullMonthCalendarViewProps> = ({
  selectedDate,
  onSelectDate,
  onBack,
  events,
  dayEvents,
  eventDates,
  totalTodos,
  completedTodos,
  onEditEvent,
  onDeleteEvent,
  onCreateEvent,
}) => {
  const { colors, isDark } = useTheme();
  const today = useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleGoToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(now);
  };

  const isCurrentMonthView = today.getFullYear() === year && today.getMonth() === month;

  const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const monthGrid = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const items: Array<{
      dayNumber: number;
      isCurrentMonth: boolean;
      date: Date;
    }> = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      items.push({
        dayNumber: d,
        isCurrentMonth: false,
        date: new Date(year, month - 1, d),
      });
    }

    for (let i = 1; i <= totalDaysInMonth; i++) {
      items.push({
        dayNumber: i,
        isCurrentMonth: true,
        date: new Date(year, month, i),
      });
    }

    const remaining = 7 - (items.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        items.push({
          dayNumber: i,
          isCurrentMonth: false,
          date: new Date(year, month + 1, i),
        });
      }
    }

    return items;
  }, [year, month]);

  const selectedDateFormatted = useMemo(() => {
    if (isSameDay(selectedDate, today)) {
      return `Hoje, ${selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`;
    }
    const formatted = selectedDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [selectedDate, today]);

  // Eventos do dia selecionado
  const selectedDayEvents = useMemo(() => {
    return events.filter((ev) => {
      const ms = new Date(ev.start_at).getTime();
      if (Number.isNaN(ms)) return false;
      const d = new Date(ms);
      return isSameDay(d, selectedDate);
    });
  }, [events, selectedDate]);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      {/* Top Bar Executiva */}
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.md}
            accessibilityLabel="Voltar para a lista de eventos"
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={20} color={colors.onSurface} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Calendário Mensal</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {capitalizedMonth} {year}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {!isCurrentMonthView && (
            <TouchableOpacity
              style={[styles.todayBtn, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}
              onPress={handleGoToday}
              activeOpacity={0.75}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Ir para hoje"
              accessibilityRole="button"
            >
              <Text style={[styles.todayBtnText, { color: colors.primary }]}>Hoje</Text>
            </TouchableOpacity>
          )}
          {onCreateEvent && (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={onCreateEvent}
              activeOpacity={0.8}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Criar evento"
              accessibilityRole="button"
            >
              <MaterialIcons name="add" size={18} color={colors.onPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={false}
      >
        {/* Navegação de Mês */}
        <View
          style={[
            styles.calendarCard,
            {
              backgroundColor: isDark ? colors.surfaceContainer : colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.monthNavRow}>
            <Text style={[styles.monthYearTitle, { color: colors.onSurface }]}>
              {capitalizedMonth}{' '}
              <Text style={{ color: colors.onSurfaceVariant, fontWeight: '500' }}>{year}</Text>
            </Text>

            <View style={styles.arrowGroup}>
              <TouchableOpacity
                style={[styles.navArrow, { backgroundColor: colors.surfaceContainerHighest }]}
                onPress={handlePrevMonth}
                activeOpacity={0.7}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Mês anterior"
                accessibilityRole="button"
              >
                <MaterialIcons name="chevron-left" size={22} color={colors.onSurface} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navArrow, { backgroundColor: colors.surfaceContainerHighest }]}
                onPress={handleNextMonth}
                activeOpacity={0.7}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Próximo mês"
                accessibilityRole="button"
              >
                <MaterialIcons name="chevron-right" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Cabeçalho dos Dias da Semana */}
          <View style={styles.weekdaysHeader}>
            {WEEKDAY_LABELS.map((dayLabel, idx) => (
              <View key={idx} style={styles.weekdayCell}>
                <Text style={[styles.weekdayLabelText, { color: colors.onSurfaceVariant }]}>
                  {dayLabel}
                </Text>
              </View>
            ))}
          </View>

          {/* Grade do Mês */}
          <View style={styles.monthGrid}>
            {monthGrid.map((item, idx) => {
              const isSelected = isSameDay(item.date, selectedDate);
              const isItemToday = isSameDay(item.date, today);
              const dateKey = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}-${String(item.date.getDate()).padStart(2, '0')}`;
              const hasEvent = eventDates.has(dateKey);

              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.dayCellContainer}
                  onPress={() => {
                    onSelectDate(item.date);
                    if (!item.isCurrentMonth) {
                      setCurrentMonth(new Date(item.date.getFullYear(), item.date.getMonth(), 1));
                    }
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel={`${item.dayNumber} de ${item.date.toLocaleDateString('pt-BR', { month: 'long' })}`}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.dayCell,
                      isSelected && {
                        backgroundColor: colors.primary,
                      },
                      !isSelected && isItemToday && {
                        borderWidth: 1.5,
                        borderColor: colors.accents.sky,
                        backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumberText,
                        {
                          color: isSelected
                            ? colors.onPrimary
                            : !item.isCurrentMonth
                            ? (isDark ? colors.onSurfaceVariant : colors.textSecondary)
                            : isItemToday
                            ? colors.accents.sky
                            : colors.onSurface,
                          fontWeight: isSelected || isItemToday ? '700' : '500',
                          opacity: !item.isCurrentMonth && !isSelected ? 0.6 : 1,
                        },
                      ]}
                    >
                      {item.dayNumber}
                    </Text>

                    {hasEvent && (
                      <View
                        style={[
                          styles.eventDot,
                          {
                            backgroundColor: isSelected
                              ? colors.onPrimary
                              : isItemToday
                              ? colors.accents.sky
                              : colors.accents.emerald,
                          },
                        ]}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Painel do Dia Selecionado */}
        <SelectedDayInspector
          selectedDate={selectedDate}
          selectedDayEvents={selectedDayEvents}
          totalTodos={totalTodos}
          completedTodos={completedTodos}
          onBack={onBack}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          onCreateEvent={onCreateEvent}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.lg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  calendarCard: {
    borderRadius: MD3Shapes.largeIncreased,
    borderWidth: 1,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
    paddingHorizontal: 2,
  },
  monthYearTitle: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
  },
  arrowGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdaysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayLabelText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellContainer: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayNumberText: {
    fontSize: 14,
  },
  eventDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
