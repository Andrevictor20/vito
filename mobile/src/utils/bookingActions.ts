import { Alert } from 'react-native';
import { BookingAppointment } from '../types';

export const promptDeleteBookingType = (onConfirm: () => void) => {
  Alert.alert(
    'Excluir Link de Agendamento',
    'Ao excluir, compromissos futuros vinculados a este link também serão removidos. Deseja continuar?',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: onConfirm },
    ]
  );
};

export const promptDeleteMeeting = (onConfirm: () => void) => {
  Alert.alert('Excluir Reunião', 'Deseja encerrar e excluir este link de reunião?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: onConfirm },
  ]);
};

export const promptCancelAppointment = (
  appt: BookingAppointment,
  onConfirm: () => void
) => {
  Alert.alert(
    'Cancelar Agendamento',
    `Deseja cancelar o compromisso de ${appt.guest_name}? O horário voltará a ficar livre.`,
    [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar Compromisso', style: 'destructive', onPress: onConfirm },
    ]
  );
};
