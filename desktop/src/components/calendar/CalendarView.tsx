import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { CalendarEvent } from '../../types';
import { CreateItemModal } from '../common/CreateItemModal';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [syncingGoogle, setSyncingGoogle] = useState(false);

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
    // Dispara sincronização em segundo plano no boot da tela
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

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header estilo Toki com fontes maiores */}
      <header className="h-20 px-8 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/95 dark:bg-[#14171C]/95 backdrop-blur-md z-10 shrink-0">
        {/* Esquerda: Botão Hoje + Setas + Título do Mês */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const now = new Date();
              setCurrentDate(now);
              setSelectedDate(now);
            }}
            className="px-4 py-2 rounded-full border border-zinc-200 dark:border-[#262B33] bg-zinc-50 hover:bg-zinc-100 dark:bg-[#1C2026] dark:hover:bg-[#222730] text-sm font-bold text-zinc-800 dark:text-zinc-200 transition-colors shadow-2xs"
          >
            Hoje
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white capitalize ml-2 tracking-tight">
            {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
        </div>

        {/* Direita: Botão Resumos, + Novo evento, Sincronizar Google, Toggle Dia/Semana/Mês e Barra Lateral */}
        <div className="flex items-center gap-3">
          {/* Botão Resumos Executivos */}
          {onNavigateToSummaries && (
            <button
              onClick={onNavigateToSummaries}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-sm font-bold text-zinc-800 dark:text-zinc-200 transition-colors shadow-2xs"
              title="Abrir Resumos Executivos"
            >
              <BarChart2 size={16} className="text-indigo-500" />
              <span>Resumos</span>
            </button>
          )}

          {/* Botão + Novo evento */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-sm font-bold shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>Novo evento</span>
          </button>

          {/* Sincronizar Google */}
          <button
            onClick={handleSyncGoogle}
            disabled={syncingGoogle}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shadow-2xs disabled:opacity-50"
            title="Sincronizar com Google Calendar"
          >
            <RefreshCw size={14} className={`text-zinc-400 ${syncingGoogle ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Google</span>
          </button>

          {/* Toggle de visão: Dia / Semana / Mês estilo Toki */}
          <div className="flex items-center p-1.5 rounded-full bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#222730] text-sm">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-[#262B33] text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Dia
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-[#262B33] text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-[#262B33] text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Mês
            </button>
          </div>

          {/* Toggle da Barra Lateral Direita de Eventos */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2.5 rounded-full border transition-colors ${
              sidebarOpen
                ? 'bg-zinc-100 dark:bg-[#1C2026] text-zinc-900 dark:text-white border-zinc-200 dark:border-[#222730]'
                : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-transparent hover:bg-zinc-100 dark:hover:bg-[#1C2026]'
            }`}
            title={sidebarOpen ? 'Ocultar barra de eventos' : 'Mostrar barra de eventos'}
          >
            {sidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>
      </header>

      {/* Área Central: Grade Completa do Mês ocupando a maior parte + Barra Lateral Direita */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Grade do Mês ocupando a maior parte da tela estilo Toki */}
        <div className="flex-1 h-full min-w-0 flex flex-col">
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
              setModalOpen(true);
            }}
          />
        </div>

        {/* Barra de Eventos listando na LATERAL DIREITA */}
        {sidebarOpen && (
          <CalendarEventsSidebar
            currentDate={currentDate}
            selectedDate={selectedDate}
            events={events}
            onSelectDate={(date) => setSelectedDate(date)}
            onOpenCreateModal={() => setModalOpen(true)}
            onDeleteEvent={handleDeleteEvent}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
        )}
      </div>

      {/* Modal Unificado de Criação de Evento e Tarefa */}
      <CreateItemModal
        open={modalOpen}
        selectedDate={selectedDate}
        defaultTab="event"
        onClose={() => setModalOpen(false)}
        onCreated={fetchEvents}
      />
    </div>
  );
};
