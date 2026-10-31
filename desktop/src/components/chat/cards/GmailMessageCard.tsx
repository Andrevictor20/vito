import React, { useState } from 'react';
import { ChatGmailMessage } from '../../../types';
import { MailIcon } from '../ChatCardIcons';

export interface GmailMessageCardProps {
  messageData: ChatGmailMessage;
  onConfirmSend?: (updated: ChatGmailMessage) => void;
  disabled?: boolean;
}

export const GmailMessageCard: React.FC<GmailMessageCardProps> = ({
  messageData,
  onConfirmSend,
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [subject, setSubject] = useState(messageData.subject || 'Sem assunto');
  const [body, setBody] = useState(messageData.body);
  const [status, setStatus] = useState<'draft' | 'ready' | 'sent' | 'cancelled'>(
    messageData.status || 'draft'
  );

  const handleSend = () => {
    if (disabled || status === 'sent') return;
    setStatus('sent');
    onConfirmSend?.({ ...messageData, subject, body, status: 'sent' });
  };

  return (
    <div className="mt-3 p-4 rounded-2xl bg-white dark:bg-[#12151A] border border-zinc-200 dark:border-[#222730] shadow-sm max-w-lg transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
          <MailIcon color="#ef4444" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {messageData.recipient_email || 'Destinatário'}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {subject}
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
          <div className="space-y-2">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto"
              disabled={disabled}
              className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Conteúdo"
              disabled={disabled}
              className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
              rows={4}
            />
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 select-text">
            <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 mb-1">{subject}</div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{body}</p>
          </div>
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
            className="text-xs px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-2xs"
          >
            Enviar E-mail
          </button>
        </div>
      )}
    </div>
  );
};
