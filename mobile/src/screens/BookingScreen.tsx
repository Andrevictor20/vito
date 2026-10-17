import React, { useState, useEffect, useCallback, useMemo } from "react";
import { dataSync } from "../services/dataSync";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
  AppState,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { MD3Shapes, tabularNumbers } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { hapticFeedback } from "../theme/motion";
import { api } from "../services/api";
import { BookingType, BookingAppointment, CreateBookingTypeInput, Meeting } from "../types";
import { BookingCard } from "../components/booking/BookingCard";
import { BookingAppointmentCard } from "../components/booking/BookingAppointmentCard";
import { MeetingCard } from "../components/booking/MeetingCard";
import { MeetingPollDetailView } from "../components/booking/MeetingPollDetailView";
import { BookingTypeModal } from "../components/booking/BookingTypeModal";
import {
  computeBookingTabCounts,
  extractGroupedMeetingPolls,
} from "../utils/meetingPollUtils";

let ClipboardModule: any = null;
try {
  ClipboardModule = require("expo-clipboard");
} catch (e) {
  ClipboardModule = null;
}

let NotificationsModule: any = null;
try {
  NotificationsModule = require("expo-notifications");
} catch (e) {
  NotificationsModule = null;
}

const extractBookingUsername = (types: BookingType[]): string => {
  for (const t of types || []) {
    const m = (t.public_url || "").match(/\/book\/([^/]+)\//);
    if (m) return m[1];
  }
  return "seu-usuario";
};

interface BookingScreenProps {
  onBack?: () => void;
  createRequestId?: number;
  onSubViewChange?: (inSubView: boolean) => void;
}

export const BookingScreen: React.FC<BookingScreenProps> = ({ createRequestId, onSubViewChange }) => {
  const { colors, isDark } = useTheme();
  const { user: authUser } = useAuth();
  const firstCreateRender = React.useRef(true);

  useEffect(() => {
    if (firstCreateRender.current) {
      firstCreateRender.current = false;
      return;
    }
    if ((createRequestId ?? 0) > 0) {
      setEditingType(null);
      setEditingMeeting(null);
      setCreateModalVisible(true);
    }
  }, [createRequestId]);

  const [types, setTypes] = useState<BookingType[]>([]);
  const [appointments, setAppointments] = useState<BookingAppointment[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"links" | "appointments">("links");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<BookingType | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<string | null>(null);
  const [confirmingSlotId, setConfirmingSlotId] = useState<string | null>(null);
  const [selectedMeetingForDetail, setSelectedMeetingForDetail] = useState<Meeting | null>(null);

  useEffect(() => {
    onSubViewChange?.(Boolean(selectedMeetingForDetail));
  }, [selectedMeetingForDetail, onSubViewChange]);

  const bookingUsername = useMemo(() => {
    const fromTypes = extractBookingUsername(types);
    if (fromTypes !== "seu-usuario") return fromTypes;
    if (authUser?.name) {
      const fromName = authUser.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (fromName) return fromName;
    }
    return "usuario";
  }, [types, authUser]);

  const loadData = useCallback(async () => {
    try {
      const [fetchedTypes, fetchedAppts, fetchedMeetings] = await Promise.all([
        api.getBookingTypes(),
        api.getBookingAppointments(),
        api.getMeetings(),
      ]);
      setTypes(fetchedTypes || []);
      setAppointments(fetchedAppts || []);
      setMeetings(fetchedMeetings || []);
      setSelectedMeetingForDetail((prev) => {
        if (!prev) return null;
        return (fetchedMeetings || []).find((m) => m.id === prev.id) || prev;
      });
    } catch (err) {
      console.error("[BookingScreen] erro ao carregar dados:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const unsubscribe = dataSync.subscribe("refresh_bookings", () => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  useEffect(() => {
    let notifSub: any = null;
    if (NotificationsModule?.addNotificationReceivedListener) {
      notifSub = NotificationsModule.addNotificationReceivedListener((notification: any) => {
        const dataType = notification?.request?.content?.data?.type;
        if (
          dataType === "meeting_vote" ||
          dataType === "meeting_confirmed" ||
          dataType === "booking_appointment"
        ) {
          loadData();
        }
      });
    }

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadData();
      }
    });

    return () => {
      if (notifSub?.remove) notifSub.remove();
      appStateSub.remove();
    };
  }, [loadData]);

  // Atualização em tempo real (placar de votação ao vivo enquanto a tela está ativa)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (AppState.currentState === "active") {
        loadData();
      }
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [loadData]);

  const tabCounts = useMemo(
    () => computeBookingTabCounts((types || []).length, meetings || [], (appointments || []).length),
    [types, meetings, appointments]
  );

  const groupedPolls = useMemo(
    () => extractGroupedMeetingPolls(meetings || []),
    [meetings]
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCopyLink = async (bt: BookingType) => {
    const url = bt.short_url || bt.public_url || `https://vito.rasppi.cloud/book/${bookingUsername}/${bt.slug}`;
    hapticFeedback.medium();
    if (ClipboardModule?.setStringAsync) {
      await ClipboardModule.setStringAsync(url);
    }
    setCopiedSlug(bt.slug);
    setTimeout(() => setCopiedSlug(null), 3000);
  };

  const handleToggleActive = async (bt: BookingType) => {
    hapticFeedback.light();
    try {
      const updated = await api.updateBookingType(bt.id, { is_active: !bt.is_active });
      setTypes((prev) =>
        (prev || []).map((item) => (item.id === bt.id ? { ...item, is_active: updated.is_active } : item))
      );
    } catch (err) {
      console.error("[BookingScreen] erro ao alternar status:", err);
    }
  };

  const handleDeleteType = (id: string) => {
    Alert.alert(
      "Excluir Link de Agendamento",
      "Ao excluir, compromissos futuros vinculados a este link também serão removidos. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            hapticFeedback.medium();
            try {
              await api.deleteBookingType(id);
              setTypes((prev) => (prev || []).filter((item) => item.id !== id));
              setAppointments((prev) => (prev || []).filter((a) => a.booking_type_id !== id));
            } catch (err) {
              console.error("[BookingScreen] erro ao excluir tipo:", err);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAppointment = (appt: BookingAppointment) => {
    Alert.alert(
      "Cancelar Agendamento",
      `Deseja cancelar o compromisso de ${appt.guest_name}? O horário voltará a ficar livre para agendamentos.`,
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Cancelar Compromisso",
          style: "destructive",
          onPress: async () => {
            hapticFeedback.medium();
            setDeletingAppointmentId(appt.id);
            try {
              await api.deleteBookingAppointment(appt.id);
              setAppointments((prev) => (prev || []).filter((item) => item.id !== appt.id));
              dataSync.notify();
            } catch (err) {
              console.error("[BookingScreen] erro ao cancelar agendamento:", err);
            } finally {
              setDeletingAppointmentId(null);
            }
          },
        },
      ]
    );
  };

  const handleSaveType = async (payload: CreateBookingTypeInput) => {
    if (editingType) {
      const updated = await api.updateBookingType(editingType.id, payload);
      setTypes((prev) =>
        (prev || []).map((item) => (item.id === editingType.id ? { ...item, ...updated } : item))
      );
    } else {
      const created = await api.createBookingType(payload);
      setTypes((prev) => [...(prev || []), created]);
    }
    hapticFeedback.success();
  };

  const handleConfirmMeetingSlot = async (meetingId: string, slotId: string) => {
    hapticFeedback.medium();
    setConfirmingSlotId(slotId);
    try {
      await api.confirmMeetingConsensus(meetingId, slotId);
      await loadData();
      dataSync.notify();
      hapticFeedback.success();
    } catch (err) {
      console.error("[BookingScreen] erro ao confirmar consenso:", err);
    } finally {
      setConfirmingSlotId(null);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    Alert.alert("Excluir Reunião", "Deseja encerrar e excluir este link de reunião?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          hapticFeedback.medium();
          try {
            await api.deleteMeeting(id);
            setMeetings((prev) => (prev || []).filter((m) => m.id !== id));
            hapticFeedback.success();
          } catch (err) {
            console.error("[BookingScreen] erro ao excluir reunião:", err);
          }
        },
      },
    ]);
  };

  const handleCopyMeetingLink = async (m: Meeting) => {
    const rawLink = m.short_url || `https://vito.rasppi.cloud/meet/${m.id}`;
    if (ClipboardModule) {
      await ClipboardModule.setStringAsync(rawLink);
      setCopiedSlug(m.id);
      hapticFeedback.selection();
      setTimeout(() => setCopiedSlug(null), 2000);
    }
  };

  if (selectedMeetingForDetail) {
    return (
      <MeetingPollDetailView
        meeting={selectedMeetingForDetail}
        onBack={() => setSelectedMeetingForDetail(null)}
        onEdit={(target) => {
          setEditingType(null);
          setEditingMeeting(target);
          setCreateModalVisible(true);
        }}
        onConfirmSlot={handleConfirmMeetingSlot}
        confirmingSlotId={confirmingSlotId}
        onDelete={async (id) => {
          setSelectedMeetingForDetail(null);
          await handleDeleteMeeting(id);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[styles.tabsContainer, { backgroundColor: colors.surfaceVariant }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "links" && [styles.tabButtonActive, { backgroundColor: colors.surface }],
          ]}
          onPress={() => {
            hapticFeedback.selection();
            setActiveTab("links");
          }}
        >
          <MaterialIcons
            name="link"
            size={18}
            color={activeTab === "links" ? colors.primary : colors.onSurfaceVariant}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "links" ? colors.onSurface : colors.onSurfaceVariant },
              activeTab === "links" && styles.tabTextActive,
            ]}
          >
            Links ({tabCounts.linksCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "appointments" && [styles.tabButtonActive, { backgroundColor: colors.surface }],
          ]}
          onPress={() => {
            hapticFeedback.selection();
            setActiveTab("appointments");
          }}
        >
          <MaterialIcons
            name="event-available"
            size={18}
            color={activeTab === "appointments" ? colors.primary : colors.onSurfaceVariant}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "appointments" ? colors.onSurface : colors.onSurfaceVariant },
              activeTab === "appointments" && styles.tabTextActive,
            ]}
          >
            Recebidos ({tabCounts.receivedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
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
          {activeTab === "links" ? (
            tabCounts.linksCount === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceVariant }]}>
                  <MaterialIcons name="link-off" size={32} color={colors.onSurfaceVariant} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                  Nenhum link configurado
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                  Crie links personalizados com janelas de atendimento ou enquetes de reuniões em grupo com votação de horários.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setEditingType(null);
                    setEditingMeeting(null);
                    setCreateModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="add" size={20} color={colors.onPrimary} />
                  <Text style={[styles.emptyActionText, { color: colors.onPrimary }]}>
                    Criar Primeiro Link
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cardsList}>
                {meetings.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={[styles.sectionHeaderLabel, { color: colors.textSecondary }]}>
                      Reuniões em Grupo & Consenso ({meetings.length})
                    </Text>
                    {meetings.map((m) => (
                      <MeetingCard
                        key={m.id}
                        meeting={m}
                        isCopied={copiedSlug === m.id}
                        onCopyLink={handleCopyMeetingLink}
                        onOpenDetail={(target) => setSelectedMeetingForDetail(target)}
                        onEdit={(target) => {
                          setEditingType(null);
                          setEditingMeeting(target);
                          setCreateModalVisible(true);
                        }}
                        onConfirmSlot={handleConfirmMeetingSlot}
                        confirmingSlotId={confirmingSlotId}
                        onDelete={handleDeleteMeeting}
                      />
                    ))}
                  </View>
                )}

                {types.length > 0 && (
                  <View style={{ gap: 12 }}>
                    {meetings.length > 0 && (
                      <Text style={[styles.sectionHeaderLabel, { color: colors.textSecondary }]}>
                        Links Individuais (1-on-1) ({types.length})
                      </Text>
                    )}
                    {(types || []).map((bt) => (
                      <BookingCard
                        key={bt.id}
                        type={bt}
                        isCopied={copiedSlug === bt.slug}
                        onCopyLink={handleCopyLink}
                        onToggleActive={handleToggleActive}
                        onEdit={(t) => {
                          setEditingMeeting(null);
                          setEditingType(t);
                          setCreateModalVisible(true);
                        }}
                        onDelete={handleDeleteType}
                        username={bookingUsername}
                      />
                    ))}
                  </View>
                )}
              </View>
            )
          ) : tabCounts.receivedCount === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceVariant }]}>
                <MaterialIcons name="event-busy" size={32} color={colors.onSurfaceVariant} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                Nenhuma resposta ou agendamento recebido
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                Quando convidados votarem nas suas enquetes de grupo ou reservarem horários 1-on-1, eles aparecerão aqui em tempo real.
              </Text>
            </View>
          ) : (
            <View style={styles.cardsList}>
              {groupedPolls.length > 0 && (
                <View style={{ gap: 10, marginBottom: 8 }}>
                  <Text style={[styles.sectionHeaderLabel, { color: colors.textSecondary }]}>
                    Votações em Grupo ({groupedPolls.length})
                  </Text>
                  {groupedPolls.map((item) => (
                    <View
                      key={item.meetingId}
                      style={[
                        styles.voteActivityCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.outlineVariant,
                        },
                      ]}
                    >
                      <View style={styles.voteActivityHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.voterNameTitle, { color: colors.onSurface }]}>
                            {item.meetingTitle}
                          </Text>
                          <Text style={[styles.voterMeetingSubtitle, { color: colors.onSurfaceVariant }]}>
                            {item.totalParticipants} {item.totalParticipants === 1 ? "participante votou" : "participantes votaram"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.voteBadgePill,
                            {
                              backgroundColor: item.isConfirmed
                                ? "rgba(46, 125, 50, 0.14)"
                                : colors.surfaceContainerHigh,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.voteBadgePillText,
                              {
                                color: item.isConfirmed ? "#2e7d32" : colors.primary,
                              },
                            ]}
                          >
                            {item.isConfirmed ? "✓ Confirmada" : "● Em Votação"}
                          </Text>
                        </View>
                      </View>

                      {item.participantNames.length > 0 && (
                        <View style={styles.votedSlotsChipsWrap}>
                          {item.participantNames.map((name, idx) => (
                            <View
                              key={`${item.meetingId}_p_${idx}`}
                              style={[
                                styles.votedSlotPill,
                                {
                                  backgroundColor: colors.surfaceContainerHigh,
                                  borderColor: colors.outlineVariant,
                                },
                              ]}
                            >
                              <MaterialIcons name="person" size={13} color={colors.primary} />
                              <Text style={[styles.votedSlotPillText, { color: colors.onSurface }]}>
                                {name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {item.isConfirmed && item.confirmedSlotLabel ? (
                        <View
                          style={[
                            styles.leadingConsensusBox,
                            { backgroundColor: "rgba(46, 125, 50, 0.08)", borderColor: "rgba(46, 125, 50, 0.25)" },
                          ]}
                        >
                          <MaterialIcons name="check-circle" size={16} color="#2e7d32" />
                          <Text style={[styles.leadingConsensusText, { color: colors.onSurface }]}>
                            Consenso Fechado: <Text style={{ fontWeight: "700" }}>{item.confirmedSlotLabel}</Text>
                          </Text>
                        </View>
                      ) : item.leadingSlot?.formatted ? (
                        <View
                          style={[
                            styles.leadingConsensusBox,
                            { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
                          ]}
                        >
                          <MaterialIcons name="star" size={16} color="#eab308" />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.leadingConsensusText, { color: colors.onSurface }]}>
                              Líder: <Text style={{ fontWeight: "700" }}>{item.leadingSlot.formatted.compactLabel}</Text>
                              {" "}({item.leadingSlot.votesCount} {item.leadingSlot.votesCount === 1 ? "voto" : "votos"} • {item.leadingSlot.percentage}%)
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                        <TouchableOpacity
                          style={[
                            styles.quickViewDetailBtn,
                            {
                              backgroundColor: colors.surfaceContainerHigh,
                              borderColor: colors.outlineVariant,
                              flex: item.isConfirmed || !item.leadingSlot?.slot?.id ? 1 : undefined,
                            },
                          ]}
                          onPress={() => setSelectedMeetingForDetail(item.meeting)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="how-to-vote" size={14} color={colors.primary} />
                          <Text style={[styles.quickViewDetailText, { color: colors.onSurface }]}>
                            Ver Detalhes da Votação
                          </Text>
                        </TouchableOpacity>

                        {!item.isConfirmed && item.leadingSlot?.slot?.id && (
                          <TouchableOpacity
                            style={[
                              styles.quickConfirmConsensusBtn,
                              { backgroundColor: colors.primary, flex: 1 },
                            ]}
                            onPress={() => handleConfirmMeetingSlot(item.meetingId, item.leadingSlot.slot!.id)}
                            disabled={Boolean(confirmingSlotId)}
                            activeOpacity={0.8}
                          >
                            <MaterialIcons name="event-available" size={14} color={colors.onPrimary} />
                            <Text style={[styles.quickConfirmConsensusText, { color: colors.onPrimary }]} numberOfLines={1}>
                              Confirmar Líder
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {(appointments || []).length > 0 && (
                <View style={{ gap: 10 }}>
                  {groupedPolls.length > 0 && (
                    <Text style={[styles.sectionHeaderLabel, { color: colors.textSecondary }]}>
                      Reservas 1-on-1 Confirmadas ({appointments.length})
                    </Text>
                  )}
                  {(appointments || []).map((appt) => (
                    <BookingAppointmentCard
                      key={appt.id}
                      appointment={appt}
                      isDeleting={deletingAppointmentId === appt.id}
                      onCancel={handleDeleteAppointment}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      <BookingTypeModal
        visible={createModalVisible}
        editingType={editingType}
        editingMeeting={editingMeeting}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingType(null);
          setEditingMeeting(null);
        }}
        onSubmit={handleSaveType}
        onMeetingCreated={(created) => setMeetings((prev) => [created, ...(prev || [])])}
        onMeetingUpdated={(updated) =>
          setMeetings((prev) =>
            (prev || []).map((m) => (m.id === updated.id ? updated : m))
          )
        }
        bookingUsername={bookingUsername}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: "row",
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 14,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    fontWeight: "700",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  cardsList: {
    gap: 12,
  },
  sectionHeaderLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  voteActivityCard: {
    padding: 16,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 10,
  },
  voteActivityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  voterNameTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  voterMeetingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  voteBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  voteBadgePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  votedSlotsChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  votedSlotPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  votedSlotPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  quickConfirmConsensusBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 2,
  },
  quickConfirmConsensusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  quickViewDetailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 2,
  },
  quickViewDetailText: {
    fontSize: 12,
    fontWeight: "700",
  },
  leadingConsensusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  leadingConsensusText: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: MD3Shapes.large,
    marginTop: 8,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
