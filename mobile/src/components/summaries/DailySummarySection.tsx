import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { VitoMascot } from '../common/VitoMascot';
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
  const { colors } = useTheme();

  // Data formatada para o cabeçalho (fallback local seguro)
  const defaultTodayFormatted = React.useMemo(() => {
    const now = new Date();
    const weekdays = [
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
    ];
    const months = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ];
    return `Hoje · ${weekdays[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;
  }, []);

  const headerDate = todayFormatted || defaultTodayFormatted;
  const committedNum = parseFloat(metrics.committedHours) || 0;
  const freeNum = parseFloat(metrics.freeHours) || 0;
  const taskProgress = metrics.totalTodos > 0 ? (metrics.completedTodos / metrics.totalTodos) * 100 : 0;

  // Segmentos reais da timeline
  const effectiveTimeline = React.useMemo<TimelineSegment[]>(() => {
    if (timelineSegments && timelineSegments.length > 0) {
      return timelineSegments;
    }
    if (committedNum === 0) {
      return [{ flex: 12, type: 'free' }];
    }
    if (freeNum === 0) {
      return [{ flex: Math.max(1, committedNum), type: 'committed' }];
    }
    return [
      { flex: Math.max(0.5, freeNum / 2), type: 'free' },
      { flex: Math.max(0.5, committedNum), type: 'committed' },
      { flex: Math.max(0.5, freeNum / 2), type: 'free' },
    ];
  }, [timelineSegments, committedNum, freeNum]);

  // Blocos de foco reais
  const effectiveFocusBlocks = React.useMemo<FocusBlock[]>(() => {
    if (focusBlocks !== undefined) {
      return focusBlocks;
    }
    if (freeNum >= 1) {
      return [
        {
          label: `Foco disponível · ${freeNum}h livres`,
          duration: `${freeNum}h`,
          startMinutes: 480,
          endMinutes: 1200,
        },
      ];
    }
    return [];
  }, [focusBlocks, freeNum]);

  return (
    <View style={styles.container}>
      {/* Card 1 (.card2): Métricas Principais + Timeline Real */}
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <View style={styles.eyebrowRow}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>
            {headerDate}
          </Text>
        </View>

        {/* Duas Colunas (.two): horas livres vs horas comprometidas */}
        <View style={styles.two}>
          <View>
            <Text style={[styles.big, { color: colors.acc }]}>
              {metrics.freeHours}
              <Text style={[styles.bigSmall, { color: colors.muted }]}>h livres</Text>
            </Text>
          </View>
          <View>
            <Text style={[styles.big, { color: colors.ink }]}>
              {metrics.committedHours}
              <Text style={[styles.bigSmall, { color: colors.muted }]}>h comprometida</Text>
            </Text>
          </View>
        </View>

        {/* Timeline Horizontal Dinâmica (.tl) */}
        <View style={[styles.tl, { backgroundColor: colors.surf }]}>
          {effectiveTimeline.map((seg, idx) => (
            <View
              key={idx}
              style={[
                styles.tlSegment,
                {
                  flex: Math.max(0.1, seg.flex),
                  backgroundColor: seg.type === 'free' ? colors.greenBg : colors.blue,
                },
              ]}
            />
          ))}
        </View>

        {/* Marcadores da Timeline (.tlb) */}
        <View style={styles.tlb}>
          <Text style={[styles.tlbText, { color: colors.muted }]}>08:00</Text>
          <Text style={[styles.tlbText, { color: colors.muted }]}>14:00</Text>
          <Text style={[styles.tlbText, { color: colors.muted }]}>20:00</Text>
        </View>

        {/* Pílulas de Blocos de Foco Reais (.wins) */}
        <View style={styles.wins}>
          {effectiveFocusBlocks.length > 0 ? (
            effectiveFocusBlocks.map((block, idx) => (
              <View key={idx} style={[styles.winPill, { backgroundColor: colors.greenBg }]}>
                <Text style={[styles.winText, { color: colors.acc }]}>
                  {block.label}
                </Text>
              </View>
            ))
          ) : (
            <View
              style={[
                styles.winPillEmpty,
                { backgroundColor: colors.surf, borderColor: colors.line },
              ]}
            >
              <Text style={[styles.winTextEmpty, { color: colors.muted }]}>
                Nenhum bloco livre disponível hoje
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Duas Colunas (.two): Card Agenda + Card Tarefas */}
      <View style={styles.twoCards}>
        {/* Card Agenda */}
        <View style={[styles.card2, styles.halfCard, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <View style={styles.eyebrowRow}>
            <MaterialIcons name="calendar-month" size={14} color={colors.blue} />
            <Text style={[styles.eyebrow, { color: colors.blue }]}>Agenda</Text>
          </View>
          <Text style={[styles.big, { color: colors.ink, marginTop: 10 }]}>
            {metrics.eventsCount}
            <Text style={[styles.bigSmall, { color: colors.muted }]}>
              {metrics.eventsCount === 1 ? ' compromisso' : ' compromissos'}
            </Text>
          </Text>
          <Text style={[styles.metaText, { color: colors.muted }]} numberOfLines={1}>
            {nextEventTitle || (metrics.eventsCount > 0 ? 'Compromissos agendados' : 'Sem compromissos no momento')}
          </Text>
        </View>

        {/* Card Tarefas */}
        <View style={[styles.card2, styles.halfCard, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <View style={styles.eyebrowRow}>
            <MaterialIcons name="check-circle" size={14} color={colors.purple} />
            <Text style={[styles.eyebrow, { color: colors.purple }]}>Tarefas</Text>
          </View>
          <Text style={[styles.big, { color: colors.ink, marginTop: 10 }]}>
            {metrics.completedTodos}/{metrics.totalTodos}
            <Text style={[styles.bigSmall, { color: colors.muted }]}> feitas</Text>
          </Text>
          {/* Barra de Progresso (.trk) */}
          <View style={[styles.trk, { backgroundColor: colors.line }]}>
            <View style={[styles.trkFill, { width: `${Math.min(100, taskProgress)}%`, backgroundColor: colors.purple }]} />
          </View>
        </View>
      </View>

      {/* Card Mensagem do Vito (.vsug) */}
      <View style={[styles.vsug, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        <View style={styles.vsugMascot}>
          <VitoMascot size={32} state="idle" />
        </View>
        <View style={styles.vsugBody}>
          <Text style={[styles.vsugEyebrow, { color: colors.muted }]}>VITO</Text>
          <Text style={[styles.vsugText, { color: colors.ink }]}>
            {synthesisText ||
              (metrics.eventsCount === 0 && metrics.totalTodos === 0
                ? 'Sua agenda e lista de tarefas estão totalmente livres hoje. Momento propício para descanso, planejamento estratégico ou adiantar projetos.'
                : `Dia com ${metrics.eventsCount} compromisso(s) e ${metrics.freeHours}h livres.`)}
          </Text>
          <View style={styles.vsugButtons}>
            {onReserveFocus && hasFreeWindow && (
              <TouchableOpacity
                style={[styles.vsugBtnPrimary, { backgroundColor: colors.ink }]}
                onPress={onReserveFocus}
                activeOpacity={0.8}
              >
                <Text style={[styles.vsugBtnPrimaryText, { color: colors.bg }]}>
                  Reservar foco
                </Text>
              </TouchableOpacity>
            )}
            {onViewTasks && (
              <TouchableOpacity
                style={[styles.vsugBtnSecondary, { borderColor: colors.ink }]}
                onPress={onViewTasks}
                activeOpacity={0.8}
              >
                <Text style={[styles.vsugBtnSecondaryText, { color: colors.ink }]}>
                  Ver tarefas
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card2: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  two: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 14,
  },
  big: {
    fontSize: 34,
    fontFamily: tokens.typography.family.montserratBold,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  bigSmall: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    fontFamily: tokens.typography.family.medium,
  },
  tl: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    gap: 2,
    marginTop: 16,
  },
  tlSegment: {
    height: '100%',
  },
  tlb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tlbText: {
    fontSize: 11.5,
  },
  wins: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  winPill: {
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  winText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  winPillEmpty: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  winTextEmpty: {
    fontSize: 12.5,
    fontFamily: tokens.typography.family.medium,
  },
  twoCards: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCard: {
    flex: 1,
  },
  metaText: {
    fontSize: 12.5,
    marginTop: 8,
  },
  trk: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
  },
  trkFill: {
    height: '100%',
    borderRadius: 4,
  },
  vsug: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 2,
  },
  vsugMascot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsugBody: {
    flex: 1,
  },
  vsugEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  vsugText: {
    fontSize: 14,
    lineHeight: 20,
  },
  vsugButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  vsugBtnPrimary: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsugBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  vsugBtnSecondary: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsugBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
