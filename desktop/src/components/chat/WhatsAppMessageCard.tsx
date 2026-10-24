import React, { useState } from 'react';
import { ChatWhatsAppMessage } from '../../types';
import { Send, Edit2, CheckCircle2, Check, X } from 'lucide-react';

interface WhatsAppMessageCardProps {
  messageData: ChatWhatsAppMessage;
  onConfirmSend?: (updated: ChatWhatsAppMessage) => void;
}

export const WhatsAppMessageCard: React.FC<WhatsAppMessageCardProps> = ({
  messageData,
  onConfirmSend,
}) => {
  const [photoError, setPhotoError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(messageData.message);
  const [status, setStatus] = useState<'draft' | 'ready' | 'sent' | 'cancelled'>(
    messageData.status || 'ready'
  );

  const getInitials = (name?: string) => {
    if (!name?.trim()) return '?';
    const parts = name
      .trim()
      .split(/\s+/)
      .filter((p) => !['de', 'da', 'do', 'dos', 'das', 'e'].includes(p.toLowerCase()));
    if (parts.length === 0) return name.slice(0, 1).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleConfirm = () => {
    setStatus('sent');
    const updated = {
      ...messageData,
      message: draftText,
      status: 'sent' as const,
      sent_at: new Date().toISOString(),
    };
    onConfirmSend?.(updated);
  };

  const isSent = status === 'sent';
  const hasPhoto = Boolean(messageData.recipient_photo && !photoError);

  return (
    <div
      className={`mt-4 p-5 rounded-[22px] border transition-all ${
        isSent
          ? 'bg-emerald-500/5 border-emerald-500/30'
          : 'bg-white dark:bg-[#12151A] border-zinc-200 dark:border-[#222730] shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3.5">
        {/* Avatar with photo / initials */}
        <div className="relative w-12 h-12 shrink-0">
          {hasPhoto ? (
            <img
              src={messageData.recipient_photo}
              alt={messageData.recipient_name}
              onError={() => setPhotoError(true)}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/20"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-base ring-1 ring-emerald-500/20">
              {getInitials(messageData.recipient_name)}
            </div>
          )}
          {/* WhatsApp badge */}
          <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[10px] shadow-sm ring-2 ring-white dark:ring-[#12151A] font-bold">
            W
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-base font-bold text-zinc-900 dark:text-white truncate">
              {messageData.recipient_name || 'Destinatário'}
            </h4>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                isSent
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {isSent ? 'Enviado' : 'WhatsApp'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            {messageData.recipient_phone || 'WhatsApp Direct'}
          </p>
        </div>
      </div>

      {/* Message Box */}
      <div className="mt-3.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#1A1F26] border border-zinc-200/80 dark:border-[#262D37]">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
          <span>{isEditing ? 'Editar mensagem' : 'Prévia da Mensagem'}</span>
          {isEditing && <span>{draftText.length} caracteres</span>}
        </div>

        {isEditing ? (
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={3}
            autoFocus
            className="w-full text-sm sm:text-base bg-transparent text-zinc-900 dark:text-white border-0 focus:ring-0 outline-none resize-none"
            placeholder="Digite sua mensagem do WhatsApp..."
          />
        ) : (
          <p className="text-sm sm:text-base text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">
            {draftText}
          </p>
        )}
      </div>

      {/* Actions Bar */}
      <div className="mt-4 flex items-center justify-between gap-3 pt-1">
        {isSent ? (
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} />
            <span>Mensagem enviada com sucesso</span>
          </div>
        ) : isEditing ? (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => {
                setDraftText(messageData.message);
                setIsEditing(false);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={14} />
              <span>Cancelar</span>
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition-colors"
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
                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white text-xs sm:text-sm font-bold shadow-sm transition-all hover:scale-105"
              >
                <Send size={14} />
                <span>Enviar Agora</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
