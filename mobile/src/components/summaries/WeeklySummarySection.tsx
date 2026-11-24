import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { hapticFeedback } from '../../theme/motion';
import { tabularNumbers } from '../../theme/tokens';
import {
  AnimatedSegmentedBar,
  CountUpText,
  StaggerItem,
} from '../../theme/vitoMotion';
import { WeeklySummaryItem } from '../../utils/weeklySummaryCalculator';
import {
  SummaryCard,
  SummaryCategoryBreakdown,
  SummaryEyebrow,
  SummaryHeroCard,
  SummaryInteractiveBars,
  SummaryVitoNote,
} from './SummaryPrimitives';

interface WeeklySummarySectionProps {
  summaries: WeeklySummaryItem[];
  onSelectWeek: (item: WeeklySummaryItem) => void;
}

function formatShortWeekLabel(w: WeeklySummaryItem, idx: number): string {
  const start = w.weekStart instanceof Date ? w.weekStart : new Date(w.weekStart);
  const end = w.weekEnd instanceof Date ? w.weekEnd : new Date(w.weekEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return w.period.split(' - ')[0] || `S${idx + 1}`;
  }
  const sDay = start.getDate();
  const eDay = end.getDate();
  if (start.getMonth() === end.getMonth()) {
    return `${sDay}–${eDay}`;
  }
  const sMonth = start
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .slice(0, 3);
  return `${sDay} ${sMonth}`;
}

export const WeeklySummarySection: React.FC<WeeklySummarySectionProps> = ({
  summaries,
  onSelectWeek,
}) => {
  const { colors } = useTheme();
  const chronological = useMemo(() => [...summaries].reverse(), [summaries]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  if (chronological.length === 0) return null;

  const activeIdx =
    selectedIdx >= 0 && selectedIdx < chronological.length
      ? selectedIdx
      : chronological.length - 1;
  const activeWeek = chronological[activeIdx];
  const prevWeek = activeIdx > 0 ? chronological[activeIdx - 1] : undefined;
  const diff = prevWeek ? activeWeek.hours - prevWeek.hours : 0;

  const weekBars = chronological.map((w, idx) => ({
    key: w.id,
    value: w.hours,
    label: formatShortWeekLabel(w, idx),
    topText: `${w.hours.toFixed(1).replace('.', ',')}h`,
    selected: idx === activeIdx,
  }));

  const dailyBars = activeWeek.dailyActivity.map((d, idx) => ({
    key: `${activeWeek.id}_d_${idx}`,
    value: d.hours,
    label: d.dayLabel.charAt(0).toUpperCase(),
    topText: d.hours > 0 ? `${d.hours.toFixed(1).replace('.', ',')}h` : '',
    selected: d.isToday || (!activeWeek.isCurrentWeek && d.isPeak),
    holiday: idx >= 5,
  }));

  const catSegments = activeWeek.categories.map((c, idx) => ({
    key: `${activeWeek.id}_cat_${idx}`,
    flex: Math.max(1, c.percentage || Math.round(c.hours * 10)),
    color: c.color,
  }));

  return (
    <View style={styles.container}>
      {/* Bloco 1: Hero .rs-c.rs-hero com horas, delta e gráfico interativo de semanas */}
      <StaggerItem index={0}>
        <SummaryHeroCard>
          <SummaryEyebrow label="Horas em compromissos" icon="calendar-month" />
          <View style={styles.bigLine}>
            <CountUpText
              value={activeWeek.hours}
              decimals={1}
              durationMs={1050}
              replayKey={activeIdx}
              style={[styles.big, { color: colors.ink }]}
            />
            <Text style={[styles.bigSmall, { color: colors.muted }]}>
              {' h · '}
              {activeWeek.period}
            </Text>
          </View>

          {prevWeek ? (
            <View style={[styles.deltaChip, { backgroundColor: colors.btn }]}>
              <Text style={[styles.deltaText, tabularNumbers, { color: colors.ink }]}>
                {diff >= 0 ? '▲ +' : '▼ '}
                {Math.abs(diff).toFixed(1).replace('.', ',')}h vs semana anterior
              </Text>
            </View>
          ) : null}

          <SummaryInteractiveBars
            items={weekBars}
            showAvg
            selectable
            onSelectIndex={(idx) => setSelectedIdx(idx)}
          />

          <Text style={[styles.tapHint, { color: colors.muted }]}>
            Toque em uma semana para ver os detalhes
          </Text>
        </SummaryHeroCard>
      </StaggerItem>

      {/* Bloco 2: Carga diária (.rs-bars.sm) */}
      <StaggerItem index={1}>
        <SummaryCard>
          <SummaryEyebrow label="Carga diária" />
          <SummaryInteractiveBars
            items={dailyBars}
            compact
            replayKey={activeIdx}
          />
        </SummaryCard>
      </StaggerItem>

      {/* Bloco 3: KPIs .rs-st + barra empilhada .rs-stk + categorias .rs-ct */}
      <StaggerItem index={2}>
        <SummaryCard>
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <CountUpText
                value={activeWeek.eventsCount}
                durationMs={950}
                replayKey={activeIdx}
                style={[styles.statVal, { color: colors.ink }]}
              />
              <Text style={[styles.statLbl, { color: colors.muted }]}>eventos</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, tabularNumbers, { color: colors.ink }]}>
                {activeWeek.completedTodosCount}/{activeWeek.totalTodosCount}
              </Text>
              <Text style={[styles.statLbl, { color: colors.muted }]}>tarefas</Text>
            </View>
            <View style={styles.statCol}>
              <CountUpText
                value={activeWeek.hours}
                decimals={1}
                durationMs={950}
                replayKey={activeIdx}
                style={[styles.statVal, { color: colors.ink }]}
              />
              <Text style={[styles.statLbl, { color: colors.muted }]}>horas</Text>
            </View>
          </View>

          {catSegments.length > 0 ? (
            <View style={styles.stkWrap}>
              <AnimatedSegmentedBar
                segments={catSegments}
                height={14}
                borderRadius={7}
                segmentRadius={5}
                gap={3}
                delayMs={180}
                stepMs={120}
                replayKey={activeIdx}
              />
            </View>
          ) : null}

          <SummaryCategoryBreakdown
            items={activeWeek.categories.map((c) => ({
              name: c.name,
              hours: c.hours,
              color: c.color,
            }))}
            replayKey={activeIdx}
          />
        </SummaryCard>
      </StaggerItem>

      {/* Bloco 4: Nota do Vito + Abrir Raio-X */}
      <StaggerItem index={3}>
        <SummaryVitoNote text={activeWeek.narrative} />
        <TouchableOpacity
          style={[styles.lnkBtn, { backgroundColor: colors.surf }]}
          onPress={() => {
            hapticFeedback.light();
            onSelectWeek(activeWeek);
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
  bigLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  big: {
    fontFamily: 'Geist_500Medium',
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.6,
  },
  bigSmall: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
  },
  deltaChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
  },
  deltaText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12,
  },
  tapHint: {
    fontFamily: 'Geist',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontFamily: 'Geist_500Medium',
    fontSize: 22,
    letterSpacing: -0.4,
  },
  statLbl: {
    fontFamily: 'Geist',
    fontSize: 12,
    marginTop: 2,
  },
  stkWrap: {
    marginTop: 16,
  },
  lnkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  lnkText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
  },
});
