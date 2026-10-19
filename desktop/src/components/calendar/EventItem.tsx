import React from 'react';
import { CalendarEvent } from '../../types';
import { Clock, X, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EventItemProps {
  event: CalendarEvent;
  onDelete: (id: string) => void;
  badge: {
    label: string;
    border: string;
    bg: string;
    text: string;
    bar: string;
  };
}

export const EventItem: React.FC<EventItemProps> = ({ event, onDelete, badge }) => {
  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at);

  return (
    <div className="p-5 rounded-[24px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex items-center justify-between gap-4 shadow-xs group">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] flex flex-col items-center justify-center relative overflow-hidden shrink-0">
          <div className={`w-1.5 absolute left-0 top-0 bottom-0 ${badge.bar}`} />
          <span className="text-lg font-black text-zinc-900 dark:text-white tabular-nums leading-none">
            {format(startDate, 'd')}
          </span>
          <span className="text-[10px] uppercase font-bold text-zinc-500 mt-0.5">
            {format(startDate, 'MMM', { locale: ptBR })}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.border} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
          <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white truncate">
            {event.title}
          </h4>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2 mt-1 font-medium">
            <Clock size={14} />
            <span>
              {format(startDate, 'HH:mm')} – {format(endDate, 'HH:mm')}
            </span>
            {event.location && (
              <>
                <span>•</span>
                <span className="truncate">{event.location}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onDelete(event.id)}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-500/10"
          title="Excluir evento"
        >
          <X size={15} />
        </button>
        <ChevronRight size={16} className="text-zinc-400" />
      </div>
    </div>
  );
};
