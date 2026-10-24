import React, { useState } from 'react';
import { CalendarEvent } from '../../../types';
import { CalIcon } from '../ChatCardIcons';

interface EventInlineCardProps {
  event: CalendarEvent;
  onNavigateTab?: (tab: string) => void;
  onUndo?: () => void;
}

export const EventInlineCard: React.FC<EventInlineCardProps> = ({
  event,
  onNavigateTab,
  onUndo,
}) => {
  const [undone, setUndone] = useState(false);

  const startDate = new Date(event.start_at);
  const formattedDate = startDate.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  const startTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const formatDuration = (startAt: string, endAt?: string) => {
    if (!endAt) return '';
    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '';
    const mins = Math.round((end - start) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  const duration = formatDuration(event.start_at, event.end_at);
  const subtitle = `${formattedDate}, ${startTime}${duration ? ` (${duration})` : ''} · Google Agenda`;

  return (
    <div className={`mt-4 space-y-2.5 transition-all ${undone ? 'opacity-40' : ''}`}>
      {/* Card Principal */}
      <div className="p-4.5 rounded-[22px] bg-white dark:bg-[#12151A] border border-zinc-200 dark:border-[#222730] flex items-center gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
        {/* Chip Azul 44x44 com CalIcon */}
        <div className="w-11 h-11 rounded-2xl bg-[#e4effb] dark:bg-[#16283b] flex items-center justify-center shrink-0 shadow-2xs">
          <CalIcon color="#2b7fd4" size={22} />
        </div>

        {/* Informações do Evento */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
            {event.title}
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5 truncate font-medium">
            {subtitle}
          </p>
        </div>

        <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-[#e4effb] dark:bg-[#16283b] text-[#2b7fd4] dark:text-[#5aa2ee] uppercase tracking-wider shrink-0">
          {event.category || 'AGENDA'}
        </span>
      </div>

      {/* Botões de Ação em Pílula (Desfazer / Ver agenda) */}
      <div className="flex items-center gap-2 pl-1">
        <button
          type="button"
          onClick={() => {
            setUndone(true);
            onUndo?.();
          }}
          disabled={undone}
          className="px-4 py-1.5 rounded-full border border-zinc-200 dark:border-[#262B33] bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 text-xs font-bold text-zinc-600 dark:text-zinc-300 transition-colors"
        >
          {undone ? 'Cancelado' : 'Desfazer'}
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab?.('calendar')}
          className="px-4 py-1.5 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-xs font-bold transition-all shadow-2xs"
        >
          Ver agenda
        </button>
      </div>
    </div>
  );
};
