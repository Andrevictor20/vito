import React, { useState } from 'react';
import { ChatWhatsAppMessage } from '../../../types';
import { WhatsAppGlyph } from '../ChatCardIcons';

export interface WhatsAppMessageCardProps {
  messageData: ChatWhatsAppMessage;
  onConfirmSend?: (updated: ChatWhatsAppMessage) => void;
  disabled?: boolean;
}

export const WhatsAppMessageCard: React.FC<WhatsAppMessageCardProps> = ({
  messageData,
  onConfirmSend,
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(messageData.message);
  const [status, setStatus] = useState<'draft' | 'ready' | 'sent' | 'cancelled'>(
    messageData.status || 'ready'
  );

  const handleSend = () => {
    if (disabled || status === 'sent') return;
    setStatus('sent');
    onConfirmSend?.({ ...messageData, message: text, status: 'sent' });
  };

  return (
    <div className="mt-3 p-4 rounded-2xl bg-white dark:bg-[#12151A] border border-zinc-200 dark:border-[#222730] shadow-sm max-w-lg transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
          <WhatsAppGlyph color="#10b981" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {messageData.recipient_name || 'Contato WhatsApp'}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {messageData.recipient_phone || 'WhatsApp'}
          </div>
        </div>
        {status === 'sent' && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
            Enviado
          </span>
        )}
      </div>

      <div className="mt-3">
        {isEditing ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            rows={3}
          />
        ) : (
          <p className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 select-text">
            {text}
          </p>
        )}
      </div>

      {status !== 'sent' && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {isEditing ? (
            <button
              onClick={() => setIsEditing(false)}
              disabled={disabled}
              className="text-xs px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Salvar
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              disabled={disabled}
              className="text-xs px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Editar
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={disabled}
            className="text-xs px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors shadow-2xs"
          >
            Enviar Mensagem
          </button>
        </div>
      )}
    </div>
  );
};
