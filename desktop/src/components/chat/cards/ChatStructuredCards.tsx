import React from 'react';
import { ChatMessage, ChatWhatsAppMessage, ChatGmailMessage } from '../../../types';
import { EventInlineCard } from './EventInlineCard';
import { TodoInlineCard } from './TodoInlineCard';
import { WhatsAppMessageCard } from './WhatsAppMessageCard';
import { GmailMessageCard } from './GmailMessageCard';
import { DestructiveConfirmationCard } from './DestructiveConfirmationCard';
import { BookingInlineCard } from './BookingInlineCard';
import { ConflictInlineCard, ConflictInfo, TimeSlot } from './ConflictInlineCard';
import { MeetingInlineCard } from './MeetingInlineCard';
import { PendingInlineCard } from './PendingInlineCard';
import { TriggerInlineCard } from './TriggerInlineCard';
import { SmoothCardEntrance } from './SmoothCardEntrance';

export interface ChatStructuredCardsProps {
  message: ChatMessage;
  onNavigateTab?: (tab: string) => void;
  onConfirmAction?: (pendingID: string) => void;
  onConfirmWhatsApp?: (updated: ChatWhatsAppMessage) => void;
  onConfirmEmail?: (updated: ChatGmailMessage) => void;
  onSelectSlot?: (slot: TimeSlot) => void;
  disabled?: boolean;
}

/**
 * Renderizador de cards estruturados das respostas do Vito no Desktop.
 * Envolve os cartões com SmoothCardEntrance para transição fluida.
 */
export const ChatStructuredCards: React.FC<ChatStructuredCardsProps> = ({
  message,
  onNavigateTab,
  onConfirmAction,
  onConfirmWhatsApp,
  onConfirmEmail,
  onSelectSlot,
  disabled = false,
}) => {
  const pendingConf = (message as any).pending_confirmation;
  const conflict = (message as any).conflict as ConflictInfo | undefined;
  const pendingItem = (message as any).pending;

  return (
    <div className="space-y-2">
      {message.event && (
        <SmoothCardEntrance>
          <EventInlineCard event={message.event} onNavigateTab={onNavigateTab} />
        </SmoothCardEntrance>
      )}

      {conflict?.has_conflict && (
        <SmoothCardEntrance>
          <ConflictInlineCard
            conflict={conflict}
            onSelectSlot={onSelectSlot}
            onNavigateTab={onNavigateTab}
          />
        </SmoothCardEntrance>
      )}

      {message.todo && (
        <SmoothCardEntrance>
          <TodoInlineCard todo={message.todo} onNavigateTab={onNavigateTab} />
        </SmoothCardEntrance>
      )}

      {pendingItem && (
        <SmoothCardEntrance>
          <PendingInlineCard pending={pendingItem} onNavigateTab={onNavigateTab} />
        </SmoothCardEntrance>
      )}

      {message.trigger && (
        <SmoothCardEntrance>
          <TriggerInlineCard trigger={message.trigger} onNavigateTab={onNavigateTab} />
        </SmoothCardEntrance>
      )}

      {message.booking && (
        <SmoothCardEntrance>
          <BookingInlineCard booking={message.booking} onNavigateTab={onNavigateTab} />
        </SmoothCardEntrance>
      )}

      {message.meeting && (
        <SmoothCardEntrance>
          <MeetingInlineCard meeting={message.meeting} onNavigateTab={onNavigateTab} />
        </SmoothCardEntrance>
      )}

      {message.whatsapp_message && (
        <SmoothCardEntrance>
          <WhatsAppMessageCard
            messageData={message.whatsapp_message}
            onConfirmSend={onConfirmWhatsApp}
            disabled={disabled}
          />
        </SmoothCardEntrance>
      )}

      {message.gmail_message && (
        <SmoothCardEntrance>
          <GmailMessageCard
            messageData={message.gmail_message}
            onConfirmSend={onConfirmEmail}
            disabled={disabled}
          />
        </SmoothCardEntrance>
      )}

      {pendingConf && (
        <SmoothCardEntrance>
          <DestructiveConfirmationCard
            confirmation={pendingConf}
            onConfirm={onConfirmAction}
            disabled={disabled}
          />
        </SmoothCardEntrance>
      )}
    </div>
  );
};
