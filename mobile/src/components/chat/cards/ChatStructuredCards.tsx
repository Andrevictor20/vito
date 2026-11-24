import React from 'react';
import { ChatMessage, TimeSlot } from '../../../types';
import { EventInlineCard } from './EventInlineCard';
import { ConflictInlineCard } from './ConflictInlineCard';
import { TodoInlineCard } from './TodoInlineCard';
import { PendingInlineCard } from './PendingInlineCard';
import { TriggerInlineCard } from './TriggerInlineCard';
import { BookingInlineCard } from './BookingInlineCard';
import { MeetingInlineCard } from './MeetingInlineCard';
import { WhatsAppMessageInlineCard } from './WhatsAppMessageInlineCard';
import { GmailMessageInlineCard } from './GmailMessageInlineCard';
import { DestructiveConfirmationCard } from './DestructiveConfirmationCard';
import { ActionConfirmationCard } from './ActionConfirmationCard';
import { SmoothCardEntrance } from './SmoothCardEntrance';

export interface ChatStructuredCardsProps {
  message: ChatMessage;
  onSelectSlot?: (slot: TimeSlot, message: ChatMessage) => void;
  onConfirmAction?: (confirmPrompt: string) => void;
  onResolveConfirmation?: (messageId: string, pendingId: string, reject: boolean) => Promise<void> | void;
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
  onResolveConfirmation,
  disabled = false,
}) => {
  const confirmCard = message.cards?.find((c) => c.type === 'confirm');
  const pendingConfId = message.pending_confirmation_id || confirmCard?.id || '';
  const showActionConfirm =
    Boolean(message.requires_confirmation || confirmCard) &&
    Boolean(pendingConfId) &&
    !message.pending_confirmation &&
    !message.whatsapp_message &&
    !message.gmail_message;

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
      {message.whatsapp_message && (
        <SmoothCardEntrance>
          <WhatsAppMessageInlineCard
            messageData={message.whatsapp_message}
            disabled={disabled}
          />
        </SmoothCardEntrance>
      )}
      {message.gmail_message && (
        <SmoothCardEntrance>
          <GmailMessageInlineCard
            messageData={message.gmail_message}
            disabled={disabled}
          />
        </SmoothCardEntrance>
      )}
      {showActionConfirm && (
        <SmoothCardEntrance>
          <ActionConfirmationCard
            pendingId={pendingConfId}
            card={confirmCard}
            status={message.confirmationStatus}
            disabled={disabled}
            onResolve={(id, reject) => onResolveConfirmation?.(message.id, id, reject)}
          />
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
