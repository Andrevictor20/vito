import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import type { FinanceLimitStatus, SpendingLimitScope } from '../../types/finance';
import { formatBRL } from './financeHelpers';

interface SpendingLimitsCardProps {
  limits: FinanceLimitStatus[];
  isPrivacyHidden?: boolean;
  onAddLimit: () => void;
  onEditLimit: (item: FinanceLimitStatus) => void;
  onMuteLimit: (limitId: string) => void;
}

const SCOPE_FILTERS: ReadonlyArray<{ key: 'ALL' | SpendingLimitScope; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'CARD', label: 'Cartões' },
  { key: 'CATEGORY', label: 'Categorias' },
  { key: 'SUBSCRIPTIONS', label: 'Assinaturas' },
  { key: 'MERCHANT', label: 'Lojas' },
];

const SCOPE_BADGE: Record<string, string> = {
  CARD: 'Cartão',
  CATEGORY: 'Categoria',
  SUBSCRIPTIONS: 'Assinaturas',
  MERCHANT: 'Loja',
  GLOBAL_MONTHLY: 'Mensal',
  SAVINGS_GOAL: 'Meta',
};

export const SpendingLimitsCard: React.FC<SpendingLimitsCardProps> = ({
  limits,
  isPrivacyHidden = false,
  onAddLimit,
  onEditLimit,
  onMuteLimit,
}) => {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<'ALL' | SpendingLimitScope>('ALL');

  const visible = limits.filter((l) => (filter === 'ALL' ? true : l.rule.scope_type === filter));

  return (
    <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink }]}>Limites do Ciclo</Text>
        <TouchableOpacity onPress={onAddLimit} style={[styles.addBtn, { backgroundColor: colors.finBg }]}>
          <Text style={[styles.addBtnText, { color: colors.fin }]}>+ Novo limite</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {SCOPE_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.finBg : 'transparent',
                  borderColor: active ? colors.fin : colors.line,
                },
              ]}
            >
              <Text style={[styles.filterText, { color: active ? colors.fin : colors.muted }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {visible.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted }]}>
          Nenhum limite configurado neste filtro. Toque em "+ Novo limite" para criar alertas de gasto.
        </Text>
      ) : (
        visible.map((item) => {
          const pct = Math.min(100, Math.max(0, item.percent_used));
          const barColor =
            item.status_label === 'EXCEEDED'
              ? colors.red
              : item.status_label === 'WARNING' || item.status_label === 'PACE_RISK'
                ? colors.fin
                : colors.acc;
          return (
            <TouchableOpacity
              key={item.rule.id || item.rule.title}
              onPress={() => onEditLimit(item)}
              style={[styles.row, { borderTopColor: colors.line }]}
            >
              <View style={styles.rowTop}>
                <View style={styles.rowTitleWrap}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]}>{item.rule.title}</Text>
                  <View style={[styles.badge, { backgroundColor: colors.btn }]}>
                    <Text style={[styles.badgeText, { color: colors.muted }]}>
                      {SCOPE_BADGE[item.rule.scope_type] ?? item.rule.scope_type}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.rowAmount, { color: colors.ink }]}>
                  {isPrivacyHidden
                    ? 'R$ ••••'
                    : `${formatBRL(item.spent_amount)} / ${formatBRL(item.rule.target_amount)}`}
                </Text>
              </View>

              <View style={[styles.track, { backgroundColor: colors.btn }]}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
                <View style={[styles.marker80, { backgroundColor: colors.muted }]} />
              </View>

              <View style={styles.rowBottom}>
                <Text style={[styles.statusText, { color: barColor }]}>
                  {Math.round(item.percent_used)}% usado ·{' '}
                  {item.status_label === 'EXCEEDED'
                    ? 'Limite ultrapassado'
                    : item.status_label === 'PACE_RISK'
                      ? 'Ritmo acelerado'
                      : item.status_label === 'WARNING'
                        ? 'Atenção'
                        : 'Sob controle'}
                </Text>
                {item.rule.id && (
                  <TouchableOpacity onPress={() => onMuteLimit(item.rule.id!)}>
                    <Text style={[styles.muteText, { color: colors.muted }]}>Silenciar ciclo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  addBtnText: { fontSize: 12, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '500' },
  empty: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  row: { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  rowAmount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 7, borderRadius: 999, overflow: 'hidden', position: 'relative' },
  fill: { height: '100%', borderRadius: 999 },
  marker80: { position: 'absolute', left: '80%', top: 0, bottom: 0, width: 1.5, opacity: 0.5 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusText: { fontSize: 12, fontWeight: '600' },
  muteText: { fontSize: 11, textDecorationLine: 'underline' },
});
