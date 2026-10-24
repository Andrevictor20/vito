import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Share,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { Event, Todo } from '../types';
import {
  calculateWeeklySummaries,
  WeeklySummaryItem,
} from '../utils/weeklySummaryCalculator';
import { isAllDayEvent } from '../utils/calendarDateUtils';
import { DailySummarySection } from '../components/summaries/DailySummarySection';
import { WeeklySummarySection } from '../components/summaries/WeeklySummarySection';
import { MonthlySummarySection } from '../components/summaries/MonthlySummarySection';
import { WeeklyRaioXModal } from '../components/summaries/WeeklyRaioXModal';
import { MonthlyRaioXModal } from '../components/summaries/MonthlyRaioXModal';

interface ExecutiveSummariesHubViewProps {
  onBack: () => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

type SummaryHorizon = 'daily' | 'weekly' | 'monthly';

export const ExecutiveSummariesHubView: React.FC<ExecutiveSummariesHubViewProps> = ({
  onBack,
  onOpenChatWithPrompt,
}) => {
  const { colors, isDark } = useTheme();

  const [horizon, setHorizon] = useState<SummaryHorizon>('daily');
  const [events, setEvents] = useState<Event[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWeekModal, setSelectedWeekModal] = useState<WeeklySummaryItem | null>(null);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);

  useEffect(() => {
    const onBackPress = () => {
      if (selectedWeekModal) {
        setSelectedWeekModal(null);
        return true;
      }
      if (showMonthlyModal) {
        setShowMonthlyModal(false);
        return true;
      }
      onBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [onBack, selectedWeekModal, showMonthlyModal]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [fetchedEvents, fetchedTodos] = await Promise.all([
        api.getEvents(),
        api.getTodos(),
      ]);
      setEvents(fetchedEvents || []);
      setTodos(fetchedTodos || []);
    } catch (err) {
      console.warn('[ExecutiveSummariesHubView] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const weeklySummaries = useMemo(() => {
    return calculateWeeklySummaries(events, todos, 4);
  }, [events, todos]);

  const todayMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter((e) => e.start_at.startsWith(todayStr));
    const todayTodos = todos.filter((t) => !t.due_date || t.due_date.startsWith(todayStr));
    const completedTodos = todayTodos.filter((t) => t.status === 'completed');

    let totalMinutes = 0;
    todayEvents.forEach((e) => {
      if (isAllDayEvent(e)) return;
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      if (end > s && (end - s) / (1000 * 60 * 60) >= 23) return;
      const cat = (e.category || '').toLowerCase();
      if (cat === 'holiday' || cat === 'feriado') return;
      if (end > s) {
        totalMinutes += Math.round((end - s) / (1000 * 60));
      }
    });

    const hours = (totalMinutes / 60).toFixed(1);
    const freeHours = Math.max(0, 12 - Number(hours)).toFixed(1);

    return {
      eventsCount: todayEvents.length,
      committedHours: hours,
      freeHours,
      totalTodos: todayTodos.length,
      completedTodos: completedTodos.length,
    };
  }, [events, todos]);

