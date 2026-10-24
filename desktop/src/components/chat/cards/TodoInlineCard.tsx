import React, { useState } from 'react';
import { Todo } from '../../../types';
import { CheckCircleIcon } from '../ChatCardIcons';

interface TodoInlineCardProps {
  todo: Todo;
  onNavigateTab?: (tab: string) => void;
  onUndo?: () => void;
}

export const TodoInlineCard: React.FC<TodoInlineCardProps> = ({
  todo,
  onNavigateTab,
  onUndo,
}) => {
  const [undone, setUndone] = useState(false);

  const priorityLabel =
    todo.priority === 'high'
      ? 'prioridade alta'
      : todo.priority === 'medium'
      ? 'prioridade média'
      : 'prioridade baixa';

  const formatDue = (dateStr?: string) => {
    if (!dateStr) return 'Sem prazo';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Sem prazo';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `Vence ${day}/${month} ${hh}:${mm}`;
  };

  const dueLabel = formatDue(todo.due_date);
  const subtitle = [dueLabel !== 'Sem prazo' ? dueLabel : null, priorityLabel, todo.category || 'Tarefas']
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`mt-4 space-y-2.5 transition-all ${undone ? 'opacity-40' : ''}`}>
      {/* Card Principal */}
      <div className="p-4.5 rounded-[22px] bg-white dark:bg-[#12151A] border border-zinc-200 dark:border-[#222730] flex items-center gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
        {/* Chip Roxo 44x44 com CheckCircleIcon */}
        <div className="w-11 h-11 rounded-2xl bg-[#eee8fd] dark:bg-[#241a42] flex items-center justify-center shrink-0 shadow-2xs">
          <CheckCircleIcon color="#7a4fe0" size={22} />
        </div>

        {/* Informações da Tarefa */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
            {todo.title}
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5 truncate font-medium">
            {subtitle}
          </p>
        </div>

        <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-[#eee8fd] dark:bg-[#241a42] text-[#7a4fe0] dark:text-[#a58bff] uppercase tracking-wider shrink-0">
          {todo.priority || 'MÉDIA'}
        </span>
      </div>

      {/* Botões de Ação em Pílula (Desfazer / Ver tarefas) */}
      <div className="flex items-center gap-2 pl-1">
        <button
          type="button"
          onClick={() => {
            setUndone(true);
            onUndo?.();
          }}
          disabled={undone}
          className="px-4 py-1.5 rounded-full border border-zinc-200 dark:border-[#262B33] bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 text-xs font-bold text-zinc-600 dark:text-zinc-300 transition-colors"
        >
          {undone ? 'Cancelada' : 'Desfazer'}
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab?.('tasks')}
          className="px-4 py-1.5 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-xs font-bold transition-all shadow-2xs"
        >
          Ver tarefas
        </button>
      </div>
    </div>
  );
};
