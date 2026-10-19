import React from 'react';
import { Calendar, CheckCircle2, Coffee, Zap } from 'lucide-react';

interface QuickPromptItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  label: string;
  prompt: string;
}

const QUICK_PROMPTS: QuickPromptItem[] = [
  {
    icon: Calendar,
    iconColor: 'text-sky-500',
    label: 'O que tenho hoje?',
    prompt: 'O que tenho na agenda hoje?',
  },
  {
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    label: 'Minhas tarefas',
    prompt: 'Listar tarefas pendentes e prazos',
  },
  {
    icon: Coffee,
    iconColor: 'text-orange-500',
    label: 'Almoço amanhã 12h',
    prompt: 'Agendar almoço amanhã às 12h',
  },
  {
    icon: Zap,
    iconColor: 'text-amber-500',
    label: 'Briefing diário',
    prompt: 'Faça um briefing executivo das minhas prioridades',
  },
];

interface ChatQuickChipsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export const ChatQuickChips: React.FC<ChatQuickChipsProps> = ({ onSelectPrompt, disabled }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      {QUICK_PROMPTS.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            disabled={disabled}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-[#1C2026] hover:bg-zinc-200 dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#262B33] text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors shadow-xs shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Icon size={14} className={item.iconColor} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
