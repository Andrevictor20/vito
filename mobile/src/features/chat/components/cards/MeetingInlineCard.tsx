import React, { useState } from 'react';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { copyToClipboard } from '../../../../utils/device/clipboard';
import { useTheme } from '../../../../context/ThemeContext';
import { ChatMeeting } from '../../../../types';
import { formatMeetingMode, meetingDisplayLink } from '../../utils/chatCards';
import { tabNavigationBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { BaseInlineCard } from './BaseInlineCard';

interface MeetingInlineCardProps {
  meeting: ChatMeeting;
}

export const MeetingInlineCard: React.FC<MeetingInlineCardProps> = ({ meeting }) => {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const link = meetingDisplayLink(meeting);

  const handleCopy = async () => {
    if (!link) return;
    if (await copyToClipboard(link)) {
      hapticFeedback.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <BaseInlineCard
      icon={<ProtoUiIcon name="groups" size={20} color={colors.acc} />}
      chipBg={colors.greenBg}
      title={meeting.title}
      subtitle={`${formatMeetingMode(meeting.mode)} · Link ativo`}
      secondaryAction={{
        label: copied ? 'Copiado!' : 'Copiar link',
        accessibilityLabel: 'Copiar link da reunião',
        onPress: handleCopy,
      }}
      primaryAction={{
        label: 'Ver reuniões',
        accessibilityLabel: 'Ver reuniões',
        onPress: () => {
          hapticFeedback.selection();
          tabNavigationBus.notify('booking');
        },
      }}
    />
  );
};
