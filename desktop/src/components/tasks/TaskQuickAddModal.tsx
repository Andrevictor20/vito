import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { qaParse, TaskListDef } from '../../utils/taskQuickAddParser';
import { Button } from '../ui/Button';

interface TaskQuickAddModalProps {
  open: boolean;
  onClose: () => void;
  lists: TaskListDef[];
  defaultListId: string;
  onCreate: (payload: {
    title: string;
    due_date?: string;
    priority?: 'low' | 'medium' | 'high';
    category?: string;
  }) => Promise<void>;
}

export const TaskQuickAddModal: React.FC<TaskQuickAddModalProps> = ({
  open,
  onClose,
  lists,
  defaultListId,
  onCreate,
}) => {
  const [draft, setDraft] = useState('');
  const [selectedList, setSelectedList] = useState(
    defaultListId !== 'all' ? defaultListId : lists[0]?.id || 'trabalho'
  );
  const [addedMsg, setAddedMsg] = useState('');

  const parsed = useMemo(() => qaParse(draft, lists), [draft, lists]);
  const activeListId = parsed.listId || selectedList;
  const activeList = lists.find((l) => l.id === activeListId) || lists[0];

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.title) return;
    await onCreate({
      title: parsed.title,
      due_date: parsed.dueDate || undefined,
      priority: parsed.priority || 'medium',
      category: activeList?.id,
    });
    setAddedMsg(`✓ “${parsed.title}” adicionada`);
    setDraft('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[26px] bg-[var(--bg)] border border-[var(--line)] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--ink)]">Nova tarefa</h2>
            <p className="text-xs text-[var(--muted)]">
              Escreva naturalmente: prazo (hoje, amanhã, sexta, 30/10), p1/urgente e #lista
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--muted)] hover:bg-[var(--surf)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex.: Ligar pro dentista amanhã p1 #pessoal"
            className="w-full h-11 px-4 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
          />

          {draft.trim() && (
            <div className="flex flex-wrap gap-1.5">
              {parsed.dueDate && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--green-bg)] text-[var(--acc)] tabular-nums">
                  {parsed.dueDate}
                </span>
              )}
              {activeList && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--surf)] text-[var(--ink)]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeList.color }} />
                  {activeList.name}
                </span>
              )}
              {parsed.priority && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--red-bg)] text-[var(--red)]">
                  {parsed.priority === 'high' ? 'Alta' : 'Média'}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {['hoje', 'amanhã', 'sexta', 'p1'].map((tok) => (
              <button
                key={tok}
                type="button"
                onClick={() => setDraft((prev) => `${prev ? `${prev.trim()} ` : ''}${tok} `)}
                className="px-3 h-8 rounded-full border border-[var(--line)] bg-[var(--surf)] text-xs font-semibold text-[var(--ink)] hover:opacity-80"
              >
                {tok === 'p1' ? 'Prioridade alta' : tok.charAt(0).toUpperCase() + tok.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {lists.map((l) => {
              const active = activeListId === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedList(l.id)}
                  className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold border ${
                    active
                      ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                      : 'bg-[var(--surf)] text-[var(--ink)] border-[var(--line)]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.name}
                </button>
              );
            })}
          </div>

          {addedMsg && <p className="text-xs font-semibold text-[var(--acc)]">{addedMsg}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="gh" size="sm" pill type="button" onClick={onClose}>
              Fechar
            </Button>
            <Button variant="pri" size="sm" pill type="submit" disabled={!parsed.title}>
              Adicionar tarefa
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
