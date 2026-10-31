import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { WeeklySummaryItem } from '../../utils/weeklySummaryCalculator';

interface WeeklySummarySectionProps {
  weeklySummaries: WeeklySummaryItem[];
  onSelectWeek: (week: WeeklySummaryItem) => void;
}

export const WeeklySummarySection: React.FC<WeeklySummarySectionProps> = ({
  weeklySummaries,
  onSelectWeek,
}) => {
  const [expandedWeekId, setExpandedWeekId] = useState<string | null>(null);

  return (
    <div className="space-y-5 animate-rise">
      {/* Card Gráfico de Barras Semanais (.cols) */}
      <div className="p-7 rounded-[24px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold tracking-wider uppercase text-[#69706d] dark:text-[#98a19d]">
            Horas em compromissos por semana
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#ddf4e8] dark:bg-[#12302a] text-[#0b9a5f] dark:text-[#34d399] text-xs font-semibold">
            +1.8h vs semana anterior
          </span>
        </div>

        <div className="flex items-end gap-6 pt-4 h-36">
          {weeklySummaries.map((w) => {
            const h = Math.max(12, Math.min(100, (w.hours / 10) * 100));
            return (
              <div key={w.id} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-xs font-bold text-[#17191b] dark:text-[#f1f3f2]">
                  {w.hours}h
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all duration-500 ${
                    w.isCurrentWeek
                      ? 'bg-[#2b7fd4] dark:bg-[#5aa2ee]'
                      : 'bg-[#d2d7d4] dark:bg-[#2c3134]'
                  }`}
                  style={{ height: `${h}%` }}
                />
                <span className="text-[11px] text-[#69706d] dark:text-[#98a19d] truncate">
                  {w.period.split('–')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista de Ciclos Semanais Acordeão (.cyc) */}
      <div className="space-y-3">
        {weeklySummaries.map((week) => {
          const isOpen = expandedWeekId === week.id;
          return (
            <div
              key={week.id}
              className="rounded-[20px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] overflow-hidden transition-all shadow-sm"
            >
              <div
                onClick={() => setExpandedWeekId(isOpen ? null : week.id)}
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <b className="font-extrabold text-base text-[#17191b] dark:text-[#f1f3f2]">
                      Ciclo {week.period}
                    </b>
                    {week.isCurrentWeek && (
                      <span className="px-2 py-0.5 rounded-full bg-[#17191b] dark:bg-white text-white dark:text-[#0d0f10] text-[10px] font-bold uppercase">
                        Em andamento
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#69706d] dark:text-[#98a19d]">
                    {week.hours}h em compromissos • {week.eventsCount} eventos • {week.completedTodosCount} tarefas
                  </p>
                </div>

                <ChevronRight
                  size={18}
                  className={`text-[#69706d] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                />
              </div>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-[#d2d7d4]/60 dark:border-[#2c3134]/60 space-y-3">
                  <p className="text-sm text-[#17191b] dark:text-[#f1f3f2] leading-relaxed pt-2">
                    {week.narrative}
                  </p>

                  <button
                    onClick={() => onSelectWeek(week)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#0b9a5f] dark:text-[#00E599] hover:underline pt-1"
                  >
                    <span>Toque para abrir o Raio-X detalhado</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
