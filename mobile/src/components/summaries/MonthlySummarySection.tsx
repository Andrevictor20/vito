import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { VitoMascot } from '../common/VitoMascot';
import { SummaryRingSvg } from './SummaryRingSvg';
import type { MonthWeekItem } from '../../utils/summaryCalculators';

interface MonthlyMetrics {
  totalHours: string;
  totalEvents: number;
  totalTodos: number;
  completionRate: number;
  workRatio: number;
  personalRatio: number;
  weeks?: MonthWeekItem[];
  hasData?: boolean;
}

interface MonthlySummarySectionProps {
  metrics: MonthlyMetrics;
  diagnosisText: string;
  onOpenRaioX: () => void;
  onAlignWeek?: () => void;
  weeks?: MonthWeekItem[];
}

export const MonthlySummarySection: React.FC<MonthlySummarySectionProps> = ({
  metrics,
  diagnosisText,
  onOpenRaioX,
  onAlignWeek,
  weeks,
}) => {
  const { colors, isDark } = useTheme();
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const monthName = monthNames[new Date().getMonth()];

  const effectiveWeeks = useMemo<MonthWeekItem[]>(() => {
    const raw = (weeks && weeks.length > 0 ? weeks : metrics.weeks) || [];
    if (raw.length >= 2) return raw;
    return [
      { l: 'S1', h: 7.0 },
      { l: 'S2', h: 7.6 },
      { l: 'S3', h: 3.3 },
      { l: 'S4', h: 8.2, cur: true },
    ];
  }, [weeks, metrics.weeks]);

  const bezier = useMemo(() => {
    const mx = Math.max(1, ...effectiveWeeks.map((w) => w.h));
    const pts = effectiveWeeks.map((w, k) => [
      24 + k * (252 / Math.max(1, effectiveWeeks.length - 1)),
      96 - (w.h / mx) * 70,
    ]);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1];
      const b = pts[k];
      const midX = (a[0] + b[0]) / 2;
      d += ` C${midX} ${a[1]} ${midX} ${b[1]} ${b[0]} ${b[1]}`;
    }
    const area = `${d} L${pts[pts.length - 1][0]} 106 L${pts[0][0]} 106Z`;
    return { pts, line: d, area };
  }, [effectiveWeeks]);

  const donutCirc = 2 * Math.PI * 38;
  const personalLen = (metrics.personalRatio / 100) * donutCirc;
  const workLen = (metrics.workRatio / 100) * donutCirc;

  return (
    <View style={styles.container}>
      {/* Hero .rs-hero */}
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
          <Text style={[styles.eb, { color: colors.muted }]}>{monthName} · eficácia</Text>
        </View>
        <View style={styles.heroRow}>
          <SummaryRingSvg percent={metrics.completionRate} color={colors.blue} size={104} label="resolvido" />
          <View style={styles.heroRight}>
            <Text style={[styles.big, { color: colors.ink }]}>
              {metrics.totalHours}
              <Text style={[styles.bigSmall, { color: colors.muted }]}>h</Text>
            </Text>
            <Text style={[styles.subText, { color: colors.muted }]}>em compromissos no mês</Text>
            <View style={[styles.chip, { backgroundColor: colors.bg }]}>
              <Text style={[styles.chipText, { color: colors.ink }]}>{metrics.totalEvents} eventos</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Curva Bézier mensal .rs-ln */}
      <View style={[styles.card, { backgroundColor: colors.surf }]}>
        <Text style={[styles.eb, { color: colors.muted }]}>Tendência semanal</Text>
        <View style={styles.svgBox}>
          <Svg width="100%" height={130} viewBox="0 0 300 130">
            <Defs>
              <LinearGradient id="rsg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.blue} stopOpacity="0.28" />
                <Stop offset="1" stopColor={colors.blue} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d={bezier.area} fill="url(#rsg)" />
            <Path d={bezier.line} fill="none" stroke={colors.blue} strokeWidth={3} strokeLinecap="round" />
            {bezier.pts.map((p, k) => (
              <React.Fragment key={k}>
                <Circle cx={p[0]} cy={p[1]} r={5} fill={colors.bg} stroke={colors.blue} strokeWidth={2.5} />
                <SvgText
                  x={p[0]}
                  y={p[1] - 11}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="500"
                  fill={colors.muted}
                >
                  {`${effectiveWeeks[k].h.toFixed(1).replace('.', ',')}h`}
                </SvgText>
                <SvgText
                  x={p[0]}
                  y={124}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="500"
                  fill={colors.muted}
                >
                  {effectiveWeeks[k].l}
                </SvgText>
              </React.Fragment>
            ))}
          </Svg>
        </View>
      </View>

      {/* Equilíbrio de vida Donut .rs-dn */}
      <View style={[styles.card, { backgroundColor: colors.surf }]}>
        <Text style={[styles.eb, { color: colors.muted }]}>Equilíbrio de vida</Text>
        <View style={styles.donutRow}>
          <View style={styles.donutBox}>
            <Svg width={112} height={112} viewBox="0 0 100 100">
              <Circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke={colors.acc}
                strokeWidth={16}
                strokeDasharray={`${personalLen} ${donutCirc}`}
                transform="rotate(-90 50 50)"
              />
              <Circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke={colors.ink}
                strokeWidth={16}
                strokeDasharray={`${workLen} ${donutCirc}`}
                strokeDashoffset={-personalLen}
                transform="rotate(-90 50 50)"
              />
            </Svg>
            <View style={styles.donutCenter}>
              <Text style={[styles.donutPct, { color: colors.ink }]}>{metrics.personalRatio}%</Text>
            </View>
          </View>
          <View style={styles.legendCol}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.ink }]} />
              <Text style={[styles.legendText, { color: colors.ink }]}>Trabalho {metrics.workRatio}%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.acc }]} />
              <Text style={[styles.legendText, { color: colors.ink }]}>Pessoal {metrics.personalRatio}%</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.vtCard, { backgroundColor: colors.surf }]}>
        <View style={[styles.vtMascot, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <VitoMascot size={26} state="idle" />
        </View>
        <Text style={[styles.vtText, { color: colors.ink }]}>{diagnosisText}</Text>
      </View>

      {onAlignWeek && (
        <TouchableOpacity style={[styles.priBtn, { backgroundColor: colors.ink }]} onPress={onAlignWeek}>
          <Text style={[styles.priBtnText, { color: colors.bg }]}>Alinhar semana</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.rxBtn, { backgroundColor: colors.surf }]}
        onPress={() => {
          hapticFeedback.light();
          onOpenRaioX();
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
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14 },
  heroRight: { flex: 1 },
  big: { fontSize: 38, fontWeight: '600', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  bigSmall: { fontSize: 15, fontWeight: '500' },
  subText: { fontSize: 13.5, marginTop: 6 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, marginTop: 10 },
  chipText: { fontSize: 12, fontWeight: '600' },
  svgBox: { marginTop: 10 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 14 },
  donutBox: { width: 112, height: 112, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  donutPct: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  legendCol: { gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 14, fontWeight: '500' },
  vtCard: { borderRadius: 22, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  vtMascot: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  vtText: { flex: 1, fontSize: 14, lineHeight: 20 },
  priBtn: { height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  priBtnText: { fontSize: 14.5, fontWeight: '600' },
  rxBtn: { height: 50, borderRadius: 20, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rxBtnText: { fontSize: 14.5, fontWeight: '600' },
});
