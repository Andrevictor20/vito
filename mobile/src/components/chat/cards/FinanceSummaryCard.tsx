import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { formatBRL } from '../../finance/financeHelpers';

interface FinanceSummaryCardProps {
  title?: string;
  data?: Record<string, unknown>;
}

export const FinanceSummaryCard: React.FC<FinanceSummaryCardProps> = ({
  title = 'Resumo Financeiro',
  data = {},
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={[styles.label, { color: colors.muted }]}>Safe-to-Spend</Text>
          <Text style={[styles.val, { color: colors.fin }]}>
            {formatBRL(Number(data.safe_to_spend_daily || 0))}/dia
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={[styles.label, { color: colors.muted }]}>Saldo</Text>
          <Text style={[styles.val, { color: colors.ink }]}>
            {formatBRL(Number(data.consolidated_balance || 0))}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={[styles.label, { color: colors.muted }]}>Faturas</Text>
          <Text style={[styles.val, { color: colors.ink }]}>
            {formatBRL(Number(data.open_invoices_total || 0))}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 8, marginTop: 6 },
  title: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  label: { fontSize: 11 },
  val: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
