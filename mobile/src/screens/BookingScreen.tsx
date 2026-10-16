import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { tokens, MD3Shapes } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { hapticFeedback } from "../theme/motion";
import { api } from "../services/api";
import { BookingType, BookingAppointment, CreateBookingTypeInput, Meeting } from "../types";
import { BookingCard } from "../components/booking/BookingCard";
import { BookingAppointmentCard } from "../components/booking/BookingAppointmentCard";
import { MeetingCard } from "../components/booking/MeetingCard";
import { BookingTypeModal } from "../components/booking/BookingTypeModal";

let ClipboardModule: any = null;
try {
  ClipboardModule = require("expo-clipboard");
} catch (e) {
  ClipboardModule = null;
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
}

export const BookingScreen: React.FC<BookingScreenProps> = ({ onBack, createRequestId }) => {
  const { colors, isDark } = useTheme();
  const { user: authUser } = useAuth();
  const firstCreateRender = React.useRef(true);

  React.useEffect(() => {
    if (firstCreateRender.current) {
      firstCreateRender.current = false;
      return;
    }
    if ((createRequestId ?? 0) > 0) {
      setCreateModalVisible(true);
      setEditingType(null);
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
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<string | null>(null);

  const bookingUsername = React.useMemo(() => {
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
            Links ({(types || []).length})
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
            Recebidos ({(appointments || []).length})
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
            (types || []).length === 0 && (meetings || []).length === 0 ? (
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
                  <View style={{ marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: colors.textSecondary,
                        letterSpacing: 0.5,
                        marginBottom: 8,
                        textTransform: 'uppercase',
                      }}
                    >
                      Reuniões em Grupo & Consenso ({meetings.length})
                    </Text>
                    {meetings.map((m) => (
                      <MeetingCard
                        key={m.id}
                        meeting={m}
                        isCopied={copiedSlug === m.id}
                        onCopyLink={handleCopyMeetingLink}
                        onDelete={handleDeleteMeeting}
                      />
                    ))}
                  </View>
                )}

                {types.length > 0 && (
                  <View>
                    {meetings.length > 0 && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: colors.textSecondary,
                          letterSpacing: 0.5,
                          marginBottom: 8,
                          textTransform: 'uppercase',
                        }}
                      >
                        Agendamentos Individuais (1-on-1) ({types.length})
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
          ) : (appointments || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceVariant }]}>
                <MaterialIcons name="event-busy" size={32} color={colors.onSurfaceVariant} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                Nenhum agendamento recebido
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                Compartilhe seus links de booking para receber reuniões diretamente sincronizadas com sua agenda.
              </Text>
            </View>
          ) : (
            <View style={styles.cardsList}>
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
        </ScrollView>
      )}

      <BookingTypeModal
        visible={createModalVisible}
        editingType={editingType}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingType(null);
        }}
        onSubmit={handleSaveType}
        onMeetingCreated={(created) => setMeetings((prev) => [created, ...(prev || [])])}
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
    paddingBottom: 100,
  },
  cardsList: {
    gap: 12,
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
