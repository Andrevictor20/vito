import React, { useState } from 'react';
import { Trigger } from '../../types';
import { Clock, MoreVertical, Edit3, Trash2, ArrowRight } from 'lucide-react';

interface RadarCardProps {
  trigger: Trigger;
  onSelect: (trigger: Trigger) => void;
  onToggle: (trigger: Trigger) => void;
  onEdit: (trigger: Trigger) => void;
  onDelete: (trigger: Trigger) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  career: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
  finance: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  public_exams: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
  real_estate: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
  travel: { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/20' },
  tech: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20' },
  news: { bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20' },
  taxes_docs: { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20' },
};

export const RadarCard: React.FC<RadarCardProps> = ({
  trigger,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = trigger.status === 'active';
  const catStyle = CATEGORY_COLORS[trigger.category] || {
    bg: 'bg-zinc-100 dark:bg-[#0B0D10]',
    text: 'text-zinc-600 dark:text-zinc-400',
    border: 'border-zinc-200 dark:border-[#222730]',
  };

  return (
    <div
      onClick={() => onSelect(trigger)}
      className="group relative p-5 rounded-[24px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] hover:border-zinc-400 dark:hover:border-zinc-600 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Top Header of Card */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border capitalize ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
            >
              {trigger.category}
            </span>
            {isActive ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
                Ativo
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Pausado
              </span>
            )}
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Quick Switch */}
            <button
              type="button"
              onClick={() => onToggle(trigger)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                isActive ? 'bg-[#10B981]' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
              title={isActive ? 'Pausar radar' : 'Ativar radar'}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  isActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            {/* Menu More */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              >
                <MoreVertical size={16} />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-7 z-30 w-36 py-1.5 rounded-2xl bg-white dark:bg-[#1C2026] border border-zinc-200 dark:border-[#2A313C] shadow-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(trigger);
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Edit3 size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(trigger);
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Title & Query */}
        <h4 className="text-base font-bold text-zinc-900 dark:text-white leading-snug line-clamp-2 mb-1.5">
          {trigger.title}
        </h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
          {trigger.query || 'Sem instrução detalhada.'}
        </p>
      </div>

      {/* Footer of Card */}
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Clock size={13} />
          <span>{trigger.frequency || 'Diário às 08:30'}</span>
        </span>
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] group-hover:translate-x-0.5 transition-transform">
          <span>Ver relatórios</span>
          <ArrowRight size={13} />
        </span>
      </div>
    </div>
  );
};
