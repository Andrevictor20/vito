import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { VitoMascot } from '../common/VitoMascot';

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
}

export const DailySummarySection: React.FC<DailySummarySectionProps> = ({
  metrics,
  hasFreeWindow,
  synthesisText,
  onReserveFocus,
  onViewTasks,
  nextEventTitle,
}) => {
  const { colors } = useTheme();

  // Data formatada para o cabeçalho
  const todayFormatted = React.useMemo(() => {
    const now = new Date();
    const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `Hoje · ${weekdays[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;
  }, []);

  const committedNum = parseFloat(metrics.committedHours) || 0;
  const freeNum = parseFloat(metrics.freeHours) || 11;
  const taskProgress = metrics.totalTodos > 0 ? (metrics.completedTodos / metrics.totalTodos) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Card 1 (.card2): Métricas Principais + Timeline */}
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <View style={styles.eyebrowRow}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>
            {todayFormatted}
          </Text>
        </View>

        {/* Duas Colunas (.two): 11h livres vs 1h comprometida */}
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

        {/* Timeline Horizontal (.tl) */}
        <View style={[styles.tl, { backgroundColor: colors.surf }]}>
          <View style={[styles.tlSegment, { flex: Math.max(1, freeNum * 0.4), backgroundColor: colors.greenBg }]} />
          <View style={[styles.tlSegment, { flex: Math.max(0.5, committedNum), backgroundColor: colors.blue }]} />
          <View style={[styles.tlSegment, { flex: Math.max(1, freeNum * 0.6), backgroundColor: colors.greenBg }]} />
        </View>

        {/* Marcadores da Timeline (.tlb) */}
        <View style={styles.tlb}>
          <Text style={[styles.tlbText, { color: colors.muted }]}>08:00</Text>
          <Text style={[styles.tlbText, { color: colors.muted }]}>12–13h</Text>
          <Text style={[styles.tlbText, { color: colors.muted }]}>20:00</Text>
        </View>

        {/* Pílulas de Blocos de Foco (.wins) */}
        <View style={styles.wins}>
          <View style={[styles.winPill, { backgroundColor: colors.greenBg }]}>
            <Text style={[styles.winText, { color: colors.acc }]}>
              Foco 08:00–12:00 · 4h
            </Text>
          </View>
          <View style={[styles.winPill, { backgroundColor: colors.greenBg }]}>
            <Text style={[styles.winText, { color: colors.acc }]}>
              Foco 13:00–20:00 · 7h
            </Text>
          </View>
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
            {nextEventTitle || (metrics.eventsCount > 0 ? 'Almoço · 12:00' : 'Agenda livre hoje')}
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
            {synthesisText || 'Dia leve: 1 compromisso (1h) e 11h livres. Boa hora para avançar nas tarefas que faltam.'}
          </Text>
          <View style={styles.vsugButtons}>
            {onReserveFocus && (
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
