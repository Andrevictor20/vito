import React, { useState, useRef, useEffect } from 'react';
import {
  SlidersHorizontal,
  Calendar,
  CheckSquare,
  Radar,
  CalendarCheck,
  Sparkles,
  Brain,
  ChevronDown,
  X,
} from 'lucide-react';

export interface FocusMode {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const FOCUS_MODES: FocusMode[] = [
  {
    id: 'calendar',
    title: 'Agenda & Eventos',
    description: 'Compromissos, horários, conflitos e sincronização',
    icon: Calendar,
  },
  {
    id: 'tasks',
    title: 'Tarefas & Prioridades',
    description: 'Afazeres, prazos, prioridades e lembretes recorrentes',
    icon: CheckSquare,
  },
  {
    id: 'triggers',
    title: 'Vigílias & Radares',
    description: 'Monitoramento contínuo de faturas, contas e alertas',
    icon: Radar,
  },
  {
    id: 'meetings',
    title: 'Booking & Reuniões',
    description: 'Links públicos de agendamento e consenso de grupo',
    icon: CalendarCheck,
  },
  {
    id: 'briefing',
    title: 'Briefing Executivo',
    description: 'Panorama do dia, pendências críticas e prioridades',
    icon: Sparkles,
  },
  {
    id: 'memory',
    title: 'Memória & Rotinas',
    description: 'Preferências, hábitos e contexto pessoal duradouro',
    icon: Brain,
  },
];

interface FocusMenuProps {
  selectedFocus: FocusMode | null;
  onSelectFocus: (focus: FocusMode | null) => void;
}

export const FocusMenu: React.FC<FocusMenuProps> = ({ selectedFocus, onSelectFocus }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {selectedFocus ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-xs font-semibold">
          <selectedFocus.icon size={13} />
          <span>{selectedFocus.title}</span>
          <button
            type="button"
            onClick={() => onSelectFocus(null)}
            className="p-0.5 hover:bg-indigo-500/20 rounded-full ml-0.5"
            title="Remover foco"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors shadow-xs"
          title="Selecionar modo de foco para a IA"
        >
          <SlidersHorizontal size={13} className="text-zinc-500" />
          <span>Foco em</span>
          <ChevronDown size={12} className="text-zinc-400" />
        </button>
      )}

      {/* Popover Menu Toki */}
      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-80 bg-white dark:bg-[#181C22] border border-zinc-200 dark:border-[#262B33] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            FOCO EM
          </div>

          <div className="space-y-0.5">
            {FOCUS_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    onSelectFocus(mode);
                    setOpen(false);
                  }}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-[#101216] border border-zinc-200/80 dark:border-white/5 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">
                      {mode.title}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 leading-snug">
                      {mode.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
