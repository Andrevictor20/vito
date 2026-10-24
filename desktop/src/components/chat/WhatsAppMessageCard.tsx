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
  const [status, setStatus] = useState<'draft' | 'ready' | 'sent' | 'cancelled'>(messageData.status || 'ready');

  const getInitials = (name?: string) => {
    if (!name?.trim()) return '?';
    const parts = name.trim().split(/\s+/).filter(p => !['de', 'da', 'do', 'dos', 'das', 'e'].includes(p.toLowerCase()));
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
    <div className={`mt-3.5 p-4 rounded-2xl border transition-all ${
      isSent
        ? 'bg-emerald-500/5 border-emerald-500/30'
        : 'bg-zinc-50 dark:bg-[#0B0D10] border-zinc-200 dark:border-[#222730] shadow-sm'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Avatar with photo / initials */}
        <div className="relative w-11 h-11 shrink-0">
          {hasPhoto ? (
            <img
              src={messageData.recipient_photo}
              alt={messageData.recipient_name}
              onError={() => setPhotoError(true)}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/20"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm ring-1 ring-emerald-500/20">
              {getInitials(messageData.recipient_name)}
            </div>
          )}
          {/* Micro WhatsApp indicator badge */}
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[9px] shadow-sm ring-2 ring-white dark:ring-[#0B0D10]">
            W
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
              {messageData.recipient_name || 'Destinatário'}
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
              isSent
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}>
              {isSent ? 'Enviado' : 'WhatsApp'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            {messageData.recipient_phone || 'WhatsApp Direct'}
          </p>
        </div>
      </div>

      {/* Message Box */}
      <div className="mt-3 p-3 rounded-xl bg-white dark:bg-[#14181E] border border-zinc-200/80 dark:border-[#20252D]">
        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
          <span>{isEditing ? 'Editar mensagem' : 'Prévia'}</span>
          {isEditing && <span>{draftText.length} caracteres</span>}
        </div>

        {isEditing ? (
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={3}
            autoFocus
            className="w-full text-sm bg-transparent text-zinc-900 dark:text-white border-0 focus:ring-0 outline-none resize-none"
            placeholder="Digite a mensagem..."
          />
        ) : (
          <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
            {draftText}
          </p>
        )}
      </div>

      {/* Sent Banner */}
      {isSent && (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={16} />
          <span>Mensagem enviada com sucesso para o WhatsApp</span>
        </div>
      )}

      {/* Actions */}
      {!isSent && (
        <div className="mt-3.5 flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraftText(messageData.message);
                  setIsEditing(false);
                }}
                className="h-8 px-3 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors"
              >
                <X size={13} />
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-8 px-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 transition-opacity"
              >
                <Check size={13} />
                Salvar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="h-8 px-3.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors"
              >
                <Edit2 size={13} />
                Editar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="h-8 px-4 rounded-full bg-[#0b9a5f] hover:bg-[#0a8954] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Send size={13} />
                Confirmar envio
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
