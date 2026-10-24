import React from 'react';
import { Sparkles } from 'lucide-react';

interface ChatThinkingIndicatorProps {
  label?: string;
}

/**
 * Indicador de pensamento do Vito no Chat (estilo editorial Claude / Gemini).
 * - Sem loops frenéticos de frases mockadas (atende estritamente à solicitação do usuário).
 * - Estado sóbrio e contínuo com "Pensando..." discreto.
 * - Onda suave e fluida de 3 pontos.
 */
export const ChatThinkingIndicator: React.FC<ChatThinkingIndicatorProps> = ({
  label = 'Pensando...',
}) => {
  return (
    <div className="flex items-center gap-2.5 py-1.5 px-1 text-zinc-500 dark:text-zinc-400 select-none">
      {/* Sparkle Icon com pulso orgânico suave */}
      <Sparkles size={15} className="text-emerald-500 animate-pulse shrink-0" />

      {/* 3 Staggered Wave Dots calmos */}
      <div className="flex items-center gap-1 h-3 shrink-0">
        <span
          className="w-1.5 h-1.5 rounded-full bg-zinc-600 dark:bg-zinc-400 animate-bounce"
          style={{ animationDuration: '1.2s', animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-zinc-600 dark:bg-zinc-400 animate-bounce"
          style={{ animationDuration: '1.2s', animationDelay: '200ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-zinc-600 dark:bg-zinc-400 animate-bounce"
          style={{ animationDuration: '1.2s', animationDelay: '400ms' }}
        />
      </div>

      {/* Texto Sóbrio Estável */}
      <span className="text-sm font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
};
