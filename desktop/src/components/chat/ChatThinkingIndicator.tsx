import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { THINKING_PHRASES } from '../../utils/chatGreetings';

export const ChatThinkingIndicator: React.FC = () => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
        setFade(true);
      }, 200);
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  const currentPhrase = THINKING_PHRASES[phraseIndex] || THINKING_PHRASES[0];

  return (
    <div className="flex items-center gap-2.5 py-3 px-2 text-zinc-500 dark:text-zinc-400 select-none">
      {/* Sparkle Icon */}
      <Sparkles size={15} className="text-zinc-700 dark:text-zinc-300 animate-pulse shrink-0" />

      {/* 3 Staggered Wave Dots */}
      <div className="flex items-center gap-1 h-3 shrink-0">
        <span
          className="w-1.5 h-1.5 rounded-full bg-zinc-700 dark:bg-zinc-300 animate-bounce"
          style={{ animationDuration: '0.8s', animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-zinc-700 dark:bg-zinc-300 animate-bounce"
          style={{ animationDuration: '0.8s', animationDelay: '160ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-zinc-700 dark:bg-zinc-300 animate-bounce"
          style={{ animationDuration: '0.8s', animationDelay: '320ms' }}
        />
      </div>

      {/* Dynamic Phrase with Crossfade */}
      <span
        className={`text-sm font-medium tracking-wide transition-opacity duration-200 ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {currentPhrase}
      </span>
    </div>
  );
};
