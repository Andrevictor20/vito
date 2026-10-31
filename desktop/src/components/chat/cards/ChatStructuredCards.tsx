import React from 'react';
import { ChatMessage, ChatWhatsAppMessage, ChatGmailMessage } from '../../../types';
import { EventInlineCard } from './EventInlineCard';
import { TodoInlineCard } from './TodoInlineCard';
import { WhatsAppMessageCard } from './WhatsAppMessageCard';
import { GmailMessageCard } from './GmailMessageCard';
import { DestructiveConfirmationCard } from './DestructiveConfirmationCard';

export interface ChatStructuredCardsProps {
  message: ChatMessage;
  onNavigateTab?: (tab: string) => void;
  onConfirmAction?: (pendingID: string) => void;
  onConfirmWhatsApp?: (updated: ChatWhatsAppMessage) => void;
  onConfirmEmail?: (updated: ChatGmailMessage) => void;
  disabled?: boolean;
}

/**
 * Renderizador de cards estruturados das respostas do Vito no Desktop.
 */
export const ChatStructuredCards: React.FC<ChatStructuredCardsProps> = ({
  message,
  onNavigateTab,
  onConfirmAction,
  onConfirmWhatsApp,
  onConfirmEmail,
  disabled = false,
}) => {
  const pendingConf = (message as any).pending_confirmation;

  return (
    <div className="space-y-2">
      {message.event && (
        <EventInlineCard event={message.event} onNavigateTab={onNavigateTab} />
      )}
      {message.todo && (
        <TodoInlineCard todo={message.todo} onNavigateTab={onNavigateTab} />
      )}
      {message.whatsapp_message && (
        <WhatsAppMessageCard
          messageData={message.whatsapp_message}
          onConfirmSend={onConfirmWhatsApp}
          disabled={disabled}
        />
      )}
      {message.gmail_message && (
        <GmailMessageCard
          messageData={message.gmail_message}
          onConfirmSend={onConfirmEmail}
          disabled={disabled}
        />
      )}
      {pendingConf && (
        <DestructiveConfirmationCard
          confirmation={pendingConf}
          onConfirm={onConfirmAction}
          disabled={disabled}
        />
      )}
    </div>
  );
};
