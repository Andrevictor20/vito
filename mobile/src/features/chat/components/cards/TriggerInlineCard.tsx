import React, { useState } from 'react';
import { useTheme } from '../../../../context/ThemeContext';
import { Trigger } from '../../../../types';
import { RadarIcon } from '../../../../icons/AppGlyphs';
import { tabNavigationBus, chatPromptBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { BaseInlineCard } from './BaseInlineCard';

interface TriggerInlineCardProps {
  trigger: Trigger;
  onUndo?: () => void;
}

export const TriggerInlineCard: React.FC<TriggerInlineCardProps> = ({ trigger, onUndo }) => {
  const { colors } = useTheme();
  const [undone, setUndone] = useState(false);

  const subtitleText = trigger.query
    ? `${trigger.query} · Radar ativo`
    : 'Monitorando diariamente · Alerta ativo';

  return (
    <BaseInlineCard
      icon={<RadarIcon color={colors.orange} size={20} />}
      chipBg={colors.orangeBg}
      title={trigger.title}
      titleLines={2}
      subtitle={subtitleText}
      dimmed={undone}
      hideActions={undone}
      secondaryAction={{
        label: 'Desfazer',
        accessibilityLabel: 'Desfazer bot',
        onPress: () => {
          hapticFeedback.light();
          setUndone(true);
          if (onUndo) onUndo();
          else chatPromptBus.notify(`Desfazer radar "${trigger.title}"`);
        },
      }}
      primaryAction={{
        label: 'Ver bots',
        accessibilityLabel: 'Ver bots',
        onPress: () => {
          hapticFeedback.selection();
          tabNavigationBus.notify('triggers');
        },
      }}
    />
  );
};
