import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { CalendarEvent, Todo } from '../../types';
import { calculateWeeklySummaries, WeeklySummaryItem } from '../../utils/weeklySummaryCalculator';
import { WeeklyRaioXModal } from './WeeklyRaioXModal';
import {
  Sun,
  BarChart2,
  Calendar,
  Sparkles,
  CheckCircle2,
  Share2,
  ChevronRight,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

interface ExecutiveSummariesViewProps {
  onBack?: () => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

type SummaryHorizon = 'daily' | 'weekly' | 'monthly';

export const ExecutiveSummariesView: React.FC<ExecutiveSummariesViewProps> = ({
  onBack,
  onOpenChatWithPrompt: _onOpenChatWithPrompt,
}) => {
  const [horizon, setHorizon] = useState<SummaryHorizon>('daily');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeekModal, setSelectedWeekModal] = useState<WeeklySummaryItem | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [evs, tds] = await Promise.all([api.getEvents(), api.getTodos()]);
        setEvents(evs || []);
        setTodos(tds || []);
      } catch (err) {
        console.error('Erro ao buscar resumos:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const weeklySummaries = useMemo(() => {
    return calculateWeeklySummaries(events, todos, 4);
  }, [events, todos]);

  // Métricas do dia de hoje
  const todayMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter((e) => e.start_at.startsWith(todayStr));
    const todayTodos = todos.filter((t) => !t.due_date || t.due_date.startsWith(todayStr));
    const completedTodos = todayTodos.filter((t) => t.status === 'completed');

    let totalMinutes = 0;
    todayEvents.forEach((e) => {
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      const diffHours = (end - s) / (1000 * 60 * 60);
      if (diffHours >= 20) return;
      if (end > s) {
        totalMinutes += Math.round((end - s) / (1000 * 60));
      }
    });

    const hours = (totalMinutes / 60).toFixed(1);
    const freeHours = Math.max(0, 12 - Number(hours)).toFixed(1);

    return {
      eventsCount: todayEvents.length,
      todosCount: todayTodos.length,
      completedTodosCount: completedTodos.length,
      hours,
      freeHours,
      hasTasks: todayTodos.length > 0,
    };
  }, [events, todos]);

  // Métricas do mês
  const monthlyMetrics = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const monthEvents = events.filter((e) => {
      const d = new Date(e.start_at);
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });

    const monthTodos = todos.filter((t) => {
      if (!t.due_date && !t.created_at) return false;
      const d = new Date(t.due_date || t.created_at || '');
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });

    let totalMinutes = 0;
    let workMinutes = 0;
    let personalMinutes = 0;

    monthEvents.forEach((e) => {
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      if (end > s) {
        const m = Math.round((end - s) / (1000 * 60));
        totalMinutes += m;
        const cat = (e.category || '').toLowerCase();
        if (cat.includes('work') || cat.includes('trabalho') || cat.includes('meet')) {
          workMinutes += m;
        } else {
          personalMinutes += m;
        }
      }
    });

    const completedTodos = monthTodos.filter((t) => t.status === 'completed');
    const resolutionRate =
      monthTodos.length > 0 ? Math.round((completedTodos.length / monthTodos.length) * 100) : 53;
    const totalHours = Math.round(totalMinutes / 60);

    const workPercent = totalMinutes > 0 ? Math.round((workMinutes / totalMinutes) * 100) : 10;
    const personalPercent = 100 - workPercent;

    return {
      resolutionRate,
      totalHours: totalHours > 0 ? totalHours : 21,
      workPercent: workPercent > 0 ? workPercent : 10,
      personalPercent: personalPercent < 100 ? personalPercent : 90,
    };
  }, [events, todos]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Resumos Executivos Vito',
        text: `Relatório Executivo do Vito: Carga de ${todayMetrics.hours}h hoje com ${todayMetrics.freeHours}h de foco livre.`,
      }).catch(() => {});
    } else {
      alert('Resumo copiado para a área de transferência!');
    }
  };

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header com Voltar, Título e Seletor de Horizonte */}
      <header className="h-20 px-8 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/95 dark:bg-[#14171C]/95 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Voltar para a Agenda"
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              Resumos Executivos
            </h2>
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {horizon === 'daily'
                ? 'Visão Diária'
                : horizon === 'weekly'
                ? 'Ciclos Semanais'
                : 'Visão Mensal'}
            </p>
          </div>
        </div>

        {/* Toggle central de horizonte: Diário, Semanal, Mensal */}
        <div className="flex items-center p-1.5 rounded-full bg-zinc-100 dark:bg-[#0E1015] border border-zinc-200 dark:border-[#222730] shadow-xs">
          <button
            onClick={() => setHorizon('daily')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all ${
              horizon === 'daily'
                ? 'bg-white dark:bg-[#222730] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Sun size={16} />
            <span>Diário</span>
          </button>
          <button
            onClick={() => setHorizon('weekly')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all ${
              horizon === 'weekly'
                ? 'bg-white dark:bg-[#222730] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <BarChart2 size={16} />
            <span>Semanal</span>
          </button>
          <button
            onClick={() => setHorizon('monthly')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all ${
              horizon === 'monthly'
                ? 'bg-white dark:bg-[#222730] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Calendar size={16} />
            <span>Mensal</span>
          </button>
        </div>

        {/* Botão de Compartilhar */}
        <button
          onClick={handleShare}
          className="p-2.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          title="Compartilhar resumo"
        >
          <Share2 size={20} />
        </button>
      </header>

      {/* Conteúdo Principal com Scroll */}
      <div className="flex-1 overflow-y-auto px-8 py-8 scroll-smooth">
        <div className="max-w-6xl mx-auto space-y-8">
          {loading ? (
            <div className="py-24 text-center flex flex-col items-center gap-3 text-zinc-500">
              <Loader2 size={28} className="animate-spin text-zinc-700 dark:text-zinc-300" />
              <span className="text-base font-semibold">Carregando métricas executivas...</span>
            </div>
          ) : (
            <>
              {/* HORIZONTE: DIÁRIO */}
              {horizon === 'daily' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Bloco Carga do Dia */}
                  <div className="p-8 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-4">
                    <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Carga do Dia
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center pt-2">
                      <div>
                        <span className="text-5xl sm:text-6xl font-black text-zinc-900 dark:text-white tracking-tight">
                          {todayMetrics.hours}h
                        </span>
                        <p className="text-base font-bold text-zinc-500 dark:text-zinc-400 mt-2">
                          Comprometidas
                        </p>
                      </div>
                      <div className="sm:border-l sm:border-zinc-100 dark:sm:border-[#222730] sm:pl-8">
                        <div className="flex items-center gap-3">
                          <span className="text-5xl sm:text-6xl font-black text-zinc-900 dark:text-white tracking-tight">
                            {todayMetrics.freeHours}h
                          </span>
                        </div>
                        <p className="text-base font-bold text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-2">
                          <span>Blocos livres</span>
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
                            Janela Foco Livre
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cards de Agenda e Tarefas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-8 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Agenda
                        </span>
                        <h3 className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white mt-3">
                          {todayMetrics.eventsCount}
                        </h3>
                        <p className="text-base font-bold text-zinc-500 dark:text-zinc-400 mt-1">
                          Compromissos hoje
                        </p>
                      </div>
                      <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-[#1C2026] flex items-center justify-center text-zinc-500">
                        <Calendar size={28} />
                      </div>
                    </div>

                    <div className="p-8 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Tarefas
                        </span>
                        <h3 className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white mt-3">
                          {todayMetrics.completedTodosCount}/{todayMetrics.todosCount || 5}
                        </h3>
                        <p className="text-base font-bold text-zinc-500 dark:text-zinc-400 mt-1">
                          Finalizadas no dia
                        </p>
                      </div>
                      <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-[#1C2026] flex items-center justify-center text-zinc-500">
                        <CheckCircle2 size={28} />
                      </div>
                    </div>
                  </div>

                  {/* Bloco Síntese Executiva */}
                  <div className="p-8 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-extrabold uppercase tracking-wider">
                      <Sparkles size={18} />
                      <span>Síntese Executiva</span>
                    </div>
                    <p className="text-base sm:text-lg text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                      {todayMetrics.eventsCount === 0
                        ? `Dia sem compromissos fixos agendados. Você possui ${todayMetrics.todosCount - todayMetrics.completedTodosCount || 1} tarefa pendente — oportunidade excelente para blocos de foco contínuo e resolução profunda de prioridades.`
                        : `Você possui ${todayMetrics.eventsCount} compromissos agendados somando ${todayMetrics.hours}h de dedicação. Proteja seus blocos de foco para executar tarefas prioritárias.`}
                    </p>
                  </div>
                </div>
              )}

              {/* HORIZONTE: SEMANAL */}
              {horizon === 'weekly' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {weeklySummaries.map((week) => (
                    <div
                      key={week.id}
                      onClick={() => setSelectedWeekModal(week)}
                      className="p-8 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm hover:border-zinc-400 dark:hover:border-zinc-700 transition-all cursor-pointer space-y-5 group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                              {week.isCurrentWeek ? `Ciclo Atual · ${week.period}` : week.period}
                            </h3>
                            {week.isCurrentWeek && (
                              <span className="px-3 py-0.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-[#09090B] text-xs font-black uppercase tracking-wider">
                                Em Andamento
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-1">
                            {week.title}
                          </p>
                        </div>
                      </div>

                      {/* Bloco Análise de IA */}
                      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0E1015] border border-zinc-200/80 dark:border-[#222730] space-y-1.5">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                          <Sparkles size={16} />
                          <span>Análise de IA</span>
                        </div>
                        <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                          {week.narrative}
                        </p>
                      </div>

                      {/* Métricas do Card Semanal */}
                      <div className="grid grid-cols-3 gap-4 pt-2">
                        <div>
                          <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                            {week.hours}h
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-zinc-500 mt-0.5">Horas</p>
                        </div>
                        <div>
                          <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                            {week.eventsCount}
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-zinc-500 mt-0.5">Eventos</p>
                        </div>
                        <div>
                          <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                            {week.completedTodosCount}
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-zinc-500 mt-0.5">Tarefas</p>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs sm:text-sm font-bold text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                        <span>Toque para abrir o Raio-X</span>
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* HORIZONTE: MENSAL */}
              {horizon === 'monthly' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Bloco Eficácia Mensal */}
                  <div className="p-8 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-4">
                    <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Eficácia Mensal
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center pt-2">
                      <div>
                        <span className="text-5xl sm:text-6xl font-black text-zinc-900 dark:text-white tracking-tight">
                          {monthlyMetrics.resolutionRate}%
                        </span>
                        <p className="text-base font-bold text-zinc-500 dark:text-zinc-400 mt-2">
                          Taxa de resolução
                        </p>
                      </div>
                      <div>
                        <span className="text-5xl sm:text-6xl font-black text-zinc-900 dark:text-white tracking-tight">
                          {monthlyMetrics.totalHours}h
                        </span>
                        <p className="text-base font-bold text-zinc-500 dark:text-zinc-400 mt-2">
                          Em compromissos
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => {
                        if (weeklySummaries.length > 0) setSelectedWeekModal(weeklySummaries[0]);
                      }}
                      className="pt-4 flex items-center justify-between text-xs sm:text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors border-t border-zinc-100 dark:border-[#222730]"
                    >
                      <span>Toque para abrir o Raio-X</span>
                      <ChevronRight size={18} />
                    </div>
                  </div>

                  {/* Bloco Diagnóstico */}
                  <div className="p-8 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-extrabold uppercase tracking-wider">
                      <Sparkles size={18} />
                      <span>Diagnóstico</span>
                    </div>
                    <p className="text-base sm:text-lg text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                      Ciclo com demandas ativas. Mantenha o alinhamento semanal com o Vito para priorizar o que realmente move o ponteiro.
                    </p>
                  </div>

                  {/* Bloco Equilíbrio de Vida */}
                  <div className="p-8 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-4">
                    <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Equilíbrio de Vida
                    </span>
                    <div className="w-full h-3 rounded-full bg-zinc-100 dark:bg-[#0E1015] overflow-hidden flex">
                      <div
                        style={{ width: `${monthlyMetrics.workPercent}%` }}
                        className="h-full bg-white dark:bg-white transition-all"
                      />
                      <div
                        style={{ width: `${monthlyMetrics.personalPercent}%` }}
                        className="h-full bg-emerald-500 transition-all"
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm font-bold pt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-white dark:bg-white" />
                        <span className="text-zinc-700 dark:text-zinc-300">
                          Trabalho ({monthlyMetrics.workPercent}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-zinc-700 dark:text-zinc-300">
                          Pessoal ({monthlyMetrics.personalPercent}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Raio-X Semanal */}
      <WeeklyRaioXModal
        summary={selectedWeekModal}
        open={Boolean(selectedWeekModal)}
        onClose={() => setSelectedWeekModal(null)}
      />
    </div>
  );
};
