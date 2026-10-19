import React from 'react';
import { WeeklySummaryItem } from '../../utils/weeklySummaryCalculator';
import { X, Sparkles, Award } from 'lucide-react';

interface WeeklyRaioXModalProps {
  summary: WeeklySummaryItem | null;
  open: boolean;
  onClose: () => void;
}

export const WeeklyRaioXModal: React.FC<WeeklyRaioXModalProps> = ({ summary, open, onClose }) => {
  if (!open || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] rounded-[28px] max-w-2xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header do Raio-X */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#222730] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                Raio-X Semanal
              </span>
              {summary.isCurrentWeek && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase">
                  Em Andamento
                </span>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1.5">
              {summary.period}
            </h3>
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {summary.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Métricas Principais em Destaque */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#0E1015] border border-zinc-200/80 dark:border-[#222730] text-center">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {summary.hours}h
            </span>
            <p className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-1">Horas</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#0E1015] border border-zinc-200/80 dark:border-[#222730] text-center">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {summary.eventsCount}
            </span>
            <p className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-1">Eventos</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#0E1015] border border-zinc-200/80 dark:border-[#222730] text-center">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {summary.completedTodosCount}
            </span>
            <p className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-1">Tarefas</p>
          </div>
        </div>

        {/* Análise de IA Narrativa */}
        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0E1015] border border-zinc-200/80 dark:border-[#222730] space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm font-bold uppercase tracking-wider">
            <Sparkles size={16} />
            <span>Análise Cognitiva Vito</span>
          </div>
          <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
            {summary.narrative}
          </p>
        </div>

        {/* Gráfico de Barras: Atividade Diária Seg a Dom */}
        <div className="space-y-3">
          <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
            Distribuição Diária de Carga
          </h4>
          <div className="grid grid-cols-7 gap-2 pt-4 pb-2 items-end h-32 px-3 bg-zinc-50 dark:bg-[#0E1015] rounded-2xl border border-zinc-200/80 dark:border-[#222730]">
            {summary.dailyActivity.map((day) => {
              const maxH = Math.max(...summary.dailyActivity.map((d) => d.hours), 1);
              const heightPercent = Math.max(Math.round((day.hours / maxH) * 100), 12);

              return (
                <div key={day.dateStr} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[11px] font-bold text-zinc-500">
                    {day.hours > 0 ? `${day.hours}h` : '-'}
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-lg transition-all ${
                      day.isToday
                        ? 'bg-red-500'
                        : day.isPeak
                        ? 'bg-zinc-900 dark:bg-white'
                        : day.hours > 0
                        ? 'bg-indigo-500/70'
                        : 'bg-zinc-200 dark:bg-zinc-800'
                    }`}
                  />
                  <span className={`text-xs font-bold ${day.isToday ? 'text-red-500' : 'text-zinc-500'}`}>
                    {day.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categorias de Tempo */}
        {summary.categories.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
              Concentração por Categoria
            </h4>
            <div className="space-y-2">
              {summary.categories.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
                    <span className="text-zinc-700 dark:text-zinc-300">{cat.name}</span>
                    <span className="text-zinc-500 font-mono">
                      {cat.hours}h ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-[#1E232B] overflow-hidden">
                    <div
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                      className="h-full rounded-full transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dicas Executivas */}
        {summary.tips.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-medium flex items-center gap-3">
            <Award size={20} className="shrink-0" />
            <span>{summary.tips[0].text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
