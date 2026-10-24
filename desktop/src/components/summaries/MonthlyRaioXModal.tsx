import React from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  Clock,
  CheckCircle2,
  PieChart,
} from 'lucide-react';

interface MonthlyMetrics {
  totalHours: string | number;
  totalEvents: number;
  totalTodos: number;
  completionRate: number;
  workRatio: number;
  personalRatio: number;
}

interface MonthlyTip {
  category: string;
  text: string;
}

interface MonthlyRaioXModalProps {
  visible: boolean;
  onClose: () => void;
  monthlyMetrics: MonthlyMetrics;
  monthlyTips?: MonthlyTip[];
  subtitle?: string;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

export const MonthlyRaioXModal: React.FC<MonthlyRaioXModalProps> = ({
  visible,
  onClose,
  monthlyMetrics,
  monthlyTips = [
    {
      category: 'Proteção de Janelas',
      text: 'Você concentrou suas reuniões nas terças e quintas. Mantenha as quartas livres para foco profundo.',
    },
    {
      category: 'Equilíbrio Pessoal',
      text: 'Excelente divisão entre compromissos pessoais e executivos. O índice de tarefas fechadas manteve alta constância.',
    },
    {
      category: 'Otimização de Duração',
      text: 'Reuniões de 30 minutos geraram o mesmo alinhamento com metade da fadiga cognitiva.',
    },
  ],
  subtitle = 'Auditoria do ciclo mensal',
  onOpenChatWithPrompt,
}) => {
  if (!visible) return null;

  const handleAskVito = () => {
    onClose();
    if (onOpenChatWithPrompt) {
      onOpenChatWithPrompt(
        `Analise meu desempenho executivo mensal: foram ${monthlyMetrics.totalHours} horas reais em compromissos, taxa de resolução de ${monthlyMetrics.completionRate}%, e foco dividido em ${monthlyMetrics.workRatio}% trabalho e ${monthlyMetrics.personalRatio}% pessoal. O que posso otimizar?`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#14171C] border border-[#d2d7d4] dark:border-[#2c3134] rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-[#d2d7d4] dark:border-[#2c3134] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={12} />
                Sem Distorção 24h
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-[#17191b] dark:text-[#f1f3f2] tracking-tight mt-1">
              Raio-X Mensal
            </h3>
            <p className="text-xs text-[#69706d] dark:text-[#98a19d] mt-0.5">{subtitle}</p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Bento Narrative Box */}
          <div className="p-5 rounded-2xl bg-[#f2f4f3] dark:bg-[#07090b] border border-[#d2d7d4] dark:border-[#2c3134] space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0b9a5f] dark:text-[#00E599]">
              <Sparkles size={14} />
              <span>Diagnóstico do Mês</span>
            </div>
            <p className="text-sm text-[#17191b] dark:text-[#f1f3f2] leading-relaxed">
              Neste ciclo você registrou <b className="font-extrabold">{monthlyMetrics.totalHours} horas reais</b> em compromissos, com taxa de resolução de tarefas em <b className="font-extrabold">{monthlyMetrics.completionRate}%</b>. Seu tempo foi dividido em {monthlyMetrics.workRatio}% trabalho e {monthlyMetrics.personalRatio}% vida pessoal.
            </p>
          </div>

          {/* Métricas Resumidas em 3 Mini Bento Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#191c1e] border border-[#d2d7d4] dark:border-[#2c3134]">
              <div className="flex items-center gap-1 text-[11px] text-[#69706d] dark:text-[#98a19d]">
                <Clock size={12} /> Carga
              </div>
              <div className="font-display font-extrabold text-lg text-[#17191b] dark:text-[#f1f3f2] mt-1">
                {monthlyMetrics.totalHours}h
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-[#191c1e] border border-[#d2d7d4] dark:border-[#2c3134]">
              <div className="flex items-center gap-1 text-[11px] text-[#69706d] dark:text-[#98a19d]">
                <CheckCircle2 size={12} /> Eficácia
              </div>
              <div className="font-display font-extrabold text-lg text-emerald-500 mt-1">
                {monthlyMetrics.completionRate}%
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-[#191c1e] border border-[#d2d7d4] dark:border-[#2c3134]">
              <div className="flex items-center gap-1 text-[11px] text-[#69706d] dark:text-[#98a19d]">
                <PieChart size={12} /> Trabalho
              </div>
              <div className="font-display font-extrabold text-lg text-sky-500 mt-1">
                {monthlyMetrics.workRatio}%
              </div>
            </div>
          </div>

          {/* Recomendações do Vito */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#69706d] dark:text-[#98a19d] uppercase tracking-wider">
              Recomendações do Vito
            </h4>

            {monthlyTips.map((tip, idx) => (
              <div
                key={tip.category}
                className="p-4 rounded-xl bg-[#f2f4f3] dark:bg-[#07090b] border border-[#d2d7d4] dark:border-[#2c3134] flex items-start gap-3"
              >
                <span className="font-mono text-xs font-bold text-[#0b9a5f] dark:text-[#00E599] shrink-0 mt-0.5">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <b className="block text-xs font-bold text-[#17191b] dark:text-[#f1f3f2]">
                    {tip.category}
                  </b>
                  <p className="text-xs text-[#69706d] dark:text-[#98a19d] mt-0.5 leading-relaxed">
                    {tip.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#d2d7d4] dark:border-[#2c3134] flex items-center justify-between bg-zinc-50/50 dark:bg-[#0d0f10]/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#69706d] dark:text-[#98a19d] hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            Fechar
          </button>

          <button
            onClick={handleAskVito}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#17191b] dark:bg-white text-white dark:text-[#0d0f10] text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
          >
            <MessageSquare size={14} />
            <span>Discutir no chat com o Vito</span>
          </button>
        </div>
      </div>
    </div>
  );
};
