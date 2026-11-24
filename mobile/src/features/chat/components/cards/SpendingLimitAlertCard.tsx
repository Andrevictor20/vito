import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { formatBRL } from '../../../finance/components/shared/financeHelpers';

interface SpendingLimitAlertCardProps {
  title?: string;
  data?: Record<string, unknown>;
}

export const SpendingLimitAlertCard: React.FC<SpendingLimitAlertCardProps> = ({
  title = 'Limite de Gasto',
  data = {},
}) => {
  const { colors } = useTheme();
  const spent = Number(data.spent_amount || 0);
  const target = Number(data.target_amount || 1);
  const pct = Math.min(100, Math.round((spent / Math.max(1, target)) * 100));
  const barColor = pct >= 100 ? colors.red : pct >= 80 ? colors.fin : colors.acc;

  return (
    <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
      <View style={styles.top}>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.pct, { color: barColor }]}>{pct}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.btn }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {formatBRL(spent)} / {formatBRL(target)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 6, marginTop: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '700' },
  pct: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  sub: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
