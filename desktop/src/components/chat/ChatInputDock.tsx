import React, { useState } from 'react';
import { FocusMenu, FocusMode } from './FocusMenu';
import { Plus, Mic, Send, Loader2 } from 'lucide-react';

interface ChatInputDockProps {
  onSendMessage: (text: string, focus: FocusMode | null) => void;
  loading: boolean;
}

export const ChatInputDock: React.FC<ChatInputDockProps> = ({
  onSendMessage,
  loading,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedFocus, setSelectedFocus] = useState<FocusMode | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputValue.trim();
    if (!text || loading) return;
    onSendMessage(text, selectedFocus);
    setInputValue('');
  };

  return (
    <div className="rounded-[26px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] p-3.5 shadow-md focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition-all">
      <div className="flex items-center gap-2.5 px-1.5 pb-2">
        <button
          type="button"
          className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          title="Anexar arquivo ou imagem"
        >
          <Plus size={17} />
        </button>

        {/* Botão Foco em */}
        <FocusMenu selectedFocus={selectedFocus} onSelectFocus={setSelectedFocus} />
      </div>

      <div className="flex items-end gap-3">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          placeholder="Diga ao Vito o que você precisa..."
          disabled={loading}
          className="flex-1 bg-transparent border-none text-base text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none resize-none px-2 py-1 leading-relaxed"
        />

        <div className="flex items-center gap-2 pb-1 shrink-0">
          <button
            type="button"
            className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
            title="Comando de voz (Whisper)"
          >
            <Mic size={20} />
          </button>

          <button
            onClick={() => handleSubmit()}
            disabled={!inputValue.trim() || loading}
            className="p-3 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] disabled:opacity-30 shadow-sm transition-all"
            title="Enviar mensagem (Enter)"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
