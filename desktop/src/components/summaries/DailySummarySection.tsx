import React from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { VitoMascot } from '../common/VitoMascot';

interface DailyMetrics {
  eventsCount: number;
  todosCount: number;
  completedTodosCount: number;
  hours: string;
  freeHours: string;
  firstEvent: string;
  firstEventTime: string;
}

interface DailySummarySectionProps {
  todayFormatted: string;
  todayMetrics: DailyMetrics;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

export const DailySummarySection: React.FC<DailySummarySectionProps> = ({
  todayFormatted,
  todayMetrics,
  onOpenChatWithPrompt,
}) => {
  return (
    <div className="space-y-5 animate-rise">
      {/* Card Carga do Dia (.card2) */}
      <div className="p-7 rounded-[24px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] shadow-sm space-y-4">
        <div className="text-xs font-semibold tracking-wider uppercase text-[#69706d] dark:text-[#98a19d]">
          Hoje · {todayFormatted}
        </div>

        <div className="grid grid-cols-2 gap-6 pt-1">
          <div>
            <div className="font-display font-extrabold text-4xl sm:text-5xl text-[#0b9a5f] dark:text-[#00E599] tracking-tight">
              {todayMetrics.freeHours}
              <span className="text-sm sm:text-base font-normal text-[#69706d] dark:text-[#98a19d] ml-1.5">
                h livres
              </span>
            </div>
          </div>
          <div>
            <div className="font-display font-extrabold text-4xl sm:text-5xl text-[#17191b] dark:text-[#f1f3f2] tracking-tight">
              {todayMetrics.hours}
              <span className="text-sm sm:text-base font-normal text-[#69706d] dark:text-[#98a19d] ml-1.5">
                h comprometida
              </span>
            </div>
          </div>
        </div>

        {/* Linha do Tempo Horizontal (.tl) */}
        <div className="mt-4">
          <div className="h-3.5 rounded-full overflow-hidden flex gap-1">
            <div className="bg-[#ddf4e8] dark:bg-[#12302a] flex-[4]" title="Foco livre" />
            <div className="bg-[#2b7fd4] dark:bg-[#5aa2ee] flex-[1]" title="Compromissos" />
            <div className="bg-[#ddf4e8] dark:bg-[#12302a] flex-[7]" title="Foco livre" />
          </div>
          <div className="flex justify-between text-xs text-[#69706d] dark:text-[#98a19d] mt-1.5 font-mono">
            <span>08:00</span>
            <span>12–13h</span>
            <span>20:00</span>
          </div>
        </div>

        {/* Janelas de Foco (.wins) */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="px-3 py-1 rounded-xl bg-[#ddf4e8] dark:bg-[#12302a] text-[#0b9a5f] dark:text-[#34d399] text-xs font-semibold">
            Foco 08:00–12:00 · 4h
          </span>
          <span className="px-3 py-1 rounded-xl bg-[#ddf4e8] dark:bg-[#12302a] text-[#0b9a5f] dark:text-[#34d399] text-xs font-semibold">
            Foco 13:00–20:00 · 7h
          </span>
        </div>
      </div>

      {/* Grid Agenda & Tarefas (.two) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Card Agenda */}
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2b7fd4] dark:text-[#5aa2ee]">
            <Calendar size={15} />
            <span>Agenda</span>
          </div>
          <div className="font-display font-extrabold text-3xl text-[#17191b] dark:text-[#f1f3f2] mt-3">
            {todayMetrics.eventsCount}
            <span className="text-sm font-normal text-[#69706d] dark:text-[#98a19d] ml-1.5">
              compromissos
            </span>
          </div>
          <p className="text-xs font-medium text-[#69706d] dark:text-[#98a19d] mt-2 truncate">
            {todayMetrics.firstEvent} · {todayMetrics.firstEventTime}
          </p>
        </div>

        {/* Card Tarefas */}
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7a4fe0] dark:text-[#a58bff]">
            <CheckCircle2 size={15} />
            <span>Tarefas</span>
          </div>
          <div className="font-display font-extrabold text-3xl text-[#17191b] dark:text-[#f1f3f2] mt-3">
            {todayMetrics.completedTodosCount}/{todayMetrics.todosCount}
            <span className="text-sm font-normal text-[#69706d] dark:text-[#98a19d] ml-1.5">
              feitas
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#f2f4f3] dark:bg-[#191c1e] mt-3 overflow-hidden">
            <div
              className="h-full bg-[#7a4fe0] dark:bg-[#a58bff] rounded-full transition-all duration-500"
              style={{ width: `${(todayMetrics.completedTodosCount / todayMetrics.todosCount) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card Sugestão Inteligente do Vito */}
      <div className="p-7 rounded-[28px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] shadow-sm flex items-start gap-5">
        <VitoMascot size={52} animated={true} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#69706d] dark:text-[#98a19d] mb-1.5">
            Vito
          </div>
          <p className="text-sm sm:text-base text-[#17191b] dark:text-[#f1f3f2] leading-relaxed font-medium">
            Dia leve: {todayMetrics.eventsCount} compromisso ({todayMetrics.hours}h) e {todayMetrics.freeHours}h livres. Boa hora para avançar nas tarefas que faltam.
          </p>
          <div className="flex items-center gap-3 mt-4.5">
            <button
              onClick={() => onOpenChatWithPrompt?.('Reserva um bloco de foco de 2h na minha agenda')}
              className="h-10 px-5 rounded-full bg-[#17191b] dark:bg-white text-white dark:text-[#0d0f10] text-sm font-bold hover:opacity-90 hover:scale-105 active:scale-95 transition-all shadow-xs"
            >
              Reservar foco
            </button>
            <button
              onClick={() => onOpenChatWithPrompt?.('Quais são as tarefas prioritárias de hoje?')}
              className="h-10 px-5 rounded-full border border-[#d2d7d4] dark:border-[#2c3134] text-[#17191b] dark:text-[#f1f3f2] text-sm font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all shadow-2xs"
            >
              Ver tarefas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
