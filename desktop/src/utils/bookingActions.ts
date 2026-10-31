import { BookingAppointment } from '../types';

export const promptDeleteBookingType = (onConfirm: () => void) => {
  if (typeof window !== 'undefined' && window.confirm) {
    if (window.confirm('Excluir Link de Agendamento? Ao excluir, compromissos futuros vinculados a este link também serão removidos.')) {
      onConfirm();
    }
  } else {
    onConfirm();
  }
};

export const promptDeleteMeeting = (onConfirm: () => void) => {
  if (typeof window !== 'undefined' && window.confirm) {
    if (window.confirm('Excluir Reunião? Deseja encerrar e excluir este link de reunião?')) {
      onConfirm();
    }
  } else {
    onConfirm();
  }
};

export const promptCancelAppointment = (
  appt: BookingAppointment,
  onConfirm: () => void
) => {
  if (typeof window !== 'undefined' && window.confirm) {
    if (window.confirm(`Deseja cancelar o compromisso de ${appt.guest_name}? O horário voltará a ficar livre.`)) {
      onConfirm();
    }
  } else {
    onConfirm();
  }
};
