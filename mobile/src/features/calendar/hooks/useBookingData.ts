import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { hapticFeedback } from '../../../theme/motion';
import { api } from '../../../services/api';
import { dataSync } from '../../../services/dataSync';
import type { BookingAppointment, BookingType, Meeting } from '../../../types';
import {
  promptCancelAppointment,
  promptDeleteBookingType,
  promptDeleteMeeting,
} from '../utils/bookingActions';

let NotificationsModule: any = null;
try {
  NotificationsModule = require('expo-notifications');
} catch {
  NotificationsModule = null;
}

const BOOKING_PUSH_TYPES = new Set([
  'meeting_vote',
  'meeting_confirmed',
  'booking_appointment',
]);

export function useBookingData() {
  const [types, setTypes] = useState<BookingType[]>([]);
  const [appointments, setAppointments] = useState<BookingAppointment[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingSlotId, setConfirmingSlotId] = useState<string | null>(null);
  const [selectedMeetingForDetail, setSelectedMeetingForDetail] = useState<Meeting | null>(null);
  const isFocusedRef = useRef(false);

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
      isFocusedRef.current = true;
      void loadData();
      const pollInterval = setInterval(() => {
        if (isFocusedRef.current && AppState.currentState === 'active') {
          void loadData();
        }
      }, 5000);
      return () => {
        isFocusedRef.current = false;
        clearInterval(pollInterval);
      };
    }, [loadData]),
  );

  useEffect(() => {
    return dataSync.subscribe('refresh_bookings', () => {
      void loadData();
    });
  }, [loadData]);

  useEffect(() => {
    let notifSub: any = null;
    if (NotificationsModule?.addNotificationReceivedListener) {
      notifSub = NotificationsModule.addNotificationReceivedListener((notification: any) => {
        const dataType = notification?.request?.content?.data?.type;
        if (typeof dataType === 'string' && BOOKING_PUSH_TYPES.has(dataType)) {
          void loadData();
        }
      });
    }
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isFocusedRef.current) {
        void loadData();
      }
    });
    return () => {
      if (notifSub?.remove) notifSub.remove();
      appStateSub.remove();
    };
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const handleToggleActive = useCallback(async (bt: BookingType) => {
    hapticFeedback.light();
    const prevActive = bt.is_active;
    setTypes((prev) =>
      (prev || []).map((item) => (item.id === bt.id ? { ...item, is_active: !prevActive } : item)),
    );
    try {
      const updated = await api.updateBookingType(bt.id, { is_active: !prevActive });
      setTypes((prev) =>
        (prev || []).map((item) => (item.id === bt.id ? { ...item, ...updated, is_active: updated.is_active } : item)),
      );
    } catch (err) {
      setTypes((prev) =>
        (prev || []).map((item) => (item.id === bt.id ? { ...item, is_active: prevActive } : item)),
      );
      Alert.alert('Erro', 'Não foi possível atualizar o status do link agora.');
      console.error('[BookingScreen] erro ao alternar status:', err);
    }
  }, []);

  const handleDeleteType = useCallback((id: string) => {
    promptDeleteBookingType(async () => {
      hapticFeedback.medium();
      try {
        await api.deleteBookingType(id);
        setTypes((prev) => (prev || []).filter((item) => item.id !== id));
        setAppointments((prev) => (prev || []).filter((a) => a.booking_type_id !== id));
      } catch (err) {
        Alert.alert('Erro', 'Não foi possível excluir o link.');
        console.error('[BookingScreen] erro ao excluir tipo:', err);
      }
    });
  }, []);

  const handleDeleteMeeting = useCallback((id: string) => {
    promptDeleteMeeting(async () => {
      hapticFeedback.medium();
      try {
        await api.deleteMeeting(id);
        setMeetings((prev) => (prev || []).filter((m) => m.id !== id));
        hapticFeedback.success();
      } catch (err) {
        Alert.alert('Erro', 'Não foi possível excluir a reunião.');
        console.error('[BookingScreen] erro ao excluir reunião:', err);
      }
    });
  }, []);

  const handleCancelAppointment = useCallback((appt: BookingAppointment) => {
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
  }, []);

  const handleConfirmMeetingSlot = useCallback(
    async (meetingId: string, slotId: string) => {
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
    },
    [loadData],
  );

  return {
    types,
    appointments,
    meetings,
    loading,
    refreshing,
    confirmingSlotId,
    selectedMeetingForDetail,
    setSelectedMeetingForDetail,
    onRefresh,
    handleToggleActive,
    handleDeleteType,
    handleDeleteMeeting,
    handleCancelAppointment,
    handleConfirmMeetingSlot,
  };
}
