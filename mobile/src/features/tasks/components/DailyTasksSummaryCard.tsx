import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProtoRingChart } from '../../../charts/ProtoRingChart';
import { tokens } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

interface DailyTasksSummaryCardProps {
  completedTodayCount: number;
  pendingTodayCount: number;
  overdueCount: number;
}

export const DailyTasksSummaryCard: React.FC<DailyTasksSummaryCardProps> = ({
  completedTodayCount,
  pendingTodayCount,
  overdueCount,
}) => {
  const { colors, isDark } = useTheme();
  const total = pendingTodayCount + completedTodayCount;
  const pct = total > 0 ? Math.round((completedTodayCount / total) * 100) : 0;

  const now = new Date();
  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  const title = !total
    ? 'Dia livre'
    : pendingTodayCount === 0
      ? 'Tudo feito por hoje'
      : `${completedTodayCount} de ${total} concluídas hoje`;

  const subtitle = overdueCount > 0
    ? `${overdueCount} ${overdueCount === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`
    : pendingTodayCount > 0
      ? `${pendingTodayCount} ${pendingTodayCount === 1 ? 'tarefa para hoje' : 'tarefas para hoje'}`
      : 'Toque no + para planejar seu dia';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surf,
        },
      ]}
    >
      <ProtoRingChart
        pct={pct}
        size={56}
        strokeWidth={5}
        color={colors.purple}
        label={`${pct}%`}
        isDark={isDark}
      />

      <View style={styles.textCol}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{dateLabel}</Text>
        <Text
          style={[
            styles.title,
            { color: colors.ink, fontFamily: tokens.typography.family.semibold },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: overdueCount > 0 ? colors.red : colors.muted },
          ]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
    padding: 16,
    borderRadius: 24,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ringBox: {
    width: 56,
    height: 56,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '500',
  },
  title: {
    fontSize: 15.5,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
  },
});
