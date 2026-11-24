import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoRingChart } from '../../../../charts/ProtoRingChart';
import { useTheme } from '../../../../context/ThemeContext';
import { hapticFeedback } from '../../../../theme/motion';
import { tabularNumbers } from '../../../../theme/tokens';
import {
  AnimatedSegmentedBar,
  CountUpText,
  StaggerItem,
  useReduceMotion,
} from '../../../../theme/vitoMotion';
import type { FocusBlock, TimelineSegment } from '../../utils/summaryCalculators';
import { withHexAlpha } from '../../../finance/components/shared/financeHelpers';
import {
  SummaryCard,
  SummaryEyebrow,
  SummaryHeroCard,
  SummaryNowIndicator,
} from './SummaryPrimitives';

interface TodayMetrics {
  eventsCount: number;
  committedHours: string;
  freeHours: string;
  totalTodos: number;
  completedTodos: number;
}

interface DailySummarySectionProps {
  metrics: TodayMetrics;
  hasFreeWindow: boolean;
  synthesisText: string;
  onReserveFocus?: () => void;
  onViewTasks?: () => void;
  nextEventTitle?: string;
  focusBlocks?: FocusBlock[];
  timelineSegments?: TimelineSegment[];
  todayFormatted?: string;
}

export const DailySummarySection: React.FC<DailySummarySectionProps> = ({
  metrics,
  hasFreeWindow,
  synthesisText,
  onReserveFocus,
  onViewTasks,
  nextEventTitle,
  focusBlocks,
  timelineSegments,
  todayFormatted,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();

  const committedNum = parseFloat(metrics.committedHours) || 0;
  const freeNum = parseFloat(metrics.freeHours) || 0;
  const freePct = Math.max(0, Math.min(100, Math.round((freeNum / 12) * 100)));
  const taskPct =
    metrics.totalTodos > 0 ? Math.round((metrics.completedTodos / metrics.totalTodos) * 100) : 0;

  const dayLoadLabel =
    committedNum <= 3 ? 'Dia leve' : committedNum <= 6 ? 'Dia equilibrado' : 'Dia intenso';

  const nowLeftPct = useMemo(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const clamped = Math.max(480, Math.min(1200, mins));
    return Math.round(((clamped - 480) / 720) * 100);
  }, []);

  const effectiveTimeline = useMemo<TimelineSegment[]>(() => {
    if (timelineSegments && timelineSegments.length > 0) return timelineSegments;
    if (committedNum === 0) return [{ flex: 12, type: 'free' }];
    return [
      { flex: Math.max(0.5, freeNum / 2), type: 'free' },
      { flex: Math.max(0.5, committedNum), type: 'committed' },
      { flex: Math.max(0.5, freeNum / 2), type: 'free' },
    ];
  }, [timelineSegments, committedNum, freeNum]);

  const effectiveFocusBlocks = useMemo<FocusBlock[]>(() => {
    if (focusBlocks !== undefined) return focusBlocks;
    if (freeNum >= 1) {
      return [
        {
          label: `Foco disponível · ${freeNum.toFixed(0)}h livres`,
          duration: `${freeNum.toFixed(0)}h`,
          startMinutes: 480,
          endMinutes: 1200,
        },
      ];
    }
    return [];
  }, [focusBlocks, freeNum]);

  const freeSegColor = withHexAlpha(colors.acc, isDark ? 0.36 : 0.4);
  const segments = useMemo(
    () =>
      effectiveTimeline.map((seg, idx) => ({
        key: `tl_${idx}`,
        flex: seg.flex,
        color: seg.type === 'free' ? freeSegColor : colors.blue,
      })),
    [effectiveTimeline, freeSegColor, colors.blue]
  );

  const nowFormatted = useMemo(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, []);

  const headerDate = todayFormatted || 'Hoje';
  const freeDecimals = Number.isInteger(freeNum) ? 0 : 1;
  const committedDecimals = Number.isInteger(committedNum) ? 0 : 1;

  return (
    <View style={styles.container}>
      {/* Bloco 1: Hero .rs-c.rs-hero com anel 104px + horas livres + chip */}
      <StaggerItem index={0}>
        <SummaryHeroCard>
          <SummaryEyebrow label={headerDate} icon="calendar-month" />
          <View style={styles.heroRow}>
            <ProtoRingChart
              pct={freePct}
              size={104}
              strokeWidth={10}
              color={colors.acc}
              trackColor={withHexAlpha(colors.acc, 0.16)}
              subtitle="livre"
              animateLabel
              durationMs={1250}
              isDark={isDark}
              reduceMotion={reduceMotion}
            />
            <View style={styles.heroRight}>
              <View style={styles.bigLine}>
                <CountUpText
                  value={freeNum}
                  decimals={freeDecimals}
                  durationMs={1150}
                  style={[styles.big, { color: colors.ink }]}
                />
                <Text style={[styles.bigSmall, { color: colors.muted }]}> h livres</Text>
              </View>
              <Text style={[styles.metaRow, { color: colors.muted }]}>
                <CountUpText
                  value={committedNum}
                  decimals={committedDecimals}
                  suffix="h"
                  durationMs={1150}
                  style={[styles.metaBold, { color: colors.ink }]}
                />
                {' comprometida'}
              </Text>
              <View style={[styles.chip, { backgroundColor: withHexAlpha(colors.acc, 0.16) }]}>
                <Text style={[styles.chipText, { color: colors.acc }]}>{dayLoadLabel}</Text>
              </View>
            </View>
          </View>
        </SummaryHeroCard>
      </StaggerItem>

      {/* Bloco 2: Linha do dia (.rs-tl + indicador Agora + janelas de foco) */}
      <StaggerItem index={1}>
        <SummaryCard>
          <View style={styles.tlHeader}>
            <SummaryEyebrow label="Linha do dia" />
            <View style={[styles.nowPill, { backgroundColor: withHexAlpha(colors.red, 0.12) }]}>
              <View style={[styles.nowDot, { backgroundColor: colors.red }]} />
              <Text style={[styles.nowPillText, tabularNumbers, { color: colors.red }]}>
                Agora · {nowFormatted}
              </Text>
            </View>
          </View>
          <View style={styles.tlWrap}>
            <AnimatedSegmentedBar
              segments={segments}
              height={16}
              borderRadius={8}
              segmentRadius={6}
              gap={3}
              delayMs={180}
              stepMs={140}
              durationMs={900}
            />
            <SummaryNowIndicator leftPct={nowLeftPct} />
          </View>

          <View style={styles.tlLabels}>
            <Text style={[styles.tlLbl, { color: colors.muted }]}>08:00</Text>
            <Text style={[styles.tlLbl, { color: colors.muted }]}>14:00</Text>
            <Text style={[styles.tlLbl, { color: colors.muted }]}>20:00</Text>
          </View>

          <View style={styles.focusWrap}>
            {effectiveFocusBlocks.length > 0 ? (
              effectiveFocusBlocks.map((b, i) => (
                <View key={i} style={[styles.focusChip, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.focusChipText, { color: colors.ink }]}>{b.label}</Text>
                </View>
              ))
            ) : (
              <View style={[styles.focusChip, { backgroundColor: colors.bg }]}>
                <Text style={[styles.focusChipText, { color: colors.muted }]}>
                  Nenhum bloco livre disponível hoje
                </Text>
              </View>
            )}
          </View>
        </SummaryCard>
      </StaggerItem>

      {/* Bloco 3: Grid 2 colunas (.rs-two: Agenda | Tarefas com anel 64px) */}
      <StaggerItem index={2}>
        <View style={styles.twoGrid}>
          <SummaryCard style={styles.halfCard}>
            <SummaryEyebrow label="Agenda" icon="calendar-month" color={colors.blue} />
            <View style={[styles.bigLine, { marginTop: 14 }]}>
              <CountUpText
                value={metrics.eventsCount}
                durationMs={1000}
                style={[styles.bigMedium, { color: colors.ink }]}
              />
              <Text style={[styles.bigSmall, { color: colors.muted }]} numberOfLines={1}>
                {metrics.eventsCount === 1 ? ' compromisso' : ' compromissos'}
              </Text>
            </View>
            <Text style={[styles.metaSub, { color: colors.muted }]} numberOfLines={1}>
              {nextEventTitle || 'Sem compromissos'}
            </Text>
          </SummaryCard>

          <SummaryCard style={styles.halfCard}>
            <SummaryEyebrow label="Tarefas" icon="check-circle" color={colors.purple} />
            <View style={styles.tasksRow}>
              <ProtoRingChart
                pct={taskPct}
                size={64}
                strokeWidth={7}
                color={colors.purple}
                trackColor={withHexAlpha(colors.purple, 0.16)}
                animateLabel
                labelSize={15}
                durationMs={1150}
                isDark={isDark}
                reduceMotion={reduceMotion}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.tasksCount, tabularNumbers, { color: colors.ink }]}>
                  {metrics.completedTodos}/{metrics.totalTodos}
                </Text>
                <Text style={[styles.tasksSub, { color: colors.muted }]}>feitas</Text>
              </View>
            </View>
          </SummaryCard>
        </View>
      </StaggerItem>

      {/* Bloco 4: Botões de ação (.brow) */}
      {(onReserveFocus && hasFreeWindow) || onViewTasks ? (
        <StaggerItem index={3}>
          <View style={styles.btnsRow}>
            {onReserveFocus && hasFreeWindow ? (
              <TouchableOpacity
                style={[styles.priBtn, { backgroundColor: colors.ink }]}
                onPress={() => {
                  hapticFeedback.light();
                  onReserveFocus();
                }}
                activeOpacity={0.82}
              >
                <Text style={[styles.priBtnText, { color: colors.bg }]}>Reservar foco</Text>
              </TouchableOpacity>
            ) : null}
            {onViewTasks ? (
              <TouchableOpacity
                style={[styles.secBtn, { backgroundColor: colors.surf }]}
                onPress={() => {
                  hapticFeedback.light();
                  onViewTasks();
                }}
                activeOpacity={0.82}
              >
                <Text style={[styles.secBtnText, { color: colors.ink }]}>Ver tarefas</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </StaggerItem>
      ) : null}
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
    flexWrap: 'wrap',
  },
  big: {
    fontFamily: 'Geist_500Medium',
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.6,
  },
  bigMedium: {
    fontFamily: 'Geist_500Medium',
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.2,
  },
  bigSmall: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
  },
  metaRow: {
    fontFamily: 'Geist',
    fontSize: 14,
    marginTop: 8,
  },
  metaBold: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
  },
  chipText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12,
  },
  tlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nowPillText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 11,
  },
  tlWrap: {
    marginTop: 16,
    position: 'relative',
  },
  tlLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  tlLbl: {
    fontFamily: 'Geist',
    fontSize: 11.5,
  },
  focusWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  focusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  focusChipText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12.5,
  },
  twoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCard: {
    flex: 1,
    minWidth: 0,
  },
  metaSub: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 8,
  },
  tasksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  tasksCount: {
    fontFamily: 'Geist_500Medium',
    fontSize: 17,
    lineHeight: 20,
  },
  tasksSub: {
    fontFamily: 'Geist',
    fontSize: 12,
    marginTop: 2,
  },
  btnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  priBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priBtnText: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 14.5,
  },
  secBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secBtnText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
  },
});
