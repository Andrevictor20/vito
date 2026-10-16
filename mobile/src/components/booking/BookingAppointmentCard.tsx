import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BookingAppointment } from '../../types';

interface BookingAppointmentCardProps {
  appointment: BookingAppointment;
  isDeleting: boolean;
  onCancel: (appt: BookingAppointment) => void;
}

export const BookingAppointmentCard: React.FC<BookingAppointmentCardProps> = ({
  appointment: appt,
  isDeleting,
  onCancel,
}) => {
  const { colors } = useTheme();

  const dateObj = new Date(appt.start_at);
  const dateFormatted = dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = dateObj.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View
      style={[
        styles.apptCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.apptTopRow}>
        <View style={styles.apptGuestInfo}>
          <Text style={[styles.guestName, { color: colors.onSurface }]}>
            {appt.guest_name}
          </Text>
          <Text style={[styles.guestEmail, { color: colors.onSurfaceVariant }]}>
            {appt.guest_email}
          </Text>
        </View>
        <View style={[styles.confirmedPill, { backgroundColor: 'rgba(46, 125, 50, 0.12)' }]}>
          <Text style={[styles.confirmedPillText, { color: '#2e7d32' }]}>
            Confirmado
          </Text>
        </View>
      </View>

      <View style={styles.apptMetaRow}>
        <View style={styles.apptMetaItem}>
          <MaterialIcons name="event" size={16} color={colors.primary} />
          <Text style={[styles.apptMetaText, { color: colors.onSurface }, tabularNumbers]}>
            {dateFormatted}
          </Text>
        </View>
        <View style={styles.apptMetaItem}>
          <MaterialIcons name="schedule" size={16} color={colors.primary} />
          <Text style={[styles.apptMetaText, { color: colors.onSurface }, tabularNumbers]}>
            {timeFormatted}
          </Text>
        </View>
      </View>

      {appt.guest_notes ? (
        <View style={[styles.notesBox, { backgroundColor: colors.surfaceVariant }]}>
          <Text style={[styles.notesText, { color: colors.onSurfaceVariant }]}>
            "{appt.guest_notes}"
          </Text>
        </View>
      ) : null}

      <View style={styles.apptActionsRow}>
        <TouchableOpacity
          style={[styles.cancelApptButton, { borderColor: colors.outlineVariant }]}
          onPress={() => onCancel(appt)}
          disabled={isDeleting}
          activeOpacity={0.7}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <>
              <MaterialIcons name="event-busy" size={16} color={colors.error} />
              <Text style={[styles.cancelApptButtonText, { color: colors.error }]}>
                Cancelar e Liberar Horário
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  apptCard: {
    padding: 16,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 12,
  },
  apptTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  apptGuestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  guestEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  confirmedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confirmedPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  apptMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  apptMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  apptMetaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesBox: {
    padding: 10,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  apptActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  cancelApptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelApptButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
