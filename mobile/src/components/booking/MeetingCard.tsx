import React from 'react';
import { UnifiedBookingCard } from './UnifiedBookingCard';
import { Meeting, MeetingSlot } from '../../types';
import { meetingDisplayLink } from '../../utils/chatCards';
import { getLeadingSlot } from '../../utils/meetingPollUtils';

interface MeetingCardProps {
  meeting: Meeting;
  isCopied: boolean;
  onCopyLink: (m: Meeting) => void;
  onEdit?: (m: Meeting) => void;
  onOpenDetail?: (m: Meeting) => void;
  onConfirmSlot?: (meetingId: string, slotId: string) => void;
  onDelete: (id: string) => void;
  confirmingSlotId?: string | null;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  isCopied,
  onCopyLink,
  onEdit,
  onOpenDetail,
  onConfirmSlot,
  onDelete,
  confirmingSlotId,
}) => {
  const link = meetingDisplayLink(meeting as any);
  const isConfirmed = meeting.status === 'confirmed';
  const slots: MeetingSlot[] = Array.isArray(meeting.slots) ? meeting.slots : [];
  const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
  const totalParticipants = participants.length;
  const leading = getLeadingSlot(slots, totalParticipants);

  const confirmedSlot = isConfirmed
    ? slots.find((s) => s.id === meeting.confirmed_slot_id)
    : undefined;

  return (
    <UnifiedBookingCard
      variant="group"
      id={meeting.id}
      title={meeting.title}
      subtitle={meeting.description}
      status={isConfirmed ? 'confirmed' : totalParticipants > 0 ? 'voting' : 'active'}
      isCopied={isCopied}
      duration={meeting.duration_minutes}
      votes={totalParticipants}
      leadingSlot={leading.votesCount > 0 && leading.formatted ? { formatted: leading.formatted, votesCount: leading.votesCount, percentage: leading.percentage } : null}
      isConfirmed={isConfirmed}
      confirmedSlot={confirmedSlot ? { formatted: { dateLabel: '', timeRange: '' } } : null}
      slotsCount={slots.length}
      participantsCount={totalParticipants}
      url={link}
      onPress={() => onOpenDetail?.(meeting)}
      onCopyLink={() => onCopyLink(meeting)}
      onEdit={() => onEdit?.(meeting)}
      onDelete={() => onDelete(meeting.id)}
      onConfirm={() => {
        if (leading.slot?.id && !isConfirmed) {
          onConfirmSlot?.(meeting.id, leading.slot.id);
        }
      }}
      isConfirming={confirmingSlotId !== null}
    />
  );
};