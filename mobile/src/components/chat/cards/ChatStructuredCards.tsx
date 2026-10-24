import React from 'react';
import { ChatMessage, TimeSlot } from '../../../types';
import { EventInlineCard } from './EventInlineCard';
import { ConflictInlineCard } from './ConflictInlineCard';
import { TodoInlineCard } from './TodoInlineCard';
import { PendingInlineCard } from './PendingInlineCard';
import { TriggerInlineCard } from './TriggerInlineCard';
import { BookingInlineCard } from './BookingInlineCard';
import { MeetingInlineCard } from './MeetingInlineCard';
import { DestructiveConfirmationCard } from './DestructiveConfirmationCard';
import { SmoothCardEntrance } from './SmoothCardEntrance';

export interface ChatStructuredCardsProps {
  message: ChatMessage;
  onSelectSlot?: (slot: TimeSlot, message: ChatMessage) => void;
  onConfirmAction?: (confirmPrompt: string) => void;
  disabled?: boolean;
}

/**
 * Renderizador modular de cards estruturados da resposta do Vito no chat,
 * envolvendo cada card ativo com SmoothCardEntrance para transição suave de opacidade e translateY.
 */
export const ChatStructuredCards: React.FC<ChatStructuredCardsProps> = ({
  message,
  onSelectSlot,
  onConfirmAction,
  disabled = false,
}) => {
  return (
    <>
      {message.event && (
        <SmoothCardEntrance>
          <EventInlineCard event={message.event} />
        </SmoothCardEntrance>
      )}
      {message.conflict?.has_conflict && (
        <SmoothCardEntrance>
          <ConflictInlineCard
            conflict={message.conflict}
            onSelectSlot={(slot) => onSelectSlot?.(slot, message)}
          />
        </SmoothCardEntrance>
      )}
      {message.todo && (
        <SmoothCardEntrance>
          <TodoInlineCard todo={message.todo} />
        </SmoothCardEntrance>
      )}
      {message.pending && (
        <SmoothCardEntrance>
          <PendingInlineCard pending={message.pending} />
        </SmoothCardEntrance>
      )}
      {message.trigger && (
        <SmoothCardEntrance>
          <TriggerInlineCard trigger={message.trigger} />
        </SmoothCardEntrance>
      )}
      {message.booking && (
        <SmoothCardEntrance>
          <BookingInlineCard booking={message.booking} />
        </SmoothCardEntrance>
      )}
      {message.meeting && (
        <SmoothCardEntrance>
          <MeetingInlineCard meeting={message.meeting} />
        </SmoothCardEntrance>
      )}
      {message.pending_confirmation && (
        <SmoothCardEntrance>
          <DestructiveConfirmationCard
            confirmation={message.pending_confirmation}
            onConfirm={onConfirmAction}
            disabled={disabled}
          />
        </SmoothCardEntrance>
      )}
    </>
  );
};
