import React, { useState } from 'react';
import { useTheme } from '../../../../context/ThemeContext';
import { Event } from '../../../../types';
import { formatEventDuration } from '../../utils/chatCards';
import { CalIcon } from '../../../../icons/AppGlyphs';
import { tabNavigationBus, chatPromptBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { BaseInlineCard } from './BaseInlineCard';

interface EventInlineCardProps {
  event: Event;
  onPressDetail?: () => void;
  onUndo?: () => void;
}

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

  return (
    <BaseInlineCard
      icon={<CalIcon color={colors.blue} size={20} />}
      chipBg={colors.blueBg}
      title={event.title}
      titleLines={2}
      subtitle={`${formattedDate}, ${startTime}${duration ? ` (${duration})` : ''} · Google Agenda`}
      dimmed={undone}
      hideActions={undone}
      secondaryAction={{
        label: 'Desfazer',
        accessibilityLabel: 'Desfazer evento',
        onPress: () => {
          hapticFeedback.light();
          setUndone(true);
          if (onUndo) onUndo();
          else chatPromptBus.notify(`Desfazer evento "${event.title}"`);
        },
      }}
      primaryAction={{
        label: 'Ver agenda',
        accessibilityLabel: 'Ver agenda',
        onPress: () => {
          hapticFeedback.selection();
          if (onPressDetail) onPressDetail();
          else tabNavigationBus.notify('calendar');
        },
      }}
    />
  );
};
