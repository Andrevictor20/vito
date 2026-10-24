import React, { useState } from 'react';
import { Copy, Check, ThumbsUp, ThumbsDown, Volume2, VolumeX, RotateCcw } from 'lucide-react';

export interface ChatMessageActionBarProps {
  messageText: string;
  timestamp?: string;
  onRetry?: () => void;
  onPlayAudio?: () => void;
  isPlayingAudio?: boolean;
  disabled?: boolean;
}

export const ChatMessageActionBar: React.FC<ChatMessageActionBarProps> = ({
  messageText,
  timestamp,
  onRetry,
  onPlayAudio,
  isPlayingAudio = false,
  disabled = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  const handleCopy = async () => {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleFeedback = (type: 'like' | 'dislike') => {
    if (disabled) return;
    setFeedback((prev) => (prev === type ? null : type));
  };

  return (
    <div className="pt-2 flex items-center justify-between text-zinc-400 dark:text-zinc-500 text-xs select-none">
      <div className="flex items-center gap-1">
        {/* Copiar */}
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled}
          className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex items-center gap-1.5 text-xs ${
            copied ? 'text-emerald-500 font-medium' : ''
          }`}
          title="Copiar resposta"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-500" />
              <span className="text-[11px] text-emerald-500 font-medium">Copiado</span>
            </>
          ) : (
            <Copy size={14} />
          )}
        </button>

        {/* Áudio / Voz TTS */}
        {onPlayAudio && (
          <button
            type="button"
            onClick={onPlayAudio}
            disabled={disabled}
            className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors ${
              isPlayingAudio ? 'text-emerald-500' : ''
            }`}
            title={isPlayingAudio ? 'Pausar áudio' : 'Ouvir resposta em áudio'}
          >
            {isPlayingAudio ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        )}

        {/* Feedback Positivo */}
        <button
          type="button"
          onClick={() => handleFeedback('like')}
          disabled={disabled}
          className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors ${
            feedback === 'like' ? 'text-emerald-500' : ''
          }`}
          title="Boa resposta"
        >
          <ThumbsUp size={14} />
        </button>

        {/* Feedback Negativo */}
        <button
          type="button"
          onClick={() => handleFeedback('dislike')}
          disabled={disabled}
          className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors ${
            feedback === 'dislike' ? 'text-red-500' : ''
          }`}
          title="Resposta ruim"
        >
          <ThumbsDown size={14} />
        </button>

        {/* Regenerar */}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={disabled}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            title="Tentar novamente"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {timestamp && (
        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 opacity-70">
          {new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
};
