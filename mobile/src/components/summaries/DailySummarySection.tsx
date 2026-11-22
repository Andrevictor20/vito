import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { VitoMascot } from '../common/VitoMascot';
import { SummaryRingSvg } from './SummaryRingSvg';
import type { FocusBlock, TimelineSegment } from '../../utils/summaryCalculators';

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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!alive || reduced) return;
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 0.35, duration: 900, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          ])
        ).start();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pulseAnim]);

  const committedNum = parseFloat(metrics.committedHours) || 0;
  const freeNum = parseFloat(metrics.freeHours) || 0;
  const freePct = Math.min(100, Math.round((freeNum / 12) * 100));
  const taskPct = metrics.totalTodos > 0 ? Math.round((metrics.completedTodos / metrics.totalTodos) * 100) : 0;

  const nowPct = useMemo(() => {
    const now = new Date();
    const min = now.getHours() * 60 + now.getMinutes();
    const clamped = Math.max(480, Math.min(1200, min));
    return Math.round(((clamped - 480) / (1200 - 480)) * 100);
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
      return [{ label: `Foco disponível · ${freeNum}h livres`, duration: `${freeNum}h`, startMinutes: 480, endMinutes: 1200 }];
    }
    return [];
  }, [focusBlocks, freeNum]);

  const headerDate = todayFormatted || 'Hoje';

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
          <Text style={[styles.eb, { color: colors.muted }]}>{headerDate}</Text>
        </View>

        <View style={styles.heroRow}>
          <SummaryRingSvg percent={freePct} color={colors.acc} size={104} label="livre" />
          <View style={styles.heroRight}>
            <Text style={[styles.big, { color: colors.ink }]}>
              {metrics.freeHours}
              <Text style={[styles.bigSmall, { color: colors.muted }]}>h livres</Text>
            </Text>
            <Text style={[styles.committedLine, { color: colors.muted }]}>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{metrics.committedHours}h</Text> comprometida
            </Text>
            <View style={[styles.statusChip, { backgroundColor: colors.greenBg }]}>
              <Text style={[styles.statusChipText, { color: colors.acc }]}>
                {committedNum <= 3 ? 'Dia leve' : committedNum <= 6 ? 'Dia equilibrado' : 'Dia intenso'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Linha do dia .rs-tl com indicador "Agora" vermelho pulsante */}
      <View style={[styles.card, { backgroundColor: colors.surf }]}>
        <Text style={[styles.eb, { color: colors.muted }]}>Linha do dia</Text>
        <View style={styles.tlOuter}>
          <View style={styles.tlTrack}>
            {effectiveTimeline.map((seg, idx) => (
              <View
                key={idx}
                style={[
                  styles.tlSeg,
                  {
                    flex: Math.max(0.2, seg.flex),
                    backgroundColor: seg.type === 'free' ? colors.greenBg : colors.blue,
                  },
                ]}
              />
            ))}
          </View>
          <Animated.View
            style={[
              styles.nowLine,
              {
                left: `${nowPct}%`,
                backgroundColor: colors.red,
                opacity: pulseAnim,
              },
            ]}
          />
        </View>
        <View style={styles.tlLabels}>
          <Text style={[styles.tlLabel, { color: colors.muted }]}>08:00</Text>
          <Text style={[styles.tlLabel, { color: colors.red, fontWeight: '600' }]}>Agora</Text>
          <Text style={[styles.tlLabel, { color: colors.muted }]}>20:00</Text>
        </View>
        {effectiveFocusBlocks.length > 0 && (
          <View style={styles.winsRow}>
            {effectiveFocusBlocks.map((b, i) => (
              <View key={i} style={[styles.winPill, { backgroundColor: colors.bg }]}>
                <Text style={[styles.winText, { color: colors.ink }]}>{b.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Grid 2 colunas .rs-two */}
      <View style={styles.twoRow}>
        <View style={[styles.card, styles.halfCard, { backgroundColor: colors.surf }]}>
          <View style={styles.ebRow}>
            <MaterialIcons name="calendar-month" size={14} color={colors.blue} />
            <Text style={[styles.eb, { color: colors.blue }]}>Agenda</Text>
          </View>
          <Text style={[styles.statBig, { color: colors.ink }]}>
            {metrics.eventsCount}
            <Text style={[styles.statUnit, { color: colors.muted }]}>
              {metrics.eventsCount === 1 ? ' compromisso' : ' compromissos'}
            </Text>
          </Text>
          <Text style={[styles.metaSub, { color: colors.muted }]} numberOfLines={1}>
            {nextEventTitle || 'Sem compromissos'}
          </Text>
        </View>

        <View style={[styles.card, styles.halfCard, { backgroundColor: colors.surf }]}>
          <View style={styles.ebRow}>
            <MaterialIcons name="check-circle" size={14} color={colors.purple} />
            <Text style={[styles.eb, { color: colors.purple }]}>Tarefas</Text>
          </View>
          <View style={styles.taskRingRow}>
            <SummaryRingSvg percent={taskPct} color={colors.purple} size={62} />
            <View>
              <Text style={[styles.taskFrac, { color: colors.ink }]}>
                {metrics.completedTodos}/{metrics.totalTodos}
              </Text>
              <Text style={[styles.metaSub, { color: colors.muted }]}>feitas</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Diagnóstico .rs-vt */}
      <View style={[styles.vtCard, { backgroundColor: colors.surf }]}>
        <View style={[styles.vtMascot, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <VitoMascot size={26} state="idle" />
        </View>
        <Text style={[styles.vtText, { color: colors.ink }]}>{synthesisText}</Text>
      </View>

      <View style={styles.btnsRow}>
        {onReserveFocus && hasFreeWindow && (
          <TouchableOpacity style={[styles.priBtn, { backgroundColor: colors.ink }]} onPress={onReserveFocus}>
            <Text style={[styles.priBtnText, { color: colors.bg }]}>Reservar foco</Text>
          </TouchableOpacity>
        )}
        {onViewTasks && (
          <TouchableOpacity style={[styles.secBtn, { backgroundColor: colors.surf }]} onPress={onViewTasks}>
            <Text style={[styles.secBtnText, { color: colors.ink }]}>Ver tarefas</Text>
          </TouchableOpacity>
        )}
      </View>
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
  committedLine: { fontSize: 13.5, marginTop: 6, fontVariant: ['tabular-nums'] },
  statusChip: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, marginTop: 10 },
  statusChipText: { fontSize: 12, fontWeight: '600' },
  tlOuter: { position: 'relative', marginTop: 16, height: 22, justifyContent: 'center' },
  tlTrack: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', gap: 3 },
  tlSeg: { borderRadius: 6 },
  nowLine: { position: 'absolute', top: -1, width: 3, height: 24, borderRadius: 2 },
  tlLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  tlLabel: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
  winsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  winPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  winText: { fontSize: 12.5, fontWeight: '500' },
  twoRow: { flexDirection: 'row', gap: 12 },
  halfCard: { flex: 1 },
  statBig: { fontSize: 30, fontWeight: '600', marginTop: 12, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 13, fontWeight: '500' },
  metaSub: { fontSize: 12, marginTop: 6 },
  taskRingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  taskFrac: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  vtCard: { borderRadius: 22, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  vtMascot: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  vtText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: tokens.typography.family.regular },
  btnsRow: { flexDirection: 'row', gap: 10 },
  priBtn: { flex: 1, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  priBtnText: { fontSize: 14, fontWeight: '600' },
  secBtn: { flex: 1, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  secBtnText: { fontSize: 14, fontWeight: '600' },
});
