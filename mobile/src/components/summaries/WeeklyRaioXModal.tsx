import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { tokens, MD3Shapes, tabularNumbers } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { BottomSheetModal } from "../ui/BottomSheetModal";
import { WeeklySummaryItem } from "../../utils/weeklySummaryCalculator";
import { Event } from "../../types";

interface WeeklyRaioXModalProps {
  visible: boolean;
  selectedWeek: WeeklySummaryItem | null;
  onClose: () => void;
  allEvents: Event[];
  onOpenChatWithPrompt?: (prompt: string) => void;
}

function isHolidayLikeEvent(e: Event): boolean {
  const cat = (e.category || "").toLowerCase();
  if (cat === "holiday" || cat === "feriado") return true;
  try {
    const s = new Date(e.start_at).getTime();
    const end = new Date(e.end_at).getTime();
    if (end > s && (end - s) / (1000 * 60 * 60) >= 23) return true;
  } catch {}
  return false;
}

function getHolidayDayIndices(week: WeeklySummaryItem, allEvents: Event[]): Set<number> {
  const set = new Set<number>();
  allEvents.forEach((e) => {
    if (!isHolidayLikeEvent(e)) return;
    try {
      const d = new Date(e.start_at);
      if (d >= week.weekStart && d <= week.weekEnd) {
        const jsDay = d.getDay();
        set.add(jsDay === 0 ? 6 : jsDay - 1);
      }
    } catch {}
  });
  return set;
}

