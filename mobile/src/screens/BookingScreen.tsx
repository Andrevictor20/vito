import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { dataSync } from '../services/dataSync';
import {
  BookingType,
  BookingAppointment,
  CreateBookingTypeInput,
  Meeting,
} from '../types';
import {
  promptDeleteBookingType,
  promptDeleteMeeting,
  promptCancelAppointment,
} from '../utils/bookingActions';
import { BookingLinksTab } from '../components/booking/BookingLinksTab';
import { BookingReceivedTab } from '../components/booking/BookingReceivedTab';
import { MeetingPollDetailView } from '../components/booking/MeetingPollDetailView';
import { BookingTypeModal } from '../components/booking/BookingTypeModal';
import { bookingStyles as styles } from './BookingScreen.styles';

let ClipboardModule: any = null;
try {
  ClipboardModule = require('expo-clipboard');
} catch {
  ClipboardModule = null;
}

let NotificationsModule: any = null;
try {
  NotificationsModule = require('expo-notifications');
} catch {
  NotificationsModule = null;
}

const extractBookingUsername = (types: BookingType[]): string => {
  for (const t of types || []) {
    const m = (t.public_url || '').match(/\/book\/([^/]+)\//);
    if (m) return m[1];
  }
  return 'seu-usuario';
};

interface BookingScreenProps {
  onBack?: () => void;
  createRequestId?: number;
  onSubViewChange?: (inSubView: boolean) => void;
}

export const BookingScreen: React.FC<BookingScreenProps> = ({
  createRequestId,
  onSubViewChange,
}) => {
  const { colors, isDark } = useTheme();
  const { user: authUser } = useAuth();
  const firstCreateRender = React.useRef(true);

  const [types, setTypes] = useState<BookingType[]>([]);
  const [appointments, setAppointments] = useState<BookingAppointment[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'links' | 'appointments'>('links');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<BookingType | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [confirmingSlotId, setConfirmingSlotId] = useState<string | null>(null);
  const [selectedMeetingForDetail, setSelectedMeetingForDetail] = useState<Meeting | null>(null);

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

  useEffect(() => {
    onSubViewChange?.(Boolean(selectedMeetingForDetail));
  }, [selectedMeetingForDetail, onSubViewChange]);

  const bookingUsername = useMemo(() => {
    const fromTypes = extractBookingUsername(types);
    if (fromTypes !== 'seu-usuario') return fromTypes;
    if (authUser?.name) {
      const fromName = authUser.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (fromName) return fromName;
    }
    return 'usuario';
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
      console.error('[BookingScreen] erro ao carregar dados:', err);
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
    return dataSync.subscribe('refresh_bookings', () => {
      loadData();
    });
  }, [loadData]);

  useEffect(() => {
    let notifSub: any = null;
    if (NotificationsModule?.addNotificationReceivedListener) {
      notifSub = NotificationsModule.addNotificationReceivedListener((notification: any) => {
        const dataType = notification?.request?.content?.data?.type;
        if (
          dataType === 'meeting_vote' ||
          dataType === 'meeting_confirmed' ||
          dataType === 'booking_appointment'
        ) {
          loadData();
        }
      });
    }

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadData();
      }
    });

    return () => {
      if (notifSub?.remove) notifSub.remove();
      appStateSub.remove();
    };
  }, [loadData]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        loadData();
      }
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCopyLink = async (url: string) => {
    hapticFeedback.medium();
    if (ClipboardModule?.setStringAsync) {
      await ClipboardModule.setStringAsync(url);
    }
  };

  const handleToggleActive = async (bt: BookingType) => {
    hapticFeedback.light();
    try {
      const updated = await api.updateBookingType(bt.id, { is_active: !bt.is_active });
      setTypes((prev) =>
        (prev || []).map((item) => (item.id === bt.id ? { ...item, is_active: updated.is_active } : item))
      );
    } catch (err) {
      console.error('[BookingScreen] erro ao alternar status:', err);
    }
  };

  const handleDeleteType = (id: string) => {
    promptDeleteBookingType(async () => {
      hapticFeedback.medium();
      try {
        await api.deleteBookingType(id);
        setTypes((prev) => (prev || []).filter((item) => item.id !== id));
        setAppointments((prev) => (prev || []).filter((a) => a.booking_type_id !== id));
      } catch (err) {
        console.error('[BookingScreen] erro ao excluir tipo:', err);
      }
    });
  };

  const handleDeleteMeeting = (id: string) => {
    promptDeleteMeeting(async () => {
      hapticFeedback.medium();
      try {
        await api.deleteMeeting(id);
        setMeetings((prev) => (prev || []).filter((m) => m.id !== id));
        hapticFeedback.success();
      } catch (err) {
        console.error('[BookingScreen] erro ao excluir reunião:', err);
      }
    });
  };

  const handleCancelAppointment = (appt: BookingAppointment) => {
    promptCancelAppointment(appt, async () => {
      hapticFeedback.medium();
      try {
        await api.deleteBookingAppointment(appt.id);
        setAppointments((prev) => (prev || []).filter((item) => item.id !== appt.id));
        dataSync.notify();
      } catch (err) {
        console.error('[BookingScreen] erro ao cancelar agendamento:', err);
      }
    });
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
      console.error('[BookingScreen] erro ao confirmar consenso:', err);
    } finally {
      setConfirmingSlotId(null);
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
          handleDeleteMeeting(id);
        }}
      />
    );
  }

  const linksCount = types.length + meetings.length;
  const receivedCount =
    appointments.length +
    meetings.filter((m) => Array.isArray(m.participants) && m.participants.length > 0).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Segmented Control .seg: Links [N] | Recebidos [N] */}
      <View style={styles.segmentContainer}>
        <View style={[styles.segmentTrack, { backgroundColor: colors.surf }]}>
          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'links' && [
                styles.segmentTabActive,
                { backgroundColor: colors.bg },
              ],
            ]}
            onPress={() => {
              hapticFeedback.selection();
              setActiveTab('links');
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'links' }}
            accessibilityLabel="Links de agendamento"
          >
            <Text
              style={[
                styles.segmentTabText,
                {
                  color: activeTab === 'links' ? colors.ink : colors.muted,
                  fontFamily: activeTab === 'links'
                    ? tokens.typography.family.semibold
                    : tokens.typography.family.medium,
                },
              ]}
            >
              Links
            </Text>
            {linksCount > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: activeTab === 'links' ? colors.surf : 'rgba(0,0,0,0.06)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: colors.muted,
                      fontFamily: tokens.typography.family.semibold,
                    },
                  ]}
                >
                  {linksCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'appointments' && [
                styles.segmentTabActive,
                { backgroundColor: colors.bg },
              ],
            ]}
            onPress={() => {
              hapticFeedback.selection();
              setActiveTab('appointments');
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'appointments' }}
            accessibilityLabel="Agendamentos recebidos"
          >
            <Text
              style={[
                styles.segmentTabText,
                {
                  color: activeTab === 'appointments' ? colors.ink : colors.muted,
                  fontFamily: activeTab === 'appointments'
                    ? tokens.typography.family.semibold
                    : tokens.typography.family.medium,
                },
              ]}
            >
              Recebidos
            </Text>
            {receivedCount > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: activeTab === 'appointments' ? colors.surf : 'rgba(0,0,0,0.06)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: colors.muted,
                      fontFamily: tokens.typography.family.semibold,
                    },
                  ]}
                >
                  {receivedCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.ink} />
        </View>
      ) : activeTab === 'links' ? (
        <BookingLinksTab
          types={types}
          meetings={meetings}
          username={bookingUsername}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onCopyLink={handleCopyLink}
          onEditType={(bt) => {
            setEditingMeeting(null);
            setEditingType(bt);
            setCreateModalVisible(true);
          }}
          onEditMeeting={(m) => {
            setEditingType(null);
            setEditingMeeting(m);
            setCreateModalVisible(true);
          }}
          onDeleteType={handleDeleteType}
          onDeleteMeeting={handleDeleteMeeting}
          onOpenVotingDetail={(m) => setSelectedMeetingForDetail(m)}
          onToggleActiveType={handleToggleActive}
          onCreateNew={() => {
            setEditingType(null);
            setEditingMeeting(null);
            setCreateModalVisible(true);
          }}
        />
      ) : (
        <BookingReceivedTab
          appointments={appointments}
          meetings={meetings}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onOpenVotingDetail={(m) => setSelectedMeetingForDetail(m)}
          onCancelAppointment={handleCancelAppointment}
        />
      )}

      {/* Modal de Criação / Edição */}
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
    </View>
  );
};
