import React, { useState } from 'react';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { copyToClipboard } from '../../../../utils/device/clipboard';
import { useTheme } from '../../../../context/ThemeContext';
import { ChatBooking } from '../../../../types';
import { bookingDisplayLink } from '../../utils/chatCards';
import { tabNavigationBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { BaseInlineCard } from './BaseInlineCard';

interface BookingInlineCardProps {
  booking: ChatBooking;
}

export const BookingInlineCard: React.FC<BookingInlineCardProps> = ({ booking }) => {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const link = bookingDisplayLink(booking);

  const handleCopy = async () => {
    if (!link) return;
    if (await copyToClipboard(link)) {
      hapticFeedback.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const displayUrl = link ? link.replace(/^https?:\/\//, '') : 'Link de agendamento';

  return (
    <BaseInlineCard
      icon={<ProtoUiIcon name="link" size={20} color={colors.blue} />}
      chipBg={colors.blueBg}
      title={booking.title}
      subtitle={`${displayUrl} · Ativo`}
      secondaryAction={{
        label: copied ? 'Copiado!' : 'Copiar link',
        accessibilityLabel: 'Copiar link',
        onPress: handleCopy,
      }}
      primaryAction={{
        label: 'Ver booking',
        accessibilityLabel: 'Ver booking',
        onPress: () => {
          hapticFeedback.selection();
          tabNavigationBus.notify('booking');
        },
      }}
    />
  );
};
