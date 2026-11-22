import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { VitoMascot } from '../common/VitoMascot';
import { WeeklySummaryItem } from '../../utils/weeklySummaryCalculator';

interface WeeklySummarySectionProps {
  summaries: WeeklySummaryItem[];
  onSelectWeek: (item: WeeklySummaryItem) => void;
}

export const WeeklySummarySection: React.FC<WeeklySummarySectionProps> = ({
  summaries,
  onSelectWeek,
}) => {
  const { colors, isDark } = useTheme();
  const chronological = useMemo(() => [...summaries].reverse(), [summaries]);
  const [selectedIdx, setSelectedIdx] = useState<number>(Math.max(0, chronological.length - 1));

  const active = chronological[selectedIdx] || summaries[0];
  const prev = selectedIdx > 0 ? chronological[selectedIdx - 1] : undefined;
  const diff = prev && active ? active.hours - prev.hours : 0;

  const maxWeekHours = Math.max(1, ...chronological.map((s) => s.hours || 0));
  const avgHours =
    chronological.length > 0
      ? chronological.reduce((sum, x) => sum + (x.hours || 0), 0) / chronological.length
      : 0;
  const avgBottomPct = Math.round((avgHours / maxWeekHours) * 84);

  const dailyList = active?.dailyActivity || [];
  const maxDaily = Math.max(1, ...dailyList.map((d) => d.hours || 0));
  const catColors = [colors.teal, colors.purple, colors.blue];

  const categories = useMemo(() => {
    if (!active) return [];
    const total = Math.max(0.1, active.hours || 1);
    return [
      { label: 'Trabalho', hours: Number((total * 0.5).toFixed(1)), color: catColors[0] },
      { label: 'Estudo', hours: Number((total * 0.28).toFixed(1)), color: catColors[1] },
      { label: 'Compromisso', hours: Number((total * 0.22).toFixed(1)), color: catColors[2] },
    ];
  }, [active, catColors]);

  if (!active) return null;

  return (
    <View style={styles.container}>
      {/* Hero .rs-hero com barras semanais interativas .rs-bars + linha tracejada média */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: isDark ? '#141925' : '#EFF5FF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,124,255,0.12)',
          },
        ]}
      >
        <View style={styles.ebRow}>
          <MaterialIcons name="calendar-today" size={14} color={colors.muted} />
          <Text style={[styles.eb, { color: colors.muted }]}>Horas em compromissos</Text>
        </View>
        <Text style={[styles.big, { color: colors.ink }]}>
          {active.hours.toFixed(1).replace('.', ',')}
          <Text style={[styles.bigSmall, { color: colors.muted }]}>h · {active.period}</Text>
        </Text>
        {prev && (
          <View style={[styles.deltaChip, { backgroundColor: colors.bg }]}>
            <Text style={[styles.deltaText, { color: colors.ink }]}>
              {diff >= 0 ? '▲ +' : '▼ '}
              {diff.toFixed(1).replace('.', ',')}h vs semana anterior
            </Text>
          </View>
        )}

        <View style={styles.barsOuter}>
          <View
            style={[
              styles.avgLine,
              { bottom: 20 + Math.round((avgBottomPct / 100) * 100), borderColor: colors.muted },
            ]}
          >
            <Text style={[styles.avgLabel, { color: colors.muted }]}>média</Text>
          </View>

          <View style={styles.barsRow}>
            {chronological.map((w, idx) => {
              const isSel = idx === selectedIdx;
              const barH = Math.max(8, Math.round(((w.hours || 0) / maxWeekHours) * 84));
              return (
                <TouchableOpacity
                  key={w.id}
                  style={styles.barCol}
                  onPress={() => {
                    hapticFeedback.selection();
                    setSelectedIdx(idx);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.barVal, { color: colors.ink }]}>
                    {w.hours.toFixed(1).replace('.', ',')}h
                  </Text>
                  <View
                    style={[
                      styles.barRect,
                      {
                        height: barH,
                        backgroundColor: isSel ? colors.blue : colors.line,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.barLbl,
                      { color: isSel ? colors.ink : colors.muted, fontWeight: isSel ? '600' : '400' },
                    ]}
                    numberOfLines={1}
                  >
                    {w.period.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <Text style={[styles.tapHint, { color: colors.muted }]}>
          Toque em uma semana para ver os detalhes
        </Text>
      </View>

      {/* Carga diária (.rs-bars.sm) */}
      <View style={[styles.card, { backgroundColor: colors.surf }]}>
        <Text style={[styles.eb, { color: colors.muted }]}>Carga diária</Text>
        <View style={[styles.barsRow, { height: 96, marginTop: 14 }]}>
          {dailyList.map((d) => {
            const barH = d.hours > 0 ? Math.max(8, Math.round((d.hours / maxDaily) * 62)) : 4;
            return (
              <View key={d.dateStr} style={styles.barCol}>
                <Text style={[styles.barVal, { color: colors.muted }]}>
                  {d.hours > 0 ? `${d.hours.toFixed(1).replace('.', ',')}h` : ''}
                </Text>
                <View
                  style={[
                    styles.barRect,
                    {
                      height: barH,
                      backgroundColor: d.isToday ? colors.blue : colors.line,
                    },
                  ]}
                />
                <Text style={[styles.barLbl, { color: d.isToday ? colors.ink : colors.muted }]}>
                  {d.dayShort}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Estatísticas & categorias */}
      <View style={[styles.card, { backgroundColor: colors.surf }]}>
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={[styles.statVal, { color: colors.ink }]}>{active.eventsCount}</Text>
            <Text style={[styles.statSub, { color: colors.muted }]}>eventos</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statVal, { color: colors.ink }]}>
              {active.completedTodosCount}/{active.totalTodosCount || 0}
            </Text>
            <Text style={[styles.statSub, { color: colors.muted }]}>tarefas</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statVal, { color: colors.ink }]}>
              {active.hours.toFixed(1).replace('.', ',')}
            </Text>
            <Text style={[styles.statSub, { color: colors.muted }]}>horas</Text>
          </View>
        </View>

        <View style={styles.stkBar}>
          {categories.map((c) => (
            <View key={c.label} style={{ flex: Math.max(1, c.hours), backgroundColor: c.color, borderRadius: 6 }} />
          ))}
        </View>

        <View style={styles.ctList}>
          {categories.map((c) => (
            <View key={c.label} style={styles.ctRow}>
              <View style={[styles.ctDot, { backgroundColor: c.color }]} />
              <View style={[styles.ctTrack, { backgroundColor: colors.bg }]}>
                <View
                  style={{
                    width: `${Math.round((c.hours / Math.max(0.1, active.hours)) * 100)}%`,
                    height: '100%',
                    backgroundColor: c.color,
                    borderRadius: 3,
                  }}
                />
              </View>
              <Text style={[styles.ctVal, { color: colors.muted }]}>
                {c.label} · {c.hours.toFixed(1).replace('.', ',')}h
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.vtCard, { backgroundColor: colors.surf }]}>
        <View style={[styles.vtMascot, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <VitoMascot size={26} state="idle" />
        </View>
        <Text style={[styles.vtText, { color: colors.ink }]}>{active.narrative}</Text>
      </View>

      <TouchableOpacity
        style={[styles.rxBtn, { backgroundColor: colors.surf }]}
        onPress={() => {
          hapticFeedback.light();
          onSelectWeek(active);
        }}
      >
        <Text style={[styles.rxBtnText, { color: colors.ink }]}>Abrir Raio-X</Text>
        <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  heroCard: { borderRadius: 24, borderWidth: 1, padding: 18 },
  card: { borderRadius: 24, padding: 18 },
  ebRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eb: { fontSize: 11.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7 },
  big: { fontSize: 38, fontWeight: '600', letterSpacing: -1.2, marginTop: 10, fontVariant: ['tabular-nums'] },
  bigSmall: { fontSize: 15, fontWeight: '500' },
  deltaChip: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, marginTop: 8 },
  deltaText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  barsOuter: { position: 'relative', marginTop: 18 },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  avgLabel: { position: 'absolute', right: 0, top: -16, fontSize: 10.5 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 120 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  barVal: { fontSize: 11, fontWeight: '500', fontVariant: ['tabular-nums'] },
  barRect: { width: '100%', maxWidth: 44, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  barLbl: { fontSize: 11 },
  tapHint: { fontSize: 12, textAlign: 'center', marginTop: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statCell: { alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statSub: { fontSize: 12 },
  stkBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 3, marginTop: 14 },
  ctList: { marginTop: 14, gap: 8 },
  ctRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctDot: { width: 10, height: 10, borderRadius: 5 },
  ctTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  ctVal: { fontSize: 12.5, fontWeight: '500', fontVariant: ['tabular-nums'] },
  vtCard: { borderRadius: 22, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  vtMascot: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  vtText: { flex: 1, fontSize: 14, lineHeight: 20 },
  rxBtn: { height: 50, borderRadius: 20, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rxBtnText: { fontSize: 14.5, fontWeight: '600' },
});
