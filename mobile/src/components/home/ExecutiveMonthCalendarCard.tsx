import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Event } from '../../types';

interface ExecutiveMonthCalendarCardProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  dayEvents: Event[];
  totalTodos: number;
  completedTodos: number;
  eventDates?: Set<string>;
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const ExecutiveMonthCalendarCard: React.FC<ExecutiveMonthCalendarCardProps> = ({
  selectedDate,
  onSelectDate,
  dayEvents,
  totalTodos,
  completedTodos,
  eventDates = new Set(),
}) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);

  // Mês atualmente visualizado na grade do calendário
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  // Sincroniza o mês exibido se a data selecionada mudar externamente para outro mês
  useEffect(() => {
    if (
      selectedDate.getFullYear() !== currentMonth.getFullYear() ||
      selectedDate.getMonth() !== currentMonth.getMonth()
    ) {
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [selectedDate]);

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

  // Saudação executiva personalizada
  const firstName = user?.name ? user.name.split(' ')[0] : 'Executivo';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  // Nome do mês e ano formatados
  const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Helpers de comparação de data
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  // Matriz de 5 a 6 semanas do mês
  const monthGrid = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const items: Array<{
      dayNumber: number;
      isCurrentMonth: boolean;
      date: Date;
    }> = [];

    // Dias complementares do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      items.push({
        dayNumber: d,
        isCurrentMonth: false,
        date: new Date(year, month - 1, d),
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= totalDaysInMonth; i++) {
      items.push({
        dayNumber: i,
        isCurrentMonth: true,
        date: new Date(year, month, i),
      });
    }

    // Dias complementares do próximo mês para fechar a última linha
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

  // Data selecionada formatada para o rodapé
  const selectedDateFormatted = useMemo(() => {
    if (isSameDay(selectedDate, today)) {
      return `Hoje, ${selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
    }
    const formatted = selectedDate.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [selectedDate, today]);

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
      {/* 1. Header: Saudação Executiva Limpa */}
      <View style={styles.topHeaderRow}>
        <View style={styles.greetingContainer}>
          <View style={[styles.statusDot, { backgroundColor: colors.accents.emerald }]} />
          <Text style={[styles.greetingText, { color: colors.onSurfaceVariant }]}>
            {greeting}, {firstName}
          </Text>
        </View>
      </View>

      {/* 2. Header Linha 2: Navegação de Mês Espaçosa */}
      <View style={styles.monthNavRow}>
        <View style={styles.monthTitleWrapper}>
          <Text style={[styles.monthYearTitle, { color: colors.onSurface }]}>
            {capitalizedMonth}{' '}
            <Text style={{ color: colors.onSurfaceVariant, fontWeight: '500' }}>{year}</Text>
          </Text>
          {!isCurrentMonthView && (
            <TouchableOpacity
              style={[
                styles.todayBtn,
                { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant },
              ]}
              onPress={handleGoToday}
              activeOpacity={0.7}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Voltar para o dia de hoje"
            >
              <Text style={[styles.todayBtnText, { color: colors.primary }]}>Hoje</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.arrowGroup}>
          <TouchableOpacity
            style={[styles.navArrow, { backgroundColor: colors.surfaceContainerHighest }]}
            onPress={handlePrevMonth}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Mês anterior"
          >
            <MaterialIcons name="chevron-left" size={20} color={colors.onSurface} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navArrow, { backgroundColor: colors.surfaceContainerHighest }]}
            onPress={handleNextMonth}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Próximo mês"
          >
            <MaterialIcons name="chevron-right" size={20} color={colors.onSurface} />
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

      {/* 4. Grade do Mês Completo */}
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
                      opacity: !item.isCurrentMonth && !isSelected ? 0.65 : 1,
                    },
                  ]}
                >
                  {item.dayNumber}
                </Text>

                {/* Indicador de evento pontual */}
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

      {/* 5. Faixa Inferior de Resumo Arejada (Layout de 2 Linhas Sem Aperto) */}
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        {/* Linha Superior: Data Completa Selecionada */}
        <View style={styles.statusDateRow}>
          <MaterialIcons name="event" size={16} color={colors.primary} />
          <Text
            style={[styles.statusDateText, { color: colors.onSurface }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {selectedDateFormatted}
          </Text>
        </View>

        {/* Linha Inferior: Badges Táteis de Compromissos e Tarefas */}
        <View style={styles.statusBadgesRow}>
          <View
            style={[
              styles.metricPill,
              {
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#F0F9FF',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#BAE6FD',
              },
            ]}
          >
            <MaterialIcons name="schedule" size={14} color={colors.accents.sky} />
            <Text style={[styles.metricPillText, { color: colors.onSurface }]}>
              {dayEvents.length} {dayEvents.length === 1 ? 'compromisso' : 'compromissos'}
            </Text>
          </View>

          <View
            style={[
              styles.metricPill,
              {
                backgroundColor:
                  totalTodos === 0
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.12)'
                      : '#ECFDF5'
                    : isDark
                    ? 'rgba(245, 158, 11, 0.12)'
                    : '#FFFBEB',
                borderColor:
                  totalTodos === 0
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.25)'
                      : '#A7F3D0'
                    : isDark
                    ? 'rgba(245, 158, 11, 0.25)'
                    : '#FDE68A',
              },
            ]}
          >
            <MaterialIcons
              name={totalTodos === 0 || completedTodos === totalTodos ? 'task-alt' : 'checklist'}
              size={14}
              color={
                totalTodos === 0 || completedTodos === totalTodos
                  ? colors.accents.emerald
                  : colors.accents.amber
              }
            />
            <Text style={[styles.metricPillText, { color: colors.onSurface }]}>
              {totalTodos === 0
                ? 'Sem pendências'
                : `${completedTodos}/${totalTodos} tarefas (${Math.round((completedTodos / totalTodos) * 100)}%)`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: MD3Shapes.largeIncreased,
    borderWidth: 1,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  greetingText: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.semibold,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  expandToggleText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: '700',
  },
  iconBtn: {
    padding: 4,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: 2,
  },
  monthTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthYearTitle: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
  },
  todayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  todayBtnText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: '700',
  },
  arrowGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdaysHeader: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayLabelText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: tokens.spacing.sm + 2,
  },
  monthGridExpanded: {
    marginBottom: tokens.spacing.md,
  },
  dayCellContainer: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  dayCellContainerExpanded: {
    height: 56,
  },
  dayCell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCellExpanded: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  dayNumberText: {
    fontSize: 13,
  },
  dayNumberTextExpanded: {
    fontSize: 15,
  },
  eventDot: {
    position: 'absolute',
    bottom: 2,
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
  },
  eventDotExpanded: {
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusCard: {
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    padding: tokens.spacing.sm + 2,
    gap: 8,
  },
  statusDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDateText: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  metricPillText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: '600',
  },
});