export const WeeklyRaioXModal: React.FC<WeeklyRaioXModalProps> = ({
  visible,
  selectedWeek,
  onClose,
  allEvents,
  onOpenChatWithPrompt,
}) => {
  const { colors } = useTheme();
  if (!selectedWeek) return null;

  const holidayDays = getHolidayDayIndices(selectedWeek, allEvents);
  const hasHoliday = holidayDays.size > 0;
  const s = selectedWeek.weekStart.getDate();
  const e = selectedWeek.weekEnd.getDate();
  const hoursLabel = String(selectedWeek.hours).replace(".", ",");
  const subtitle = `${s} a ${e} · ${hoursLabel}h reais${hasHoliday ? " (Feriado isolado)" : ""}`;

  const openWeekInChat = () => {
    onClose();
    if (onOpenChatWithPrompt) {
      onOpenChatWithPrompt(
        `Analise meu desempenho executivo na semana ${selectedWeek.period}: foram ${selectedWeek.hours}h em compromissos e ${selectedWeek.completedTodosCount} tarefas concluídas. O que posso otimizar?`
      );
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={`Raio-X · ${selectedWeek.period}`}
      subtitle={subtitle}
    >
      <ScrollView
        style={styles.modalScroll}
        contentContainerStyle={styles.modalScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.truthBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
          <MaterialIcons name="verified" size={13} color={colors.primary} />
          <Text style={[styles.truthBadgeText, { color: colors.primary }]}>
            SEM DISTORÇÃO 24H · FERIADOS = 0H
          </Text>
        </View>

        <View
          style={[
            styles.modalNarrativeBox,
            {
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.synthesisHeaderBadge}>
            <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
            <Text style={[styles.bentoTag, { color: colors.primary }]}>
              DIAGNÓSTICO DA SEMANA
            </Text>
          </View>
          <Text style={[styles.modalNarrativeText, { color: colors.onSurface }]}>
            {selectedWeek.narrative}
          </Text>
        </View>

        <Text style={[styles.modalSectionHeading, { color: colors.onSurface }]}>
          Carga diária (horas reais de agenda)
        </Text>
        <View style={styles.dailyBarsRow}>
          {selectedWeek.dailyActivity.map((day, idx) => {
            const isHoli = holidayDays.has(idx);
            const maxH = Math.max(1, ...selectedWeek.dailyActivity.map((d) => d.hours));
            const fillPct = Math.min(100, Math.round((day.hours / maxH) * 100));

            return (
              <View key={day.dateStr} style={styles.dailyBarCol}>
                <Text style={[styles.dailyBarValue, tabularNumbers, { color: colors.onSurface }]}>
                  {day.hours > 0 ? `${day.hours}h` : "—"}
                </Text>
                <View style={[styles.dailyBarTrack, { backgroundColor: colors.surfaceContainerHighest }]}>
                  {day.hours > 0 ? (
                    <View
                      style={[
                        styles.dailyBarFill,
                        {
                          height: `${Math.max(10, fillPct)}%`,
                          backgroundColor: day.isPeak ? colors.primary : colors.textMuted,
                        },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.dailyBarDay,
                    { color: day.isToday ? colors.primary : colors.textMuted },
                    day.isToday && styles.dailyBarDayToday,
                  ]}
                >
                  {day.dayShort}
                </Text>
                {isHoli ? (
                  <View style={[styles.holidayBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
                    <Text style={[styles.holidayBadgeText, { color: colors.primary }]}>Feriado</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {selectedWeek.categories.length > 0 && (
          <>
            <Text style={[styles.modalSectionHeading, { color: colors.onSurface, marginTop: 16 }]}>
              Distribuição por categoria
            </Text>
            <View style={styles.categoriesList}>
              {selectedWeek.categories.map((cat) => (
                <View key={cat.name} style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.categoryName, { color: colors.onSurface }]}>
                      {cat.name}
                    </Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={[styles.categoryHours, tabularNumbers, { color: colors.onSurface }]}>
                      {cat.hours}h
                    </Text>
                    <Text style={[styles.categoryPct, tabularNumbers, { color: colors.textMuted }]}>
                      {cat.percentage}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {selectedWeek.tips.length > 0 && (
          <>
            <Text style={[styles.modalSectionHeading, { color: colors.onSurface, marginTop: 16 }]}>
              Recomendações do Vito
            </Text>
            <View style={styles.tipsList}>
              {selectedWeek.tips.map((tip, i) => (
                <View
                  key={tip.category}
                  style={[
                    styles.tipCard,
                    {
                      backgroundColor: colors.surfaceContainer,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <Text style={[styles.tipNumber, tabularNumbers, { color: colors.primary }]}>
                    {String(i + 1).padStart(2, "0")}
                  </Text>
                  <View style={styles.tipBody}>
                    <Text style={[styles.tipTitle, { color: colors.onSurface }]}>
                      {tip.category}
                    </Text>
                    <Text
                      style={[styles.tipText, { color: colors.onSurfaceVariant }]}
                      numberOfLines={2}
                    >
                      {tip.text}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.modalChatButton, { backgroundColor: colors.primary }]}
          onPress={openWeekInChat}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Discutir no chat"
        >
          <MaterialIcons name="chat" size={18} color={colors.onPrimary} />
          <Text style={[styles.modalChatButtonText, { color: colors.onPrimary }]}>
            Discutir no chat
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalScroll: {
    marginTop: 2,
  },
  modalScrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  truthBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
    marginBottom: 8,
  },
  truthBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  modalNarrativeBox: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    gap: 8,
  },
  synthesisHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bentoTag: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  modalNarrativeText: {
    fontSize: 14,
    lineHeight: 21,
  },
  modalSectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  dailyBarsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 10,
    height: 140,
  },
  dailyBarCol: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  dailyBarValue: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  dailyBarTrack: {
    width: 14,
    height: 80,
    borderRadius: 7,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  dailyBarFill: {
    width: "100%",
    borderRadius: 7,
  },
  dailyBarDay: {
    fontSize: 11,
    marginTop: 4,
  },
  dailyBarDayToday: {
    fontWeight: "700",
  },
  holidayBadge: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  holidayBadgeText: {
    fontSize: 8,
    fontWeight: "700",
  },
  categoriesList: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  categoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 13,
  },
  categoryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryHours: {
    fontSize: 13,
    fontWeight: "600",
  },
  categoryPct: {
    fontSize: 12,
  },
  tipsList: {
    gap: 8,
  },
  tipCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  tipNumber: {
    fontSize: 16,
    fontWeight: "700",
  },
  tipBody: {
    flex: 1,
    gap: 2,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  tipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalChatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: MD3Shapes.large,
    marginTop: 16,
  },
  modalChatButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
