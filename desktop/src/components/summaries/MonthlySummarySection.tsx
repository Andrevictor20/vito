import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

interface MonthlyMetrics {
  resolutionRate: number;
  totalHours: number;
  workPercent: number;
  personalPercent: number;
  totalEvents: number;
  totalTodos: number;
}

interface MonthlySummarySectionProps {
  monthlyMetrics: MonthlyMetrics;
  onOpenMonthlyModal: () => void;
}

export const MonthlySummarySection: React.FC<MonthlySummarySectionProps> = ({
  monthlyMetrics,
  onOpenMonthlyModal,
}) => {
  return (
    <div className="space-y-5 animate-rise">
      {/* Bloco Eficácia Mensal com Anel Cônico SVG */}
      <div className="p-7 rounded-[24px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-[#69706d] dark:text-[#98a19d]">
            Eficácia Mensal
          </span>
          <span className="px-2.5 py-1 rounded-full bg-[#ddf4e8] dark:bg-[#12302a] text-[#0b9a5f] dark:text-[#34d399] text-xs font-semibold">
            Mês em curso
          </span>
        </div>

        <div className="flex items-center gap-8 pt-2">
          {/* Anel de Progresso Cônico SVG */}
          <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-[#f2f4f3] dark:text-[#191c1e]"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#0b9a5f] dark:text-[#00E599] transition-all duration-1000"
                strokeDasharray={`${monthlyMetrics.resolutionRate}, 100`}
                strokeLinecap="round"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-display font-black text-2xl text-[#17191b] dark:text-[#f1f3f2]">
                {monthlyMetrics.resolutionRate}%
              </span>
              <span className="text-[9px] uppercase font-bold text-[#69706d] dark:text-[#98a19d]">
                Eficácia
              </span>
            </div>
          </div>

          <div className="space-y-3 flex-1">
            <div>
              <span className="font-display font-extrabold text-3xl sm:text-4xl text-[#17191b] dark:text-[#f1f3f2] tracking-tight">
                {monthlyMetrics.totalHours}h
              </span>
              <p className="text-xs font-medium text-[#69706d] dark:text-[#98a19d] mt-0.5">
                Horas reais dedicadas a compromissos
              </p>
            </div>

            <div className="flex gap-4 text-xs font-semibold text-[#69706d] dark:text-[#98a19d]">
              <span>{monthlyMetrics.totalEvents} eventos</span>
              <span>•</span>
              <span>{monthlyMetrics.totalTodos} tarefas movimentadas</span>
            </div>
          </div>
        </div>

        {/* Botão para abrir o Raio-X Mensal correto */}
        <div
          onClick={onOpenMonthlyModal}
          className="pt-4 flex items-center justify-between text-xs sm:text-sm font-bold text-[#0b9a5f] dark:text-[#00E599] hover:underline cursor-pointer transition-colors border-t border-[#d2d7d4]/60 dark:border-[#2c3134]/60"
        >
          <span>Toque para abrir o Raio-X Mensal completo</span>
          <ChevronRight size={18} />
        </div>
      </div>

      {/* Bloco Diagnóstico com Síntese do Vito */}
      <div className="p-7 rounded-[24px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-[#0b9a5f] dark:text-[#00E599] text-xs font-bold uppercase tracking-wider">
          <Sparkles size={16} />
          <span>Diagnóstico Cognitivo</span>
        </div>
        <p className="text-sm sm:text-base text-[#17191b] dark:text-[#f1f3f2] leading-relaxed font-medium">
          Ciclo de alta produtividade com taxa de conclusão de {monthlyMetrics.resolutionRate}%. Seu foco foi direcionado estrategicamente, mantendo a dispersão abaixo da média.
        </p>
      </div>

      {/* Bloco Equilíbrio de Vida */}
      <div className="p-7 rounded-[24px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] shadow-sm space-y-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#69706d] dark:text-[#98a19d]">
          Equilíbrio de Vida
        </span>
        <div className="w-full h-3 rounded-full bg-[#f2f4f3] dark:bg-[#191c1e] overflow-hidden flex">
          <div
            style={{ width: `${monthlyMetrics.workPercent}%` }}
            className="h-full bg-[#2b7fd4] dark:bg-[#5aa2ee] transition-all"
            title={`Trabalho: ${monthlyMetrics.workPercent}%`}
          />
          <div
            style={{ width: `${monthlyMetrics.personalPercent}%` }}
            className="h-full bg-[#0b9a5f] dark:bg-[#00E599] transition-all"
            title={`Pessoal: ${monthlyMetrics.personalPercent}%`}
          />
        </div>
        <div className="flex items-center justify-between text-xs font-semibold pt-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2b7fd4] dark:bg-[#5aa2ee]" />
            <span className="text-[#17191b] dark:text-[#f1f3f2]">
              Trabalho ({monthlyMetrics.workPercent}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0b9a5f] dark:bg-[#00E599]" />
            <span className="text-[#17191b] dark:text-[#f1f3f2]">
              Pessoal ({monthlyMetrics.personalPercent}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
