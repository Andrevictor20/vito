import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Event } from '../../../types';
import { formatEventDuration } from '../../../utils/chatCards';
import { CalIcon } from '../../login/DemoIcons';
import { tabNavigationBus, chatPromptBus } from '../../../services/dataSync';
import { hapticFeedback } from '../../../theme/motion';

interface EventInlineCardProps {
  event: Event;
  onPressDetail?: () => void;
  onUndo?: () => void;
}

/**
 * Card in-chat de criação de evento/agendamento alinhado ao protótipo `vito-telas.html`:
 * - Card arredondado com chip azul 44x44px e ícone de calendário.
 * - Título em Inter 600 SemiBold e subtítulo com dia da semana, horário e integração.
 * - Botões de ação em pílula abaixo do card: "Desfazer" (outline) e "Ver agenda" (solid ink).
 */
export const EventInlineCard: React.FC<EventInlineCardProps> = ({ event, onPressDetail, onUndo }) => {
  const { colors } = useTheme();
  const [undone, setUndone] = useState(false);

  const startDate = new Date(event.start_at);
  const formattedDate = startDate.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  const startTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const duration = formatEventDuration(event.start_at, event.end_at);
  const subtitleText = `${formattedDate}, ${startTime}${duration ? ` (${duration})` : ''} · Google Agenda`;

  const handleUndo = () => {
    hapticFeedback.light();
    setUndone(true);
    if (onUndo) {
      onUndo();
    } else {
      chatPromptBus.notify(`Desfazer evento "${event.title}"`);
    }
  };

  const handleViewAgenda = () => {
    hapticFeedback.selection();
    if (onPressDetail) {
      onPressDetail();
    } else {
      tabNavigationBus.notify('calendar');
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Card Principal */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bg,
            borderColor: colors.line,
          },
          undone && { opacity: 0.5 },
        ]}
      >
        {/* Chip Azul 44x44 com CalIcon */}
        <View style={[styles.chip, { backgroundColor: colors.blueBg }]}>
          <CalIcon color={colors.blue} size={22} />
        </View>

        {/* Informações do Evento */}
        <View style={styles.titleCol}>
          <Text
            style={[styles.title, { color: colors.ink }]}
            numberOfLines={2}
          >
            {event.title}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.muted }]}
            numberOfLines={1}
          >
            {subtitleText}
          </Text>
        </View>
      </View>

      {/* Botões de Ação Abaixo do Card */}
      {!undone && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: colors.ink }]}
            onPress={handleUndo}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Desfazer evento"
          >
            <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
              Desfazer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnFill, { backgroundColor: colors.ink }]}
            onPress={handleViewAgenda}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ver agenda"
          >
            <Text style={[styles.btnFillText, { color: colors.bg }]}>
              Ver agenda
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    width: '100%',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  btnOutline: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  btnOutlineText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    fontWeight: '600',
  },
  btnFill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    fontWeight: '600',
  },
});
