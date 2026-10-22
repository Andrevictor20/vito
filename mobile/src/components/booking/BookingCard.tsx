import React from 'react';
import { UnifiedBookingCard } from './UnifiedBookingCard';
import { BookingType } from '../../types';

interface BookingCardProps {
  type: BookingType;
  isCopied: boolean;
  onCopyLink: (bt: BookingType) => void;
  onToggleActive: (bt: BookingType) => void;
  onEdit: (bt: BookingType) => void;
  onDelete: (id: string) => void;
  username: string;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  type: bt,
  isCopied,
  onCopyLink,
  onToggleActive,
  onEdit,
  onDelete,
  username,
}) => {
  const handlePress = () => onToggleActive(bt);

  return (
    <UnifiedBookingCard
      variant="individual"
      id={bt.id}
      title={bt.title}
      subtitle={bt.description}
      status={bt.is_active ? 'active' : 'paused'}
      isCopied={isCopied}
      duration={bt.duration_minutes}
      window={{ start: bt.start_hour, end: bt.end_hour, buffer: bt.buffer_minutes }}
      url={bt.short_url || bt.public_url || `https://vito.rasppi.cloud/book/${username}/${bt.slug}`}
      onPress={handlePress}
      onCopyLink={() => onCopyLink(bt)}
      onEdit={() => onEdit(bt)}
      onDelete={() => onDelete(bt.id)}
    />
  );
};