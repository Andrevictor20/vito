import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoRingChart } from '../../../../charts/ProtoRingChart';
import { useTheme } from '../../../../context/ThemeContext';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { hapticFeedback } from '../../../../theme/motion';
import { tabularNumbers } from '../../../../theme/tokens';
import { CountUpText, StaggerItem, useReduceMotion } from '../../../../theme/vitoMotion';
import type { MonthWeekItem } from '../../utils/summaryCalculators';
import type { WeeklySummaryItem } from '../../utils/weeklySummaryCalculator';
import { withHexAlpha } from '../../../finance/components/shared/financeHelpers';
import {
  SummaryBalanceDonut,
  SummaryCard,
  SummaryCategoryBreakdown,
  SummaryEyebrow,
  SummaryHeroCard,
  SummaryTrendLineChart,
} from './SummaryPrimitives';

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
  weeklySummaries?: WeeklySummaryItem[];
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MonthlySummarySection: React.FC<MonthlySummarySectionProps> = ({
  metrics,
  diagnosisText,
  onOpenRaioX,
  onAlignWeek,
  weeks,
  weeklySummaries,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const monthName = MONTH_NAMES[new Date().getMonth()];

  const effectiveWeeks = useMemo<MonthWeekItem[]>(() => {
    const raw = (weeks && weeks.length > 0 ? weeks : metrics.weeks) || [];
    if (raw.length >= 2) return raw;
    return [
      { l: 'S1', h: 0 },
      { l: 'S2', h: 0 },
      { l: 'S3', h: 0 },
      { l: 'S4', h: 0, cur: true },
    ];
  }, [weeks, metrics.weeks]);

  const aggregatedCategories = useMemo(() => {
    const map = new Map<string, { name: string; hours: number; color: string }>();
    if (weeklySummaries && weeklySummaries.length > 0) {
      for (const wk of weeklySummaries) {
        for (const cat of wk.categories) {
          const prev = map.get(cat.name);
          if (prev) {
            prev.hours = Math.round((prev.hours + cat.hours) * 10) / 10;
          } else {
            map.set(cat.name, { name: cat.name, hours: cat.hours, color: cat.color });
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [weeklySummaries]);

  const totalHoursNum = parseFloat(metrics.totalHours) || 0;
  const trendPoints = useMemo(
    () => effectiveWeeks.map((w) => ({ label: w.l.replace('Sem ', 'S'), value: w.h })),
    [effectiveWeeks]
  );

  return (
    <View style={styles.container}>
      {/* Bloco 1: Hero .rs-c.rs-hero com anel azul 104px + horas + chip eventos */}
      <StaggerItem index={0}>
        <SummaryHeroCard>
          <SummaryEyebrow label={`${monthName} · eficácia`} icon="calendar-month" />
          <View style={styles.heroRow}>
            <ProtoRingChart
              pct={metrics.completionRate}
              size={104}
              strokeWidth={10}
              color={colors.blue}
              trackColor={withHexAlpha(colors.blue, 0.16)}
              subtitle="resolvido"
              animateLabel
              durationMs={1250}
              isDark={isDark}
              reduceMotion={reduceMotion}
            />
            <View style={styles.heroRight}>
              <View style={styles.bigLine}>
                <CountUpText
                  value={totalHoursNum}
                  decimals={Number.isInteger(totalHoursNum) ? 0 : 1}
                  durationMs={1150}
                  style={[styles.big, { color: colors.ink }]}
                />
                <Text style={[styles.bigSmall, { color: colors.muted }]}> h</Text>
              </View>
              <Text style={[styles.subText, { color: colors.muted }]}>
                em compromissos no mês
              </Text>
              <View style={[styles.eventsChip, { backgroundColor: colors.btn }]}>
                <Text style={[styles.eventsChipText, tabularNumbers, { color: colors.ink }]}>
                  {metrics.totalEvents} {metrics.totalEvents === 1 ? 'evento' : 'eventos'}
                </Text>
              </View>
            </View>
          </View>
        </SummaryHeroCard>
      </StaggerItem>

      {/* Bloco 2: Tendência semanal (curva Bézier suave + área gradiente azul) */}
      <StaggerItem index={1}>
        <SummaryCard>
          <SummaryEyebrow label="Tendência semanal" />
          <SummaryTrendLineChart points={trendPoints} />
        </SummaryCard>
      </StaggerItem>

      {/* Bloco 3: Equilíbrio de vida (donut circular 112px + legenda vertical) */}
      <StaggerItem index={2}>
        <SummaryCard>
          <SummaryEyebrow label="Equilíbrio de vida" />
          <View style={styles.balanceRow}>
            <SummaryBalanceDonut
              personalRatio={metrics.personalRatio}
              workRatio={metrics.workRatio}
            />
            <View style={styles.legendCol}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.ink }]} />
                <Text style={[styles.legendText, tabularNumbers, { color: colors.ink }]}>
                  Trabalho {metrics.workRatio}%
                </Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.acc }]} />
                <Text style={[styles.legendText, tabularNumbers, { color: colors.ink }]}>
                  Pessoal {metrics.personalRatio}%
                </Text>
              </View>
            </View>
          </View>
        </SummaryCard>
      </StaggerItem>

      {/* Bloco 4: Onde o tempo foi (barras horizontais animadas por categoria) */}
      {aggregatedCategories.length > 0 ? (
        <StaggerItem index={3}>
          <SummaryCard>
            <SummaryEyebrow label="Onde o tempo foi" />
            <SummaryCategoryBreakdown items={aggregatedCategories} />
          </SummaryCard>
        </StaggerItem>
      ) : null}

      {/* Bloco 5: Alinhar semana + Abrir Raio-X */}
      <StaggerItem index={aggregatedCategories.length > 0 ? 4 : 3}>
        {onAlignWeek ? (
          <TouchableOpacity
            style={[styles.priBtn, { backgroundColor: colors.ink }]}
            onPress={() => {
              hapticFeedback.light();
              onAlignWeek();
            }}
            activeOpacity={0.82}
          >
            <Text style={[styles.priBtnText, { color: colors.bg }]}>Alinhar semana</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.lnkBtn, { backgroundColor: colors.surf }]}
          onPress={() => {
            hapticFeedback.light();
            onOpenRaioX();
          }}
          activeOpacity={0.78}
        >
          <Text style={[styles.lnkText, { color: colors.ink }]}>Abrir Raio-X</Text>
          <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>
      </StaggerItem>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 14,
  },
  heroRight: {
    flex: 1,
    minWidth: 0,
  },
  bigLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  big: {
    fontFamily: 'Geist_500Medium',
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.6,
  },
  bigSmall: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
  },
  subText: {
    fontFamily: 'Geist',
    fontSize: 14,
    marginTop: 8,
  },
  eventsChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
  },
  eventsChipText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginTop: 14,
  },
  legendCol: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
  },
  priBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  priBtnText: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 14.5,
  },
  lnkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  lnkText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
  },
});
