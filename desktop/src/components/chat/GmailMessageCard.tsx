import React, { useState } from 'react';
import { ChatGmailMessage } from '../../types';
import { Mail, Send, Edit2, CheckCircle2, Check, X } from 'lucide-react';

interface GmailMessageCardProps {
  messageData: ChatGmailMessage;
  onConfirmSend?: (updated: ChatGmailMessage) => void;
}

export const GmailMessageCard: React.FC<GmailMessageCardProps> = ({
  messageData,
  onConfirmSend,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState(messageData.subject);
  const [draftBody, setDraftBody] = useState(messageData.body);
  const [status, setStatus] = useState<'draft' | 'ready' | 'sent' | 'cancelled'>(
    messageData.status || 'ready'
  );

  const handleConfirm = () => {
    setStatus('sent');
    const updated = {
      ...messageData,
      subject: draftSubject,
      body: draftBody,
      status: 'sent' as const,
      sent_at: new Date().toISOString(),
    };
    onConfirmSend?.(updated);
  };

  const isSent = status === 'sent';

  return (
    <div
      className={`mt-4 p-5 rounded-[22px] border transition-all ${
        isSent
          ? 'bg-rose-500/5 border-rose-500/30'
          : 'bg-white dark:bg-[#12151A] border-zinc-200 dark:border-[#222730] shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-[#EA4335] flex items-center justify-center shrink-0 border border-red-500/20 shadow-xs">
          <Mail size={24} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-base font-bold text-zinc-900 dark:text-white truncate">
              {messageData.recipient_name || messageData.recipient_email}
            </h4>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                isSent
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                  : 'bg-red-500/10 text-[#EA4335] border border-red-500/20'
              }`}
            >
              {isSent ? 'Enviado' : 'Gmail'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            {messageData.recipient_email}
          </p>
        </div>
      </div>

      {/* Subject Line */}
      <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center gap-2">
        <span className="text-xs sm:text-sm font-semibold text-zinc-400">Assunto:</span>
        {isEditing ? (
          <input
            type="text"
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            className="flex-1 text-sm sm:text-base font-semibold bg-transparent text-zinc-900 dark:text-white border-b border-zinc-300 dark:border-zinc-700 pb-0.5 focus:border-red-500 outline-none"
            placeholder="Assunto do e-mail"
          />
        ) : (
          <span className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white truncate">
            {draftSubject}
          </span>
        )}
      </div>

      {/* Body Box */}
      <div className="mt-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#1A1F26] border border-zinc-200/80 dark:border-[#262D37]">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
          <span>{isEditing ? 'Editar mensagem' : 'Conteúdo do E-mail'}</span>
          {isEditing && <span>{draftBody.length} caracteres</span>}
        </div>

        {isEditing ? (
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={4}
            className="w-full text-sm sm:text-base bg-transparent text-zinc-900 dark:text-white border-0 focus:ring-0 outline-none resize-none leading-relaxed font-sans"
            placeholder="Digite o conteúdo do e-mail..."
          />
        ) : (
          <p className="text-sm sm:text-base text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">
            {draftBody}
          </p>
        )}
      </div>

      {/* Actions Bar */}
      <div className="mt-4 flex items-center justify-between gap-3 pt-1">
        {isSent ? (
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} />
            <span>E-mail enviado com sucesso</span>
          </div>
        ) : isEditing ? (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => {
                setDraftSubject(messageData.subject);
                setDraftBody(messageData.body);
                setIsEditing(false);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={14} />
              <span>Cancelar</span>
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <Check size={14} />
              <span>Salvar Edição</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              Confirmar antes do disparo
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-zinc-200 dark:border-[#222730] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <Edit2 size={13} />
                <span>Editar</span>
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#EA4335] hover:bg-[#d9382b] text-white text-xs sm:text-sm font-bold shadow-sm transition-all hover:scale-105"
              >
                <Send size={14} />
                <span>Enviar E-mail</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