  const monthlyMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthEvents = events.filter((e) => {
      const d = new Date(e.start_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthTodos = todos.filter((t) => {
      const d = new Date(t.due_date || t.created_at || now);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const completedCount = monthTodos.filter((t) => t.status === 'completed').length;
    const taskCompletionRate =
      monthTodos.length > 0 ? Math.round((completedCount / monthTodos.length) * 100) : 100;

    let totalMonthMinutes = 0;
    let workMinutes = 0;
    let personalMinutes = 0;

    monthEvents.forEach((e) => {
      if (isAllDayEvent(e)) return;
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      if (end > s && (end - s) / (1000 * 60 * 60) >= 23) return;
      const catCheck = (e.category || '').toLowerCase();
      if (catCheck === 'holiday' || catCheck === 'feriado') return;
      const dur = end > s ? Math.round((end - s) / (1000 * 60)) : 60;
      totalMonthMinutes += dur;

      const cat = (e.category || '').toLowerCase();
      if (cat.includes('trab') || cat.includes('work') || cat.includes('reuni')) {
        workMinutes += dur;
      } else {
        personalMinutes += dur;
      }
    });

    const workRatio =
      totalMonthMinutes > 0 ? Math.round((workMinutes / totalMonthMinutes) * 100) : 50;
    const personalRatio = 100 - workRatio;

    return {
      totalHours: (totalMonthMinutes / 60).toFixed(0),
      totalEvents: monthEvents.length,
      totalTodos: monthTodos.length,
      completionRate: taskCompletionRate,
      workRatio,
      personalRatio,
    };
  }, [events, todos]);

  const dailySynthesisText = useMemo(() => {
    const committed = parseFloat(todayMetrics.committedHours) || 0;
    const free = parseFloat(todayMetrics.freeHours) || 0;
    const eventsCount = todayMetrics.eventsCount;
    const totalTodos = todayMetrics.totalTodos;
    const completedTodos = todayMetrics.completedTodos;
    const openTodos = totalTodos - completedTodos;

    if (eventsCount === 0 && totalTodos === 0) {
      return 'Sua agenda e lista de tarefas estão totalmente livres hoje. Momento propício para descanso, planejamento estratégico ou adiantar projetos.';
    }
    if (eventsCount === 0) {
      const pendentes = openTodos === 1 ? '1 tarefa pendente' : `${openTodos} tarefas pendentes`;
      return `Dia sem compromissos fixos agendados. Você possui ${pendentes} — boa hora para avançar nas tarefas.`;
    }
    const compromissos = eventsCount === 1 ? '1 compromisso' : `${eventsCount} compromissos`;
    return `Dia com ${compromissos} (${committed}h) e ${free}h livres. Boa hora para avançar nas ${openTodos} tarefas que faltam.`;
  }, [todayMetrics]);

  const monthlyDiagnosisText = useMemo(() => {
    const rate = monthlyMetrics.completionRate;
    const work = monthlyMetrics.workRatio;
    if (rate >= 80 && work <= 65) {
      return 'Excelente cadência operacional e equilíbrio preservado. Você mantém alta resolução com espaço saudável para vida pessoal.';
    }
    if (work > 70) {
      return 'Foco muito concentrado em trabalho neste ciclo. Recomendo planejar blocos intencionais de recuperação nas próximas semanas.';
    }
    return 'Ciclo com demandas ativas. Mantenha o alinhamento semanal para priorizar o que realmente move o ponteiro.';
  }, [monthlyMetrics]);

  const monthlyTips = useMemo(() => {
    return [
      {
        category: 'Tempo',
        text: 'Proteja pelo menos um bloco de foco profundo (90min) sem interrupções por dia.',
      },
      {
        category: 'Equilíbrio',
        text: 'Mantenha a proporção entre compromissos de trabalho e bem-estar abaixo de 70/30.',
      },
      {
        category: 'Execução',
        text: 'Feche o dia revisando pendências para iniciar a manhã com clareza imediata.',
      },
    ];
  }, []);

  const handleShareHorizon = () => {
    hapticFeedback.light();
    let shareText = '';
    if (horizon === 'daily') {
      shareText = `📋 *Resumo Diário — Vito*\n${todayMetrics.freeHours}h livres · ${todayMetrics.committedHours}h em compromissos\n${todayMetrics.eventsCount} compromissos · ${todayMetrics.completedTodos}/${todayMetrics.totalTodos} tarefas\n\n${dailySynthesisText}`;
    } else if (horizon === 'weekly') {
      shareText = `📊 *Resumo Semanal — Vito*\n${weeklySummaries[0]?.period || ''}\n${weeklySummaries[0]?.hours || 0}h em compromissos · ${weeklySummaries[0]?.eventsCount || 0} eventos`;
    } else {
      shareText = `📈 *Resumo Mensal — Vito*\n${monthlyMetrics.totalHours}h em compromissos · ${monthlyMetrics.completionRate}% de eficácia\nTrabalho ${monthlyMetrics.workRatio}% / Pessoal ${monthlyMetrics.personalRatio}%`;
    }
    Share.share({ message: shareText });
  };

  const hasFreeWindow = parseFloat(todayMetrics.freeHours) >= 2;

  const horizonSubtitles: Record<SummaryHorizon, string> = {
    daily: 'Visão diária',
    weekly: 'Ciclos semanais',
    monthly: 'Visão mensal',
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Barra Superior .sbar fiel a vito-telas.html */}
      <View style={[styles.sbar, { backgroundColor: colors.bg }]}>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={() => {
            hapticFeedback.light();
            onBack();
          }}
          activeOpacity={0.7}
          accessibilityLabel="Voltar"
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.ttl}>
          <Text style={[styles.h1, { color: colors.ink }]}>Resumos</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {horizonSubtitles[horizon]}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={handleShareHorizon}
          activeOpacity={0.7}
          accessibilityLabel="Compartilhar resumo"
        >
          <MaterialIcons name="share" size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Segmented Control .seg ("Diário", "Semanal", "Mensal") */}
      <View style={styles.segWrapper}>
        <View style={[styles.seg, { backgroundColor: colors.surf }]}>
          {(['daily', 'weekly', 'monthly'] as SummaryHorizon[]).map((h) => {
            const isActive = horizon === h;
            const labels: Record<SummaryHorizon, string> = {
              daily: 'Diário',
              weekly: 'Semanal',
              monthly: 'Mensal',
            };

            return (
              <TouchableOpacity
                key={h}
                style={[
                  styles.segBtn,
                  isActive && [styles.segBtnActive, { backgroundColor: colors.ink }],
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setHorizon(h);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segBtnText,
                    { color: isActive ? colors.bg : colors.muted },
                    isActive && styles.segBtnTextActive,
                  ]}
                >
                  {labels[h]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.ink}
            colors={[colors.ink]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.ink} />
          </View>
        ) : horizon === 'daily' ? (
          <DailySummarySection
            metrics={todayMetrics}
            hasFreeWindow={hasFreeWindow}
            synthesisText={dailySynthesisText}
            onReserveFocus={() => onOpenChatWithPrompt?.('Reserve um bloco de foco de 2h para mim hoje')}
            onViewTasks={() => onOpenChatWithPrompt?.('Quais são as minhas prioridades de hoje?')}
          />
        ) : horizon === 'weekly' ? (
          <WeeklySummarySection
            summaries={weeklySummaries}
            onSelectWeek={setSelectedWeekModal}
          />
        ) : (
          <MonthlySummarySection
            metrics={monthlyMetrics}
            diagnosisText={monthlyDiagnosisText}
            onOpenRaioX={() => setShowMonthlyModal(true)}
            onAlignWeek={() => onOpenChatWithPrompt?.('Vamos fazer o alinhamento semanal?')}
          />
        )}
      </ScrollView>

      {/* Modais de Raio-X */}
      <WeeklyRaioXModal
        visible={selectedWeekModal !== null}
        selectedWeek={selectedWeekModal}
        onClose={() => setSelectedWeekModal(null)}
        allEvents={events}
        onOpenChatWithPrompt={onOpenChatWithPrompt}
      />

      <MonthlyRaioXModal
        visible={showMonthlyModal}
        onClose={() => setShowMonthlyModal(false)}
        monthlyMetrics={monthlyMetrics}
        monthlyTips={monthlyTips}
        subtitle={`${monthlyMetrics.totalHours}h reais no mês`}
        onOpenChatWithPrompt={onOpenChatWithPrompt}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  sbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
  },
  rb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttl: {
    flex: 1,
  },
  h1: {
    fontSize: 26,
    fontFamily: tokens.typography.family.montserratBold,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 13,
    marginTop: 1,
  },
  segWrapper: {
    paddingHorizontal: tokens.spacing.md,
    marginBottom: 4,
  },
  seg: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: {
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  segBtnText: {
    fontSize: 13.5,
    fontWeight: '500',
    fontFamily: tokens.typography.family.medium,
  },
  segBtnTextActive: {
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: tokens.spacing.md,
    paddingBottom: 120,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
});
