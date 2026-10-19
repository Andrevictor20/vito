import React, { useState } from 'react';
import { CalendarEvent } from '../../types';
import { EventItem } from './EventItem';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  X,
  Clock,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarEventsSidebarProps {
  currentDate: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onOpenCreateModal: () => void;
  onDeleteEvent: (id: string) => void;
  onCloseSidebar?: () => void;
}

export const CalendarEventsSidebar: React.FC<CalendarEventsSidebarProps> = ({
  currentDate,
  selectedDate,
  events,
  onSelectDate,
  onOpenCreateModal,
  onDeleteEvent,
  onCloseSidebar,
}) => {
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(currentDate);
  const [searchQuery, setSearchQuery] = useState('');

  // Mini-mês cálculos
  const monthStart = startOfMonth(miniCalendarMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1, locale: ptBR });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1, locale: ptBR });
  const miniDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getCategoryBadge = (cat?: string) => {
    const upper = (cat || 'EVENTO').toUpperCase();
    if (upper.includes('MEET')) {
      return { label: 'MEETING', border: 'border-sky-500/30', bg: 'bg-sky-500/15', text: 'text-sky-500 dark:text-sky-400', bar: 'bg-sky-500' };
    }
    if (upper.includes('ESTUD') || upper.includes('AULA')) {
      return { label: 'ESTUDO', border: 'border-indigo-500/30', bg: 'bg-indigo-500/15', text: 'text-indigo-500 dark:text-indigo-400', bar: 'bg-indigo-500' };
    }
    if (upper.includes('FERIAD')) {
      return { label: 'FERIADO', border: 'border-amber-500/30', bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
    }
    if (upper.includes('GOOG')) {
      return { label: 'GOOGLE', border: 'border-red-500/30', bg: 'bg-red-500/15', text: 'text-red-500 dark:text-red-400', bar: 'bg-red-500' };
    }
    return { label: upper, border: 'border-zinc-400/30 dark:border-zinc-500/30', bg: 'bg-zinc-500/10', text: 'text-zinc-600 dark:text-zinc-400', bar: 'bg-zinc-400' };
  };

  const filteredEvents = events.filter((ev) => {
    if (!searchQuery.trim()) return true;
    return (
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.description && ev.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ev.category && ev.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const selectedDayEvents = filteredEvents.filter((ev) =>
    isSameDay(new Date(ev.start_at), selectedDate)
  );

  const upcomingEvents = filteredEvents.filter(
    (ev) =>
      new Date(ev.start_at) >= new Date() &&
      !isSameDay(new Date(ev.start_at), selectedDate)
  );

  return (
    <aside className="w-88 xl:w-[410px] h-full flex flex-col bg-white dark:bg-[#14171C] border-l border-zinc-200 dark:border-[#222730] shrink-0 overflow-hidden select-none transition-colors duration-200">
      {/* Header da Sidebar Direita */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-[#222730] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CalendarIcon size={18} className="text-zinc-500 dark:text-zinc-400" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">Eventos & Agenda</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCreateModal}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] transition-colors shadow-xs"
            title="Novo evento"
          >
            <Plus size={16} />
          </button>
          {onCloseSidebar && (
            <button
              onClick={onCloseSidebar}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Ocultar barra de eventos"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo com Scroll da Barra Direita */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
        {/* Mini Calendário do Mês Toki com tamanho ampliado */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-[#0E1015] border border-zinc-200/80 dark:border-[#222730]">
          {/* Navegação do mini-mês */}
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
              {format(miniCalendarMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMiniCalendarMonth(subMonths(miniCalendarMonth, 1))}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/10 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setMiniCalendarMonth(addMonths(miniCalendarMonth, 1))}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/10 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Dias da semana no mini-mês */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-zinc-400 dark:text-zinc-500 mb-2">
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grade de dias no mini-mês */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {miniDays.map((day) => {
              const dayEvs = events.filter((ev) => isSameDay(new Date(ev.start_at), day));
              const isSelected = isSameDay(day, selectedDate);
              const isCurDay = isToday(day);
              const hasEvents = dayEvs.length > 0;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(day)}
                  className={`h-8 w-full flex flex-col items-center justify-center rounded-xl text-xs sm:text-sm transition-all relative ${
                    isCurDay
                      ? 'bg-red-500 text-white font-bold shadow-xs'
                      : isSelected
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-[#09090B] font-bold'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="font-semibold">{format(day, 'd')}</span>
                  {hasEvents && !isCurDay && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] absolute bottom-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Input de Busca Rápida na lateral */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#0E1015] border border-zinc-200/80 dark:border-[#222730]">
          <Search size={16} className="text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar eventos..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />
        </div>

        {/* Seção: Eventos da Data Selecionada */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
                {isToday(selectedDate)
                  ? 'Hoje'
                  : format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {format(selectedDate, "d 'de' MMMM yyyy", { locale: ptBR })}
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-100 dark:bg-[#1E232B] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-[#222730]">
              {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'evento' : 'eventos'}
            </span>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0E1015] border border-zinc-200/80 dark:border-[#222730] flex items-center gap-3.5 text-sm text-zinc-500 dark:text-zinc-400">
              <Clock size={18} className="text-zinc-400 shrink-0" />
              <div>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Dia Livre</p>
                <p className="text-xs mt-0.5">Nenhum compromisso marcado para este dia.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedDayEvents.map((ev) => (
                <EventItem
                  key={ev.id}
                  event={ev}
                  badge={getCategoryBadge(ev.category)}
                  onDelete={onDeleteEvent}
                />
              ))}
            </div>
          )}
        </div>

        {/* Seção: Próximos Compromissos na Agenda */}
        {upcomingEvents.length > 0 && (
          <div className="space-y-3.5 pt-4 border-t border-zinc-100 dark:border-[#222730]">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                Próximos compromissos
              </h4>
              <span className="text-xs text-zinc-500 font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-[#1E232B]">
                {upcomingEvents.length} no total
              </span>
            </div>
            <div className="space-y-2.5">
              {upcomingEvents.slice(0, 6).map((ev) => (
                <EventItem
                  key={ev.id}
                  event={ev}
                  badge={getCategoryBadge(ev.category)}
                  onDelete={onDeleteEvent}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
