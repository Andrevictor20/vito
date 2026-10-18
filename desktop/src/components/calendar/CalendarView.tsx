import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { CalendarEvent } from '../../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import { format, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);

  // New Event Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [creating, setCreating] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await api.getEvents();
      setEvents(data);
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startAt = `${dateStr}T${startTime}:00Z`;
      const endAt = `${dateStr}T${endTime}:00Z`;

      await api.createEvent({
        title,
        description,
        location,
        start_at: startAt,
        end_at: endAt,
        all_day: false,
      });

      setModalOpen(false);
      setTitle('');
      setDescription('');
      setLocation('');
      await fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar evento');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Deseja realmente remover este evento?')) return;
    try {
      await api.deleteEvent(id);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } catch (err: any) {
      alert(err.message || 'Erro ao remover evento');
    }
  };

  // Calendar calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { locale: ptBR });
  const endDate = endOfWeek(monthEnd, { locale: ptBR });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const selectedDateEvents = events.filter((ev) => {
    const evDate = new Date(ev.start_at);
    return isSameDay(evDate, selectedDate);
  });

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#0B0D10] overflow-hidden select-none">
      {/* Top Bar */}
      <header className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#14171C]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon size={20} className="text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Agenda Executiva</h2>
          </div>
          <div className="flex items-center gap-1 bg-[#0B0D10] border border-white/5 rounded-xl px-2 py-1">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold text-slate-200 px-2 capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => {
              setCurrentDate(new Date());
              setSelectedDate(new Date());
            }}
            className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors"
          >
            Hoje
          </button>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 py-2 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus size={15} />
          <span>Novo Compromisso</span>
        </button>
      </header>

      {/* Main Grid: Split Month & Selected Day */}
      <div className="flex-1 flex overflow-hidden">
        {/* Month Calendar Grid */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-slate-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr">
            {days.map((day) => {
              const dayEvents = events.filter((ev) => isSameDay(new Date(ev.start_at), day));
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentDay = isToday(day);
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[90px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500/50 shadow-sm'
                      : isCurrentDay
                      ? 'bg-[#1C2026] border-white/20'
                      : 'bg-[#14171C] border-white/5 hover:border-white/15'
                  } ${!isCurrentMonth ? 'opacity-35' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold tabular-nums w-6 h-6 rounded-full flex items-center justify-center ${
                        isCurrentDay ? 'bg-indigo-600 text-white' : 'text-slate-300'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Day mini preview tags */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#1C2026] text-slate-300 truncate border border-white/5"
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-slate-500 font-medium">
                        +{dayEvents.length - 2} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Selected Day Schedule Details */}
        <div className="w-80 border-l border-white/10 bg-[#14171C] p-6 flex flex-col overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white capitalize">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedDateEvents.length} compromisso(s) agendado(s)
            </p>
          </div>

          <div className="flex-1 space-y-3">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <Loader2 size={18} className="animate-spin text-indigo-400" />
                <span>Carregando agenda...</span>
              </div>
            ) : selectedDateEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-[#0B0D10]/50 rounded-2xl border border-white/5">
                Nenhum compromisso marcado para este dia.
              </div>
            ) : (
              selectedDateEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-xl bg-[#1C2026] border border-white/10 hover:border-white/20 transition-colors group relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-white leading-tight">{ev.title}</h4>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                      title="Excluir evento"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 tabular-nums">
                      <Clock size={12} className="text-indigo-400" />
                      <span>
                        {format(new Date(ev.start_at), 'HH:mm')} - {format(new Date(ev.end_at), 'HH:mm')}
                      </span>
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={12} className="text-slate-500" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#14171C] border border-white/10 rounded-2xl shadow-modal p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarIcon size={16} className="text-indigo-400" />
                Novo Compromisso
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Reunião com Diretoria"
                  required
                  className="w-full px-3 py-2 bg-[#0B0D10] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Início</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#0B0D10] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Término</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#0B0D10] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Local / Link</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Google Meet, Sala 4, etc."
                  className="w-full px-3 py-2 bg-[#0B0D10] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Notas adicionais do compromisso..."
                  className="w-full px-3 py-2 bg-[#0B0D10] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors flex items-center gap-1.5"
                >
                  {creating && <Loader2 size={13} className="animate-spin" />}
                  <span>Salvar Compromisso</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
