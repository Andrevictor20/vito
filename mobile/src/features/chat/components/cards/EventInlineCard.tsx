import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { Event } from '../../../../types';
import { formatEventDuration } from '../../utils/chatCards';
import { CalIcon } from '../../../auth/demo/DemoIcons';
import { tabNavigationBus, chatPromptBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { PressableScale } from '../../../../theme/vitoMotion';

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
          { backgroundColor: colors.surf },
          undone && { opacity: 0.5 },
        ]}
      >
        {/* Chip Azul 40x40 com CalIcon */}
        <View style={[styles.chip, { backgroundColor: colors.blueBg }]}>
          <CalIcon color={colors.blue} size={20} />
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
          <PressableScale
            style={[styles.btnOutline, { backgroundColor: colors.surf }]}
            onPress={handleUndo}
            accessibilityRole="button"
            accessibilityLabel="Desfazer evento"
          >
            <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
              Desfazer
            </Text>
          </PressableScale>

          <PressableScale
            style={[styles.btnFill, { backgroundColor: colors.ink }]}
            onPress={handleViewAgenda}
            accessibilityRole="button"
            accessibilityLabel="Ver agenda"
          >
            <Text style={[styles.btnFillText, { color: colors.bg }]}>
              Ver agenda
            </Text>
          </PressableScale>
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
    borderRadius: 22,
    borderWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 19,
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  btnOutline: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
  btnFill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFillText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
});
