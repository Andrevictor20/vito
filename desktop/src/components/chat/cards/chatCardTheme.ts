/**
 * Tema e estilos compartilhados para os cartões estruturados de chat no Desktop.
 * Define a paleta de chips, bordas e tags semânticas por categoria de cartão.
 */

export interface ChatCardThemeDefinition {
  chipBg: string;
  chipIconColor: string;
  tagBg: string;
  tagTextColor: string;
  borderColor: string;
  hoverBorder: string;
}

export const CHAT_CARD_THEMES: Record<string, ChatCardThemeDefinition> = {
  booking: {
    chipBg: 'bg-[#e4effb] dark:bg-[#16283b]',
    chipIconColor: '#2b7fd4',
    tagBg: 'bg-[#e4effb] dark:bg-[#16283b]',
    tagTextColor: 'text-[#2b7fd4] dark:text-[#5aa2ee]',
    borderColor: 'border-zinc-200 dark:border-[#222730]',
    hoverBorder: 'hover:border-zinc-300 dark:hover:border-zinc-700',
  },
  meeting: {
    chipBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    chipIconColor: '#10b981',
    tagBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    tagTextColor: 'text-emerald-700 dark:text-emerald-400',
    borderColor: 'border-zinc-200 dark:border-[#222730]',
    hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-800',
  },
  conflict: {
    chipBg: 'bg-red-50 dark:bg-red-950/50',
    chipIconColor: '#ef4444',
    tagBg: 'bg-red-50 dark:bg-red-950/50',
    tagTextColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-900/40',
    hoverBorder: 'hover:border-red-300 dark:hover:border-red-800',
  },
  pending: {
    chipBg: 'bg-amber-50 dark:bg-amber-950/40',
    chipIconColor: '#f59e0b',
    tagBg: 'bg-amber-50 dark:bg-amber-950/40',
    tagTextColor: 'text-amber-800 dark:text-amber-400',
    borderColor: 'border-zinc-200 dark:border-[#222730]',
    hoverBorder: 'hover:border-zinc-300 dark:hover:border-zinc-700',
  },
  trigger: {
    chipBg: 'bg-orange-50 dark:bg-orange-950/40',
    chipIconColor: '#f97316',
    tagBg: 'bg-orange-50 dark:bg-orange-950/40',
    tagTextColor: 'text-orange-700 dark:text-orange-400',
    borderColor: 'border-zinc-200 dark:border-[#222730]',
    hoverBorder: 'hover:border-zinc-300 dark:hover:border-zinc-700',
  },
  event: {
    chipBg: 'bg-[#e4effb] dark:bg-[#16283b]',
    chipIconColor: '#2b7fd4',
    tagBg: 'bg-[#e4effb] dark:bg-[#16283b]',
    tagTextColor: 'text-[#2b7fd4] dark:text-[#5aa2ee]',
    borderColor: 'border-zinc-200 dark:border-[#222730]',
    hoverBorder: 'hover:border-zinc-300 dark:hover:border-zinc-700',
  },
  todo: {
    chipBg: 'bg-[#eee8fd] dark:bg-[#241a42]',
    chipIconColor: '#7a4fe0',
    tagBg: 'bg-[#eee8fd] dark:bg-[#241a42]',
    tagTextColor: 'text-[#7a4fe0] dark:text-[#a58bff]',
    borderColor: 'border-zinc-200 dark:border-[#222730]',
    hoverBorder: 'hover:border-zinc-300 dark:hover:border-zinc-700',
  },
};
