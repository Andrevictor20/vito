import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Event } from '../../types';

export interface AgendaWeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onExpandCalendar: () => void;
  eventDates?: Set<string>;
  events?: Event[];
}

const DN = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MN = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/**
 * Faixa de navegação semanal e mensal da Agenda fiel a vito-telas.html:
 * - Cabeçalho .mh com Mês e Ano em Montserrat 800, botões < e > e toggle "Semana" / "Mês".
 * - Faixa semanal .week com círculos de 36x36px.
 * - Dia selecionado preenchido em azul (.day.on b).
 * - Dia de hoje com contorno azul (.day.today b).
 * - Dots coloridos (.dots) indicando categorias de compromissos.
 */
export const AgendaWeekStrip: React.FC<AgendaWeekStripProps> = ({
  selectedDate,
  onSelectDate,
  onExpandCalendar,
  eventDates = new Set(),
  events = [],
}) => {
  const { colors, isDark } = useTheme();
  const [isMonthView, setIsMonthView] = useState(false);
  const today = useMemo(() => new Date(), []);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Título e ano no cabeçalho
  const monthName = MN[selectedDate.getMonth()];
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const yearStr = selectedDate.getFullYear().toString();

  // Dias da semana corrente (Domingo a Sábado)
  const weekDays = useMemo(() => {
    const current = new Date(selectedDate);
    const dayOfWeek = current.getDay();
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  // Grade do mês completo (até 42 células)
  const monthGridDays = useMemo(() => {
    if (!isMonthView) return [];
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const startOffset = -firstDay.getDay();
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() + startOffset);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      if (i >= 35 && d.getMonth() !== selectedDate.getMonth()) {
        break;
      }
      days.push(d);
    }
    return days;
  }, [selectedDate, isMonthView]);

  // Navegação de passo (< e >)
  const handleStep = (step: number) => {
    if (isMonthView) {
      const nextMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + step, 1);
      onSelectDate(nextMonth);
    } else {
      const nextWeek = new Date(selectedDate);
      nextWeek.setDate(selectedDate.getDate() + step * 7);
      onSelectDate(nextWeek);
    }
  };

  // Resolução de cores dos dots de eventos para cada dia
  const getDayDots = (d: Date): string[] => {
    const key = toDateKey(d);
    if (events.length > 0) {
      const dayEvs = events.filter((ev) => {
        try {
          const evDate = new Date(ev.start_at);
          return isSameDay(evDate, d);
        } catch {
          return false;
        }
      });
      if (dayEvs.length === 0) return [];

      const colorSet = new Set<string>();
      dayEvs.forEach((ev) => {
        const cat = (ev.category || '').toLowerCase();
        if (cat === 'work' || cat === 'trabalho') colorSet.add(colors.teal);
        else if (cat === 'personal' || cat === 'pessoal') colorSet.add(colors.purple);
        else if (cat === 'study' || cat === 'estudo') colorSet.add(colors.orange);
        else if (cat === 'health' || cat === 'saude' || cat === 'saúde') colorSet.add(colors.blue);
        else if (cat === 'leisure' || cat === 'lazer') colorSet.add(colors.acc);
        else if (cat === 'finance' || cat === 'financas' || cat === 'finanças' || cat === 'financeiro') colorSet.add(colors.red);
        else if (ev.color) colorSet.add(ev.color);
        else colorSet.add(colors.blue);
      });
      return Array.from(colorSet).slice(0, 3);
    }

    if (eventDates.has(key)) {
      return [colors.blue];
    }
    return [];
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho .mh */}
      <View style={styles.mh}>
        <TouchableOpacity
          style={styles.mhTitleContainer}
          onPress={onExpandCalendar}
          activeOpacity={0.7}
          accessibilityLabel="Abrir calendário em tela cheia"
          accessibilityRole="button"
        >
          <Text style={[styles.mhTitle, { color: colors.ink }]}>
            {capitalizedMonth}
            <Text style={[styles.mhYear, { color: colors.muted }]}> {yearStr}</Text>
          </Text>
        </TouchableOpacity>

        <View style={styles.mhActions}>
          <TouchableOpacity
            style={[styles.miniSq, { backgroundColor: colors.surf }]}
            onPress={() => handleStep(-1)}
            activeOpacity={0.7}
            accessibilityLabel="Anterior"
            accessibilityRole="button"
          >
            <MaterialIcons name="chevron-left" size={18} color={colors.ink} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.miniSq, { backgroundColor: colors.surf }]}
            onPress={() => handleStep(1)}
            activeOpacity={0.7}
            accessibilityLabel="Próxima"
            accessibilityRole="button"
          >
            <MaterialIcons name="chevron-right" size={18} color={colors.ink} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.miniBtn, { backgroundColor: colors.surf }]}
            onPress={() => setIsMonthView((prev) => !prev)}
            activeOpacity={0.7}
            accessibilityLabel={isMonthView ? 'Ver modo Semana' : 'Ver modo Mês'}
            accessibilityRole="button"
          >
            <Text style={[styles.miniBtnText, { color: colors.ink }]}>
              {isMonthView ? 'Semana' : 'Mês'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Visualização de Semana (.week) */}
      {!isMonthView ? (
        <View style={styles.weekRow}>
          {weekDays.map((d, idx) => {
            const isSelected = isSameDay(d, selectedDate);
            const isToday = isSameDay(d, today);
            const dots = getDayDots(d);

            return (
              <TouchableOpacity
                key={idx}
                style={styles.dayBtn}
                onPress={() => onSelectDate(d)}
                activeOpacity={0.7}
                accessibilityLabel={`${DN[d.getDay()]}, dia ${d.getDate()}`}
                accessibilityRole="button"
              >
                <Text style={[styles.dayLabel, { color: colors.muted }]}>
                  {DN[d.getDay()]}
                </Text>

                <View
                  style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: colors.blue },
                    !isSelected && isToday && {
                      borderWidth: 1.5,
                      borderColor: colors.blue,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: isSelected ? '#ffffff' : colors.ink,
                        fontWeight: isSelected || isToday ? '700' : '600',
                      },
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>

                {/* Dots coloridos */}
                <View style={styles.dotsRow}>
                  {dots.map((dotColor, dotIdx) => (
                    <View
                      key={dotIdx}
                      style={[styles.dot, { backgroundColor: dotColor }]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        /* Visualização de Mês (.grid) */
        <View style={styles.monthGridContainer}>
          {/* Cabeçalho dos dias da semana */}
          <View style={styles.gridWeekdayHeader}>
            {DN.map((weekday, idx) => (
              <View key={idx} style={styles.gridWeekdayCol}>
                <Text style={[styles.dayLabel, { color: colors.muted }]}>{weekday}</Text>
              </View>
            ))}
          </View>

          {/* Células dos dias */}
          <View style={styles.gridBody}>
            {monthGridDays.map((d, idx) => {
              const isSelected = isSameDay(d, selectedDate);
              const isToday = isSameDay(d, today);
              const isDim = d.getMonth() !== selectedDate.getMonth();
              const dots = getDayDots(d);

              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.gridDayCol}
                  onPress={() => onSelectDate(d)}
                  activeOpacity={0.7}
                  accessibilityLabel={`${d.getDate()} de ${MN[d.getMonth()]}`}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.monthDayCircle,
                      isSelected && { backgroundColor: colors.blue },
                      !isSelected && isToday && {
                        borderWidth: 1.5,
                        borderColor: colors.blue,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthDayNumber,
                        {
                          color: isSelected
                            ? '#ffffff'
                            : isDim
                            ? colors.muted
                            : colors.ink,
                          opacity: isDim && !isSelected ? 0.45 : 1,
                          fontWeight: isSelected || isToday ? '700' : '500',
                        },
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>

                  <View style={styles.dotsRow}>
                    {dots.map((dotColor, dotIdx) => (
                      <View
                        key={dotIdx}
                        style={[styles.dot, { backgroundColor: dotColor }]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 12,
  },
  mh: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  mhTitleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mhTitle: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 17,
    letterSpacing: -0.34,
  },
  mhYear: {
    fontFamily: tokens.typography.family.medium,
    fontSize: 14,
    fontWeight: '500',
  },
  mhActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniSq: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnText: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 13,
  },

  // .week: 7 colunas
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  dayLabel: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'lowercase',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 16,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    height: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // .grid: mês completo
  monthGridContainer: {
    marginTop: 4,
  },
  gridWeekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gridWeekdayCol: {
    width: '14.28%',
    alignItems: 'center',
  },
  gridBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridDayCol: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  monthDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayNumber: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 14,
    lineHeight: 16,
  },
});
