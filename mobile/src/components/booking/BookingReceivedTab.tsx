import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BookingAppointment, Meeting } from '../../types';
import { VitoReceivedItem } from './VitoReceivedItem';

export interface BookingReceivedTabProps {
  appointments: BookingAppointment[];
  meetings: Meeting[];
  refreshing: boolean;
  onRefresh: () => void;
  onOpenVotingDetail: (meeting: Meeting) => void;
  onCancelAppointment: (appt: BookingAppointment) => void;
}

interface NormalizedItem {
  id: string;
  kind: 'appointment' | 'group';
  data: BookingAppointment | Meeting;
  date: Date;
  isPast: boolean;
}

export const BookingReceivedTab: React.FC<BookingReceivedTabProps> = ({
  appointments,
  meetings,
  refreshing,
  onRefresh,
  onOpenVotingDetail,
  onCancelAppointment,
}) => {
  const { colors } = useTheme();

  const { upcomingList, pastList } = useMemo(() => {
    const now = new Date();
    const all: NormalizedItem[] = [];

    // Appointments (1-on-1)
    for (const appt of appointments) {
      const d = new Date(appt.start_at);
      const isPast = d.getTime() < now.getTime();
      all.push({
        id: `appt_${appt.id}`,
        kind: 'appointment',
        data: appt,
        date: d,
        isPast,
      });
    }

    // Meetings (Group)
    for (const m of meetings) {
      let d = new Date(m.created_at);
      let isPast = false;

      if (m.confirmed_slot_id && Array.isArray(m.slots)) {
        const confirmed = m.slots.find((s) => s.id === m.confirmed_slot_id);
        if (confirmed) {
          d = new Date(confirmed.start_at);
          isPast = d.getTime() < now.getTime();
        }
      } else if (Array.isArray(m.slots) && m.slots.length > 0) {
        // Usa o último slot para determinar se passou
        const maxTime = Math.max(...m.slots.map((s) => new Date(s.start_at).getTime()));
        if (maxTime > 0) {
          d = new Date(maxTime);
          isPast = d.getTime() < now.getTime();
        }
      }

      all.push({
        id: `meet_${m.id}`,
        kind: 'group',
        data: m,
        date: d,
        isPast,
      });
    }

    const upcoming = all
      .filter((item) => !item.isPast)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const past = all
      .filter((item) => item.isPast)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return { upcomingList: upcoming, pastList: past };
  }, [appointments, meetings]);

  const totalCount = upcomingList.length + pastList.length;

  if (totalCount === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.ink}
          />
        }
      >
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surf }]}>
          <MaterialIcons name="event-busy" size={32} color={colors.muted} />
        </View>
        <Text
          style={[
            styles.emptyTitle,
            {
              color: colors.ink,
              fontFamily: tokens.typography.family.montserratBold,
            },
          ]}
        >
          Nenhum agendamento recebido
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
          Quando convidados votarem nas suas enquetes de grupo ou agendarem horários 1-on-1, eles aparecerão aqui.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.ink}
        />
      }
    >
      {/* Seção Próximas */}
      {upcomingList.length > 0 && (
        <View style={styles.sectionWrap}>
          <View style={styles.sec}>
            <Text
              style={[
                styles.secTitle,
                {
                  color: colors.ink,
                  fontFamily: tokens.typography.family.montserratBold,
                },
              ]}
            >
              Próximas
            </Text>
            <Text style={[styles.cnt, { color: colors.muted }]}>
              {upcomingList.length}
            </Text>
          </View>

          {upcomingList.map((item) => (
            <VitoReceivedItem
              key={item.id}
              item={item as any}
              isPast={false}
              onOpenVotingDetail={onOpenVotingDetail}
              onCancelAppointment={onCancelAppointment}
            />
          ))}
        </View>
      )}

      {/* Seção Anteriores */}
      {pastList.length > 0 && (
        <View style={[styles.sectionWrap, upcomingList.length > 0 && { marginTop: 14 }]}>
          <View style={styles.sec}>
            <Text
              style={[
                styles.secTitle,
                {
                  color: colors.ink,
                  fontFamily: tokens.typography.family.montserratBold,
                },
              ]}
            >
              Anteriores
            </Text>
            <Text style={[styles.cnt, { color: colors.muted }]}>
              {pastList.length}
            </Text>
          </View>

          {pastList.map((item) => (
            <VitoReceivedItem
              key={item.id}
              item={item as any}
              isPast={true}
              onOpenVotingDetail={onOpenVotingDetail}
              onCancelAppointment={onCancelAppointment}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const meetingSlotDate = (slotId: string) => slotId;

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 120,
  },
  sectionWrap: {
    marginBottom: 8,
  },
  sec: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
  },
  secTitle: {
    fontSize: 16,
  },
  cnt: {
    fontSize: 12.5,
    fontFamily: tokens.typography.family.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
    fontFamily: tokens.typography.family.regular,
    marginBottom: 20,
  },
});
