import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BookingAppointment, Meeting } from '../../types';

export interface VitoReceivedItemProps {
  item:
    | { kind: 'appointment'; data: BookingAppointment }
    | { kind: 'group'; data: Meeting };
  isPast?: boolean;
  onOpenVotingDetail?: (meeting: Meeting) => void;
  onCancelAppointment?: (appt: BookingAppointment) => void;
}

export const VitoReceivedItem: React.FC<VitoReceivedItemProps> = ({
  item,
  isPast = false,
  onOpenVotingDetail,
  onCancelAppointment,
}) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const isGroup = item.kind === 'group';

  let dayStr = '20';
  let monthStr = 'OUT';
  let titleStr = '';
  let metaStr = '';
  let moreText = '';
  let quoteNotes = '';
  let actionLabel = '';

  if (isGroup) {
    const meeting = item.data as Meeting;
    titleStr = meeting.title;
    const participants = Array.isArray(meeting.participants)
      ? meeting.participants
      : [];
    const count = participants.length;

    // Data da reunião ou do primeiro slot
    if (meeting.confirmed_slot_id && Array.isArray(meeting.slots)) {
      const confirmed = meeting.slots.find((s) => s.id === meeting.confirmed_slot_id);
      if (confirmed) {
        try {
          const d = new Date(confirmed.start_at);
          dayStr = String(d.getDate()).padStart(2, '0');
          monthStr = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
          const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          metaStr = `Votação fechada · ${time}`;
        } catch {}
      }
    } else if (Array.isArray(meeting.slots) && meeting.slots.length > 0) {
      try {
        const d = new Date(meeting.slots[0].start_at);
        dayStr = String(d.getDate()).padStart(2, '0');
        monthStr = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
        metaStr = `Em votação · ${count} ${count === 1 ? 'voto' : 'votos'}`;
      } catch {}
    } else {
      metaStr = `Em votação · ${count} participantes`;
    }

    const participantNames = participants
      .map((p) => p.name || p.contact_info)
      .filter(Boolean);
    if (participantNames.length > 0) {
      moreText = `${count} ${count === 1 ? 'participante votou' : 'participantes votaram'}: ${participantNames.join(', ')}.`;
    } else {
      moreText = 'Aguardando votos dos participantes convidados.';
    }
    actionLabel = 'Ver detalhes da votação';
  } else {
    const appt = item.data as BookingAppointment;
    titleStr = appt.guest_name;
    try {
      const d = new Date(appt.start_at);
      dayStr = String(d.getDate()).padStart(2, '0');
      monthStr = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
      const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      metaStr = `Reserva 1-on-1 · ${time}`;
    } catch {
      metaStr = 'Reserva 1-on-1';
    }

    moreText = appt.guest_email || '';
    if (appt.guest_notes) {
      quoteNotes = `“${appt.guest_notes}”`;
    }
    actionLabel = 'Cancelar reserva';
  }

  return (
    <View
      style={[
        styles.rc,
        { borderTopColor: colors.line },
        isPast && styles.rcPast,
      ]}
    >
      <TouchableOpacity
        style={styles.row}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${titleStr}, ${metaStr}`}
      >
        {/* Bloco de data .db de 42x46px */}
        <View
          style={[
            styles.db,
            {
              backgroundColor: isPast ? colors.surf : colors.tealBg,
            },
          ]}
        >
          <Text
            style={[
              styles.dbNumber,
              {
                color: isPast ? colors.muted : colors.teal,
                fontFamily: tokens.typography.family.montserratBold,
              },
            ]}
          >
            {dayStr}
          </Text>
          <Text
            style={[
              styles.dbMonth,
              {
                color: isPast ? colors.muted : colors.teal,
                fontFamily: tokens.typography.family.semibold,
              },
            ]}
          >
            {monthStr}
          </Text>
        </View>

        {/* Informações da reunião / agendamento */}
        <View style={styles.t}>
          <Text
            style={[
              styles.title,
              { color: colors.ink, fontFamily: tokens.typography.family.semibold },
            ]}
            numberOfLines={1}
          >
            {titleStr}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
            {metaStr}
          </Text>
        </View>

        {/* Chevron expansível */}
        <MaterialIcons
          name={isOpen ? 'expand-more' : 'chevron-right'}
          size={20}
          color={colors.muted}
        />
      </TouchableOpacity>

      {/* Conteúdo expandido .more */}
      {isOpen && (
        <View style={styles.more}>
          {!!moreText && (
            <Text style={[styles.moreText, { color: colors.muted }]}>
              {moreText}
            </Text>
          )}

          {!!quoteNotes && (
            <View style={[styles.quoteBox, { backgroundColor: colors.surf }]}>
              <Text
                style={[
                  styles.quoteText,
                  { color: colors.ink, fontFamily: tokens.typography.family.regular },
                ]}
              >
                {quoteNotes}
              </Text>
            </View>
          )}

          <View style={styles.actionRow}>
            {isGroup && onOpenVotingDetail ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { borderColor: colors.line, backgroundColor: colors.bg },
                ]}
                onPress={() => onOpenVotingDetail(item.data as Meeting)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.ink, fontFamily: tokens.typography.family.semibold },
                  ]}
                >
                  {actionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}

            {!isGroup && onCancelAppointment ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { borderColor: colors.line, backgroundColor: colors.bg },
                ]}
                onPress={() => onCancelAppointment(item.data as BookingAppointment)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.red, fontFamily: tokens.typography.family.semibold },
                  ]}
                >
                  {actionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  rc: {
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  rcPast: {
    opacity: 0.72,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  db: {
    width: 42,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dbNumber: {
    fontSize: 17,
    lineHeight: 18,
  },
  dbMonth: {
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  t: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    marginBottom: 2,
  },
  meta: {
    fontSize: 13,
    fontFamily: tokens.typography.family.regular,
  },
  more: {
    marginLeft: 54,
    marginTop: 10,
    gap: 8,
  },
  moreText: {
    fontSize: 13.5,
    lineHeight: 18,
    fontFamily: tokens.typography.family.regular,
  },
  quoteBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginVertical: 4,
  },
  quoteText: {
    fontSize: 13.5,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  actionButton: {
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 13.5,
  },
});
