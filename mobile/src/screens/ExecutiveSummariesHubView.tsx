import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons } from "@expo/vector-icons";
import { tokens, MD3Shapes } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import { hapticFeedback } from "../theme/motion";
import { api } from "../services/api";
import { Event, Todo } from "../types";
import {
  calculateWeeklySummaries,
  WeeklySummaryItem,
} from "../utils/weeklySummaryCalculator";
import { isAllDayEvent } from "../utils/calendarDateUtils";
import { DailySummarySection } from "../components/summaries/DailySummarySection";
import { WeeklySummarySection } from "../components/summaries/WeeklySummarySection";
import { MonthlySummarySection } from "../components/summaries/MonthlySummarySection";
import { WeeklyRaioXModal } from "../components/summaries/WeeklyRaioXModal";
import { MonthlyRaioXModal } from "../components/summaries/MonthlyRaioXModal";

interface ExecutiveSummariesHubViewProps {
  onBack: () => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

type SummaryHorizon = "daily" | "weekly" | "monthly";

export const ExecutiveSummariesHubView: React.FC<ExecutiveSummariesHubViewProps> = ({
  onBack,
  onOpenChatWithPrompt,
}) => {
  const { colors, isDark } = useTheme();

  const [horizon, setHorizon] = useState<SummaryHorizon>("daily");
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

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
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
      console.warn("[ExecutiveSummariesHubView] Erro ao carregar dados:", err);
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
    const todayStr = new Date().toISOString().split("T")[0];
    const todayEvents = events.filter((e) => e.start_at.startsWith(todayStr));
    const todayTodos = todos.filter((t) => !t.due_date || t.due_date.startsWith(todayStr));
    const completedTodos = todayTodos.filter((t) => t.status === "completed");

    let totalMinutes = 0;
    todayEvents.forEach((e) => {
      if (isAllDayEvent(e)) return;
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      if (end > s && (end - s) / (1000 * 60 * 60) >= 23) return;
      const cat = (e.category || "").toLowerCase();
      if (cat === "holiday" || cat === "feriado") return;
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

    const completedCount = monthTodos.filter((t) => t.status === "completed").length;
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
      const catCheck = (e.category || "").toLowerCase();
      if (catCheck === "holiday" || catCheck === "feriado") return;
      const dur = end > s ? Math.round((end - s) / (1000 * 60)) : 60;
      totalMonthMinutes += dur;

      const cat = (e.category || "").toLowerCase();
      if (cat.includes("trab") || cat.includes("work") || cat.includes("reuni")) {
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
      return "Sua agenda e lista de tarefas estão totalmente livres hoje. Momento propício para descanso, planejamento estratégico ou adiantar projetos de longo prazo.";
    }
    if (eventsCount === 0) {
      const pendentes = openTodos === 1 ? "1 tarefa pendente" : `${openTodos} tarefas pendentes`;
      return `Dia sem compromissos fixos agendados. Você possui ${pendentes} — oportunidade excelente para blocos de foco contínuo e resolução profunda de prioridades.`;
    }
    if (committed >= 5) {
      return `Dia de alta intensidade executiva com ${committed}h em compromissos. Recomendo proteger os ${free}h livres para intervalos de recuperação cognitiva e manter o foco nas entregas essenciais.`;
    }
    const compromissos = eventsCount === 1 ? "1 compromisso" : `${eventsCount} compromissos`;
    return `Agenda moderada com ${compromissos} (${committed}h). Você conta com ${free}h de blocos livres para avanço substancial nas suas tarefas do dia.`;
  }, [todayMetrics]);

  const monthlyDiagnosisText = useMemo(() => {
    const rate = monthlyMetrics.completionRate;
    const work = monthlyMetrics.workRatio;
    if (rate >= 80 && work <= 65) {
      return "Excelente cadência operacional e equilíbrio preservado. Você mantém alta resolução com espaço saudável para vida pessoal.";
    }
    if (work > 70) {
      return "Foco muito concentrado em trabalho neste ciclo. Recomendo planejar blocos intencionais de recuperação nas próximas semanas.";
    }
    return "Ciclo com demandas ativas. Mantenha o alinhamento semanal com o Vito para priorizar o que realmente move o ponteiro.";
  }, [monthlyMetrics]);

  const monthlyTips = useMemo(() => {
    return [
      {
        category: "Tempo",
        text: "Proteja pelo menos um bloco de foco profundo (90min) sem interrupções por dia.",
      },
      {
        category: "Equilíbrio",
        text: "Mantenha a proporção entre compromissos de trabalho e bem-estar abaixo de 70/30.",
      },
      {
        category: "Execução",
        text: "Feche o dia revisando pendências para iniciar a manhã com clareza imediata.",
      },
    ];
  }, []);

  const handleShareHorizon = () => {
    hapticFeedback.light();
    const now = new Date();
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    let shareText = "";
    if (horizon === "daily") {
      shareText = `📋 *Resumo Executivo Diário — Vito*\n${now.toLocaleDateString("pt-BR")}\n\n• Horas Comprometidas: ${todayMetrics.committedHours}h\n• Blocos Livres: ${todayMetrics.freeHours}h\n• Compromissos: ${todayMetrics.eventsCount}\n• Tarefas Finalizadas: ${todayMetrics.completedTodos}/${todayMetrics.totalTodos}\n\n_${dailySynthesisText}_`;
    } else if (horizon === "weekly") {
      shareText = `📊 *Resumo Executivo Semanal — Vito*\n${weeklySummaries[0]?.period || ""}\n\n• Horas Reais: ${weeklySummaries[0]?.hours || 0}h\n• Compromissos: ${weeklySummaries[0]?.eventsCount || 0}\n• Conclusão: ${((weeklySummaries[0]?.totalTodosCount || 0) > 0 ? Math.round(((weeklySummaries[0]?.completedTodosCount || 0) / (weeklySummaries[0]?.totalTodosCount || 1)) * 100) : 100)}%`;
    } else {
      shareText = `📈 *Resumo Executivo Mensal — Vito*\n${monthNames[now.getMonth()]} de ${now.getFullYear()}\n\n• Total de Horas: ${monthlyMetrics.totalHours}h\n• Taxa de Resolução: ${monthlyMetrics.completionRate}%\n• Trabalho vs Pessoal: ${monthlyMetrics.workRatio}% / ${monthlyMetrics.personalRatio}%`;
    }
    Share.share({ message: shareText });
  };

  const hasFreeWindow = parseFloat(todayMetrics.freeHours) >= 2;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            hapticFeedback.light();
            onBack();
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.topBarTitleContainer}>
          <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>Resumos Executivos</Text>
          <Text style={[styles.topBarSubtitle, { color: colors.onSurfaceVariant }]}>
            {horizon === "daily" ? "Visão Diária" : horizon === "weekly" ? "Ciclos Semanais" : "Visão Mensal"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShareHorizon}
          activeOpacity={0.7}
        >
          <MaterialIcons name="share" size={20} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.horizonSelectorContainer}>
          <View
            style={[
              styles.horizonPill,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            {(["daily", "weekly", "monthly"] as SummaryHorizon[]).map((h) => {
              const isActive = horizon === h;
              const labels: Record<SummaryHorizon, string> = {
                daily: "Diário",
                weekly: "Semanal",
                monthly: "Mensal",
              };
              const icons: Record<SummaryHorizon, "wb-sunny" | "bar-chart" | "calendar-month"> = {
                daily: "wb-sunny",
                weekly: "bar-chart",
                monthly: "calendar-month",
              };

              return (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.horizonTab,
                    isActive && [
                      styles.horizonTabActive,
                      { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
                    ],
                  ]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setHorizon(h);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.horizonTabInner}>
                    <MaterialIcons
                      name={icons[h]}
                      size={14}
                      color={isActive ? (isDark ? colors.onSurface : colors.onPrimary) : colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.horizonLabel,
                        {
                          color: isActive
                            ? isDark
                              ? colors.onSurface
                              : colors.onPrimary
                            : colors.onSurfaceVariant,
                          fontWeight: isActive ? "600" : "500",
                        },
                      ]}
                    >
                      {labels[h]}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : horizon === "daily" ? (
          <DailySummarySection
            metrics={todayMetrics}
            hasFreeWindow={hasFreeWindow}
            synthesisText={dailySynthesisText}
          />
        ) : horizon === "weekly" ? (
          <WeeklySummarySection
            summaries={weeklySummaries}
            onSelectWeek={setSelectedWeekModal}
          />
        ) : (
          <MonthlySummarySection
            metrics={monthlyMetrics}
            diagnosisText={monthlyDiagnosisText}
            onOpenRaioX={() => setShowMonthlyModal(true)}
          />
        )}
      </ScrollView>

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
    paddingTop: 0,
  },
  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: tokens.spacing.xs,
    marginRight: tokens.spacing.sm,
  },
  topBarTitleContainer: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  topBarSubtitle: {
    fontSize: 12,
  },
  shareBtn: {
    padding: tokens.spacing.xs,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: tokens.spacing.md,
    paddingBottom: 120,
  },
  horizonSelectorContainer: {
    marginBottom: tokens.spacing.md,
  },
  horizonPill: {
    flexDirection: "row",
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    padding: 3,
  },
  horizonTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: MD3Shapes.full,
  },
  horizonTabActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  horizonTabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  horizonLabel: {
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
});
