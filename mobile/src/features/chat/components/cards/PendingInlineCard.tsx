import React, { useState } from 'react';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { useTheme } from '../../../../context/ThemeContext';
import { PendingItem } from '../../../../types';
import { formatScheduledDate } from '../../utils/chatCards';
import { tabNavigationBus, chatPromptBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { BaseInlineCard } from './BaseInlineCard';

interface PendingInlineCardProps {
  pending: PendingItem;
  onUndo?: () => void;
}

export const PendingInlineCard: React.FC<PendingInlineCardProps> = ({ pending, onUndo }) => {
  const { colors } = useTheme();
  const [undone, setUndone] = useState(false);
  const dateLabel = formatScheduledDate(pending.scheduled_date);

  return (
    <BaseInlineCard
      icon={<ProtoUiIcon name="inbox" size={20} color={colors.orange} />}
      chipBg={colors.orangeBg}
      title={pending.title}
      subtitle={`${dateLabel} · ${pending.category || 'Geral'}`}
      dimmed={undone}
      hideActions={undone}
      secondaryAction={{
        label: 'Desfazer',
        accessibilityLabel: 'Desfazer pendência',
        onPress: () => {
          hapticFeedback.light();
          setUndone(true);
          if (onUndo) onUndo();
          else chatPromptBus.notify(`Desfazer pendência "${pending.title}"`);
        },
      }}
      primaryAction={{
        label: 'Ver tarefas',
        accessibilityLabel: 'Ver tarefas',
        onPress: () => {
          hapticFeedback.selection();
          tabNavigationBus.notify('tasks');
        },
      }}
    />
  );
};
