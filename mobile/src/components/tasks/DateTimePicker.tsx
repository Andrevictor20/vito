import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import {
  buildMonthGrid,
  buildTimeSlots,
  monthLabelPt,
  parseISODate,
  todayISO,
  addDaysISO,
} from '../../utils/dateTimePicker';

interface DateTimePickerProps {
  dateISO: string | null;
  time: string;
  onChangeDate: (iso: string | null) => void;
  onChangeTime: (hhmm: string) => void;
  showTime?: boolean;
}

const DOW_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MES_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const shortLabel = (iso: string): string => {
  const p = parseISODate(iso);
  if (!p) return iso;
  return `${p.day} ${MES_SHORT[p.month - 1]}`;
};

/** Seletor de data (grade mensal) + hora (faixa 30/30min). 100% JS, sem dependência nativa. */
export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  dateISO,
  time,
  onChangeDate,
  onChangeTime,
  showTime = true,
}) => {
  const { colors } = useTheme();
  const today = useMemo(() => todayISO(), []);
  const initial = parseISODate(dateISO || today) || { year: 2026, month: 1, day: 1 };
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const slots = useMemo(() => buildTimeSlots(30), []);
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    hapticFeedback.selection();
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setViewYear(y);
    setViewMonth(m);
  };

  const pick = (iso: string | null) => {
    hapticFeedback.selection();
    onChangeDate(iso);
  };

  return (
    <View>
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.quickChip, { borderColor: colors.outlineVariant }, dateISO === today && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => pick(today)}
          activeOpacity={0.7}
          accessibilityLabel="Selecionar hoje"
        >
          <Text style={[styles.quickText, { color: dateISO === today ? colors.onPrimary : colors.primary }]}>Hoje</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickChip, { borderColor: colors.outlineVariant }]}
          onPress={() => pick(addDaysISO(today, 1))}
          activeOpacity={0.7}
          accessibilityLabel="Selecionar amanhã"
        >
          <Text style={[styles.quickText, { color: colors.primary }]}>Amanhã</Text>
        </TouchableOpacity>
        {dateISO && (
          <TouchableOpacity
            style={[styles.quickChip, { borderColor: colors.outlineVariant }]}
            onPress={() => pick(null)}
            activeOpacity={0.7}
            accessibilityLabel="Remover data"
          >
            <Text style={[styles.quickText, { color: colors.onSurfaceVariant }]}>Limpar</Text>
          </TouchableOpacity>
        )}
        {dateISO && (
          <View style={[styles.currentBadge, { backgroundColor: colors.secondaryContainer }]}>
            <Text style={[styles.currentText, { color: colors.onSecondaryContainer }]}>{shortLabel(dateISO)}</Text>
          </View>
        )}
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={tokens.hitSlop.sm} accessibilityLabel="Mês anterior">
          <MaterialIcons name="chevron-left" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.onSurface }]}>{monthLabelPt(viewYear, viewMonth)}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={tokens.hitSlop.sm} accessibilityLabel="Próximo mês">
          <MaterialIcons name="chevron-right" size={22} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      <View style={styles.dowRow}>
        {DOW_PT.map((d, i) => (
          <Text key={i} style={[styles.dow, { color: colors.onSurfaceVariant }]}>{d}</Text>
        ))}
      </View>
      {grid.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell, ci) => {
            if (!cell.day || !cell.iso) return <View key={ci} style={styles.dayCell} />;
            const selected = dateISO === cell.iso;
            const isToday = cell.iso === today;
            return (
              <TouchableOpacity
                key={ci}
                style={[
                  styles.dayCell,
                  selected && { backgroundColor: colors.primary },
                  !selected && isToday && { borderColor: colors.primary, borderWidth: 1.5 },
                ]}
                onPress={() => pick(cell.iso)}
                activeOpacity={0.7}
                accessibilityLabel={`Dia ${cell.day}`}
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: selected ? colors.onPrimary : colors.onSurface },
                    !selected && isToday && { color: colors.primary, fontWeight: '800' },
                  ]}
                >
                  {cell.day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {showTime && (
        <>
          <Text style={[styles.timeLabel, { color: colors.onSurfaceVariant }]}>Hora · {time || '--:--'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotStrip}>
            {slots.map((s) => {
              const selected = time === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.slot,
                    { borderColor: selected ? colors.primary : colors.outlineVariant },
                    selected && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => {
                    hapticFeedback.selection();
                    onChangeTime(s);
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel={`Hora ${s}`}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.slotText, { color: selected ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  quickChip: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  quickText: {
    fontSize: 13,
    fontWeight: '700',
  },
  currentBadge: {
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginLeft: 'auto',
  },
  currentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dow: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    margin: 1,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  slotStrip: {
    gap: 8,
    paddingRight: 4,
  },
  slot: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
