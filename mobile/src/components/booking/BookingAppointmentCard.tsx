import React from 'react';
import { UnifiedBookingCard } from './UnifiedBookingCard';
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
    <UnifiedBookingCard
      variant="appointment"
      id={appt.id}
      title={appt.guest_name}
      subtitle={appt.guest_email}
      status="confirmed"
      guestName={appt.guest_name}
      guestEmail={appt.guest_email}
      startAt={appt.start_at}
      guestNotes={appt.guest_notes}
      onPress={() => {}}
      onDelete={() => onCancel(appt)}
      isDeleting={isDeleting}
    />
  );
};