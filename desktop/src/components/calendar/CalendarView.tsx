import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { CalendarEvent } from '../../types';
import { MonthGrid } from './MonthGrid';
import { CalendarEventsSidebar } from './CalendarEventsSidebar';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  PanelRightClose,
  PanelRightOpen,
  BarChart2,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarViewProps {
  onNavigateToSummaries?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onNavigateToSummaries }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [_loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [syncingGoogle, setSyncingGoogle] = useState(false);

  // Quick Event Quick-Add (Zero Modais)
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('14:00');
  const [creatingEvent, setCreatingEvent] = useState(false);

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

  const handleSyncGoogle = async () => {
    setSyncingGoogle(true);
    try {
      await api.syncCalendar('google');
      await fetchEvents();
    } catch (err) {
      console.warn('Sync google calendar:', err);
    } finally {
      setSyncingGoogle(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    api.syncCalendar('google').then(() => fetchEvents()).catch(() => {});
  }, []);

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Deseja realmente remover este evento?')) return;
    try {
      await api.deleteEvent(id);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } catch (err: any) {
      alert(err.message || 'Erro ao remover evento');
    }
  };

  const handleCreateQuickEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newEventTitle.trim();
    if (!title) return;

    setCreatingEvent(true);
    try {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const startAt = `${year}-${month}-${day}T${newEventTime || '12:00'}:00Z`;

      const created = await api.createEvent({
        title,
        start_at: startAt,
        category: 'EVENTO',
      });
      setEvents((prev) => [...prev, created]);
      setNewEventTitle('');
      setIsAddingEvent(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar compromisso');
    } finally {
      setCreatingEvent(false);
    }
  };

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-[#17191b] dark:text-[#f1f3f2] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header estilo Toki com Montserrat 800 */}
      <header className="h-20 px-8 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/95 dark:bg-[#14171C]/95 backdrop-blur-md z-10 shrink-0">
        {/* Esquerda: Botão Hoje + Setas + Título do Mês */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const now = new Date();
              setCurrentDate(now);
              setSelectedDate(now);
            }}
            className="px-4 py-2 rounded-full border border-zinc-200 dark:border-[#262B33] bg-zinc-50 hover:bg-zinc-100 dark:bg-[#1C2026] dark:hover:bg-[#222730] text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors shadow-2xs"
          >
            Hoje
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#17191b] dark:text-[#f1f3f2] capitalize ml-2 tracking-tight">
            {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
        </div>

        {/* Direita: Botão Resumos, + Novo evento (Zero Modais), Sync Google, Toggle Dia/Semana/Mês e Sidebar */}
        <div className="flex items-center gap-3">
          {onNavigateToSummaries && (
            <button
              onClick={onNavigateToSummaries}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors shadow-2xs"
              title="Abrir Resumos Executivos"
            >
              <BarChart2 size={15} className="text-[#2b7fd4] dark:text-[#5aa2ee]" />
              <span>Resumos</span>
            </button>
          )}

          {/* Botão Zero-Modais: Novo Evento Rápido */}
          <button
            onClick={() => setIsAddingEvent(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-xs font-bold shadow-sm transition-all"
          >
            <Plus size={15} />
            <span>Novo evento</span>
          </button>

          {/* Sincronizar Google */}
          <button
            onClick={handleSyncGoogle}
            disabled={syncingGoogle}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shadow-2xs disabled:opacity-50"
            title="Sincronizar com Google Calendar"
          >
            <RefreshCw size={13} className={`text-zinc-400 ${syncingGoogle ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Google</span>
          </button>

          {/* Toggle de visão: Dia / Semana / Mês */}
          <div className="flex items-center p-1 rounded-full bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#222730] text-xs">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-full font-bold transition-all ${
                  viewMode === mode
                    ? 'bg-white dark:bg-[#262B33] text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>

          {/* Botão Alternar Barra Lateral */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2.5 rounded-full border border-zinc-200 dark:border-[#222730] hover:bg-zinc-100 dark:hover:bg-[#1C2026] text-zinc-600 dark:text-zinc-300 transition-colors"
            title={sidebarOpen ? 'Ocultar agenda do dia' : 'Exibir agenda do dia'}
          >
            {sidebarOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
        </div>
      </header>

      {/* Barra Rápida de Adição de Evento (Zero Modais) */}
      {isAddingEvent && (
        <form
          onSubmit={handleCreateQuickEvent}
          className="px-8 py-3 bg-[#e4effb] dark:bg-[#16283b] border-b border-[#2b7fd4]/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
        >
          <div className="w-6 h-6 rounded-full bg-[#2b7fd4]/20 text-[#2b7fd4] dark:text-[#5aa2ee] flex items-center justify-center shrink-0">
            <Sparkles size={14} />
          </div>

          <input
            type="text"
            placeholder={`Novo compromisso para ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}...`}
            value={newEventTitle}
            onChange={(e) => setNewEventTitle(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none"
          />

          <input
            type="time"
            value={newEventTime}
            onChange={(e) => setNewEventTime(e.target.value)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-[#0B0D10] text-xs font-semibold text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 outline-none"
          />

          <button
            type="submit"
            disabled={creatingEvent || !newEventTitle.trim()}
            className="px-4 py-1.5 rounded-full bg-[#17191b] dark:bg-white text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-40"
          >
            {creatingEvent ? <Loader2 size={13} className="animate-spin" /> : 'Confirmar'}
          </button>

          <button
            type="button"
            onClick={() => setIsAddingEvent(false)}
            className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </form>
      )}

      {/* Corpo: Grade Principal + Barra Lateral */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <MonthGrid
            currentDate={currentDate}
            selectedDate={selectedDate}
            events={events}
            onSelectDate={(date) => {
              setSelectedDate(date);
              if (!sidebarOpen) setSidebarOpen(true);
            }}
            onDoubleClickDate={(date) => {
              setSelectedDate(date);
              setIsAddingEvent(true);
            }}
          />
        </main>

        {sidebarOpen && (
          <CalendarEventsSidebar
            currentDate={currentDate}
            selectedDate={selectedDate}
            events={events}
            onSelectDate={setSelectedDate}
            onOpenCreateModal={() => setIsAddingEvent(true)}
            onDeleteEvent={handleDeleteEvent}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
};
