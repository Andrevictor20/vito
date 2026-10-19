import React from 'react';
import { CalendarEvent } from '../../types';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isSameMonth,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthGridProps {
  currentDate: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onDoubleClickDate: (date: Date) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
}

export const MonthGrid: React.FC<MonthGridProps> = ({
  currentDate,
  selectedDate,
  events,
  onSelectDate,
  onDoubleClickDate,
  onSelectEvent,
}) => {
  // Configuração da semana iniciando na Segunda-feira (weekStartsOn: 1), idêntica ao Toki
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1, locale: ptBR });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1, locale: ptBR });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const daysOfWeek = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

  const getEventBadgeStyle = (ev: CalendarEvent) => {
    const cat = (ev.category || '').toUpperCase();
    const title = ev.title.toUpperCase();

    if (cat.includes('MEET') || title.includes('REUNIÃO') || title.includes('CALL')) {
      return {
        bg: 'bg-sky-500/10 dark:bg-sky-500/15 border-sky-500/20 text-sky-700 dark:text-sky-300',
        dot: 'bg-sky-500',
        isHoliday: false,
      };
    }
    if (cat.includes('ESTUD') || cat.includes('AULA') || title.includes('AULA') || title.includes('CURSO')) {
      return {
        bg: 'bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/20 text-indigo-700 dark:text-indigo-300',
        dot: 'bg-indigo-500',
        isHoliday: false,
      };
    }
    if (cat.includes('FERIAD') || title.includes('FERIADO') || title.includes('DIA DO') || title.includes('NOSSA SENHORA')) {
      return {
        bg: 'bg-teal-500/15 dark:bg-teal-950/40 border-teal-500/30 text-teal-800 dark:text-teal-300',
        dot: 'bg-teal-500',
        isHoliday: true,
      };
    }
    if (cat.includes('GOOG') || ev.source === 'google') {
      return {
        bg: 'bg-red-500/10 dark:bg-red-500/15 border-red-500/20 text-red-700 dark:text-red-300',
        dot: 'bg-red-500',
        isHoliday: false,
      };
    }
    return {
      bg: 'bg-zinc-100 dark:bg-[#1E232B] border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-200',
      dot: 'bg-zinc-400',
      isHoliday: false,
    };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0E1015] select-none overflow-hidden transition-colors duration-200">
      {/* Cabeçalho com dias da semana (S T Q Q S S D) */}
      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-[#222730] text-center text-sm font-bold text-zinc-600 dark:text-zinc-300 py-3.5 bg-zinc-50 dark:bg-[#14171C]">
        {daysOfWeek.map((day, idx) => (
          <div key={idx} className="tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Grade Mensal Completa com células expansíveis */}
      <div className="flex-1 grid grid-cols-7 grid-flow-row auto-rows-fr divide-x divide-y divide-zinc-200/80 dark:divide-[#222730] border-b border-zinc-200 dark:border-[#222730] overflow-y-auto">
        {days.map((day) => {
          const isCurDay = isToday(day);
          const isSelected = isSameDay(day, selectedDate);
          const isCurMonth = isSameMonth(day, currentDate);
          const dayEvents = events.filter((ev) => isSameDay(new Date(ev.start_at), day));

          const MAX_DISPLAY_EVENTS = 3;
          const visibleEvents = dayEvents.slice(0, MAX_DISPLAY_EVENTS);
          const hiddenCount = dayEvents.length - MAX_DISPLAY_EVENTS;

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              onDoubleClick={() => onDoubleClickDate(day)}
              className={`p-2.5 xl:p-3 flex flex-col justify-between transition-colors relative cursor-pointer min-h-[115px] xl:min-h-[135px] group ${
                !isCurMonth
                  ? 'bg-zinc-50/50 dark:bg-[#0B0D10]/50 text-zinc-400 dark:text-zinc-600'
                  : 'bg-white dark:bg-[#0E1015] hover:bg-zinc-50/80 dark:hover:bg-white/[0.03]'
              } ${
                isSelected
                  ? 'ring-2 ring-inset ring-zinc-900 dark:ring-white bg-zinc-100/60 dark:bg-white/[0.05]'
                  : ''
              }`}
            >
              {/* Topo da Célula: Dia do Mês + Hora se for Hoje */}
              <div className="flex items-center justify-between mb-2">
                {isCurDay ? (
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-red-500 text-white font-bold flex items-center justify-center text-xs xl:text-sm shadow-xs">
                      {format(day, 'd')}
                    </span>
                    <span className="text-xs font-bold text-red-500/90 dark:text-red-400">
                      {format(new Date(), 'HH:mm')}
                    </span>
                  </div>
                ) : (
                  <span
                    className={`text-sm xl:text-base font-bold transition-colors ${
                      isCurMonth
                        ? 'text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white'
                        : 'text-zinc-400/60 dark:text-zinc-600'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                )}

                {/* Tag de Mês de transição se for o dia 1 de outro mês */}
                {format(day, 'd') === '1' && (
                  <span className="text-xs uppercase font-extrabold text-zinc-400 dark:text-zinc-500">
                    {format(day, 'MMM', { locale: ptBR })}
                  </span>
                )}
              </div>

              {/* Eventos inseridos na célula como Chips estilo Toki com fontes maiores */}
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {visibleEvents.map((ev) => {
                  const style = getEventBadgeStyle(ev);
                  const timeFormatted = format(new Date(ev.start_at), 'HH:mm');

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDate(day);
                        if (onSelectEvent) onSelectEvent(ev);
                      }}
                      className={`px-2 xl:px-2.5 py-1 xl:py-1.5 rounded-lg border text-xs xl:text-sm font-semibold truncate flex items-center gap-2 transition-all shadow-2xs hover:brightness-105 ${style.bg}`}
                      title={`${ev.title} (${timeFormatted})`}
                    >
                      {!style.isHoliday && (
                        <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                      )}
                      {!ev.all_day && !style.isHoliday && (
                        <span className="text-xs opacity-85 shrink-0 font-mono font-semibold">
                          {timeFormatted}
                        </span>
                      )}
                      <span className="truncate">{ev.title}</span>
                    </div>
                  );
                })}

                {/* Indicador de mais eventos ocultos */}
                {hiddenCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(day);
                    }}
                    className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white px-2 py-0.5 rounded-md hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors inline-block"
                  >
                    +{hiddenCount} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
