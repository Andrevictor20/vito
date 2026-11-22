import React, { useMemo, useState } from 'react';
import { useTasks } from '../../hooks';
import { Todo } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Check, ChevronDown, ChevronRight, Clock, Plus, Sparkles } from 'lucide-react';
import { DEFAULT_TASK_LISTS, formatIsoDate, TaskListDef } from '../../utils/taskQuickAddParser';
import { TaskQuickAddModal } from './TaskQuickAddModal';

export const TasksView: React.FC = () => {
  const { todos, createTodo, updateTodo, toggleTodo } = useTasks();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [lists, setLists] = useState<TaskListDef[]>(DEFAULT_TASK_LISTS);
  const [selectedListId, setSelectedListId] = useState<string>('all');
  const [newListName, setNewListName] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [undoToast, setUndoToast] = useState<{ msg: string; onUndo?: () => void } | null>(null);

  const displayTodos: Todo[] = useMemo(() => todos, [todos]);
  const activeTasks = useMemo(() => displayTodos.filter((t) => t.status !== 'completed'), [displayTodos]);
  const completedTasks = useMemo(() => displayTodos.filter((t) => t.status === 'completed'), [displayTodos]);

  const filteredActive = useMemo(() => {
    if (selectedListId === 'all') return activeTasks;
    return activeTasks.filter((t) => (t.category || 'trabalho').toLowerCase() === selectedListId);
  }, [activeTasks, selectedListId]);

  const todayIso = useMemo(() => formatIsoDate(new Date()), []);
  const overdueTasks = useMemo(
    () => filteredActive.filter((t) => t.due_date && t.due_date.slice(0, 10) < todayIso),
    [filteredActive, todayIso]
  );
  const todayTasks = useMemo(
    () => filteredActive.filter((t) => t.due_date && t.due_date.slice(0, 10) === todayIso),
    [filteredActive, todayIso]
  );
  const upcomingTasks = useMemo(
    () => filteredActive.filter((t) => !t.due_date || t.due_date.slice(0, 10) > todayIso),
    [filteredActive, todayIso]
  );

  const currentTask =
    displayTodos.find((t) => t.id === selectedTaskId) || filteredActive[0] || displayTodos[0];

  const todayDone = completedTasks.length;
  const todayTotal = todayTasks.length + todayDone;
  const pct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const dashOffset = 138.2 * (1 - pct / 100);

  const showUndo = (msg: string, onUndo?: () => void) => {
    setUndoToast({ msg, onUndo });
    setTimeout(() => setUndoToast((cur) => (cur?.msg === msg ? null : cur)), 3500);
  };

  const handleToggleTodo = async (todo: Todo) => {
    await toggleTodo(todo).catch(() => {});
    if (todo.status !== 'completed') {
      showUndo('Tarefa concluída', () => {
        toggleTodo({ ...todo, status: 'completed' }).catch(() => {});
      });
    }
  };

  const handlePostponeTomorrow = async (todo: Todo) => {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    const tomorrow = formatIsoDate(tm);
    const prev = todo.due_date;
    await updateTodo(todo.id, { due_date: tomorrow }).catch(() => {});
    showUndo('Adiada para amanhã', () => {
      updateTodo(todo.id, { due_date: prev }).catch(() => {});
    });
  };

  const handleToggleSubtask = async (subId: string) => {
    if (!currentTask) return;
    const next = (currentTask.subtasks || []).map((s) =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    await updateTodo(currentTask.id, { subtasks: next }).catch(() => {});
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !currentTask) return;
    const next = [
      ...(currentTask.subtasks || []),
      { id: `sub_${Date.now()}`, title: newSubtaskTitle.trim(), completed: false },
    ];
    setNewSubtaskTitle('');
    await updateTodo(currentTask.id, { subtasks: next }).catch(() => {});
  };

  const handleAiSubtasks = async () => {
    if (!currentTask) return;
    const next = [
      ...(currentTask.subtasks || []),
      { id: `sub_ai1_${Date.now()}`, title: 'Definir escopo e checklist inicial', completed: false },
      { id: `sub_ai2_${Date.now() + 1}`, title: 'Executar etapa principal e revisar', completed: false },
    ];
    await updateTodo(currentTask.id, { subtasks: next }).catch(() => {});
  };

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    const nm = newListName.trim();
    if (!nm) return;
    const id = `list_${Date.now()}`;
    setLists((prev) => [...prev, { id, name: nm, color: '#7a4fe0' }]);
    setSelectedListId(id);
    setNewListName('');
    setAddingList(false);
  };

  const groups = [
    { key: 'atr', label: 'Atrasadas', rows: overdueTasks, danger: true },
    { key: 'hoje', label: 'Hoje', rows: todayTasks, danger: false },
    { key: 'prox', label: 'Próximas & Sem data', rows: upcomingTasks, danger: false },
  ];

  return (
    <div className="flex-1 h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none">
      <header className="h-16 px-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] shrink-0">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight leading-tight">Tarefas & Foco</h1>
          <p className="text-sm text-[var(--muted)] tabular-nums">
            {activeTasks.length} ativas · {completedTasks.length} concluídas
          </p>
        </div>

        <Button variant="pri" size="sm" pill onClick={() => setQuickOpen(true)} leftIcon={<Plus size={16} />}>
          Nova tarefa
        </Button>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="w-[52%] shrink-0 border-r border-[var(--line)] overflow-y-auto p-5 space-y-4 bg-[var(--bg)]">
          {/* Card diário .tk-sum com anel SVG */}
          <div className="rounded-[22px] bg-[var(--surf)] border border-[var(--line)] p-4 flex items-center gap-4">
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                <circle cx="28" cy="28" r="22" fill="none" stroke="var(--line)" strokeWidth="5" />
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="var(--purple)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="138.2"
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-xs font-bold tabular-nums">
                {pct}%
              </span>
            </div>
            <div>
              <b className="block text-[15px] font-semibold tabular-nums">
                {todayTotal === 0 ? 'Dia livre' : `${todayDone} de ${todayTotal} concluídas hoje`}
              </b>
              <p className={`text-xs mt-0.5 ${overdueTasks.length > 0 ? 'text-[var(--red)] font-semibold' : 'text-[var(--muted)]'}`}>
                {overdueTasks.length > 0
                  ? `${overdueTasks.length} atrasada(s)`
                  : `${todayTasks.length} para hoje`}
              </p>
            </div>
          </div>

          {/* Chips de listas coloridas + "+ Lista" */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedListId('all')}
              className={`h-8 px-3 rounded-full text-xs font-semibold border ${
                selectedListId === 'all'
                  ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                  : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)]'
              }`}
            >
              Todas as listas
            </button>
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedListId((prev) => (prev === l.id ? 'all' : l.id))}
                className={`h-8 px-3 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 ${
                  selectedListId === l.id
                    ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                    : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAddingList((v) => !v)}
              className="h-8 px-3 rounded-full text-xs font-semibold border border-[var(--line)] bg-[var(--surf)]"
            >
              + Lista
            </button>
          </div>

          {addingList && (
            <form onSubmit={handleCreateList} className="flex gap-2">
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Nome da nova lista..."
                className="flex-1 h-9 px-3 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-xs"
              />
              <Button variant="pri" size="sm" pill type="submit">
                Criar
              </Button>
            </form>
          )}

          {/* Grupos colapsáveis */}
          {groups.map((g) => {
            if (g.rows.length === 0) return null;
            const isCol = !!collapsed[g.key];
            return (
              <div key={g.key} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setCollapsed((p) => ({ ...p, [g.key]: !p[g.key] }))}
                  className="w-full flex items-center justify-between text-left py-1"
                >
                  <span
                    className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                      g.danger ? 'text-[var(--red)]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {g.label}
                    <span className="px-2 py-0.5 rounded-full bg-[var(--surf)] tabular-nums">
                      {g.rows.length}
                    </span>
                  </span>
                  {isCol ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>

                {!isCol &&
                  g.rows.map((t) => {
                    const isSelected = currentTask?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[var(--surf)] border-[var(--ink)]'
                            : 'border-transparent hover:bg-[var(--surf)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTodo(t);
                          }}
                          className="w-5 h-5 rounded-full border-2 border-[var(--line)] shrink-0 hover:border-[var(--purple)]"
                          aria-label="Concluir tarefa"
                        />
                        <div className="flex-1 min-w-0">
                          <b className="text-sm text-[var(--ink)] block truncate">{t.title}</b>
                          <span className="text-xs text-[var(--muted)]">
                            {t.due_date ? t.due_date.slice(0, 10) : 'Sem prazo'}
                          </span>
                        </div>
                        <button
                          type="button"
                          title="Adiar para amanhã"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePostponeTomorrow(t);
                          }}
                          className="p-1.5 rounded-full text-[var(--muted)] hover:bg-[var(--bg)]"
                        >
                          <Clock size={14} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>

        <aside className="w-[48%] shrink-0 overflow-y-auto p-8 bg-[var(--surf)] space-y-5">
          {currentTask ? (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-[var(--ink)] leading-tight">
                  {currentTask.title}
                </h2>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="inline-block text-xs font-bold px-3 py-0.5 rounded-full bg-[var(--bg)] text-[var(--ink)]">
                    {currentTask.priority === 'high' ? 'Alta prioridade' : 'Normal'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider">
                    Subtarefas ({(currentTask.subtasks || []).length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    pill
                    onClick={handleAiSubtasks}
                    leftIcon={<Sparkles size={13} className="text-[var(--purple)]" />}
                  >
                    Subtarefas IA
                  </Button>
                </div>
                <Card padding="lg" className="space-y-3 bg-[var(--bg)]">
                  {(currentTask.subtasks || []).length > 0 ? (
                    currentTask.subtasks!.map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => handleToggleSubtask(sub.id)}
                        className="flex items-center gap-3 py-1.5 cursor-pointer"
                      >
                        <button
                          type="button"
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            sub.completed ? 'bg-[var(--purple)] border-[var(--purple)]' : 'border-[var(--line)]'
                          }`}
                        >
                          {sub.completed && <Check size={11} className="text-white" />}
                        </button>
                        <span className={`text-sm font-medium ${sub.completed ? 'line-through text-[var(--muted)]' : 'text-[var(--ink)]'}`}>
                          {sub.title}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--muted)]">Sem subtarefas cadastradas.</span>
                  )}

                  <form onSubmit={handleAddSubtask} className="pt-3 border-t border-[var(--line)] flex gap-2">
                    <input
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="+ Nova subtarefa..."
                      className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-[var(--line)] bg-[var(--surf)]"
                    />
                    <Button variant="outline" size="sm" pill type="submit">
                      Adicionar
                    </Button>
                  </form>
                </Card>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Nenhuma tarefa selecionada.</p>
          )}
        </aside>
      </div>

      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full bg-[var(--ink)] text-[var(--bg)] text-xs font-semibold flex items-center gap-3 shadow-lg z-50">
          <span>{undoToast.msg}</span>
          {undoToast.onUndo && (
            <button
              type="button"
              onClick={() => {
                undoToast.onUndo?.();
                setUndoToast(null);
              }}
              className="text-[var(--acc)] font-bold"
            >
              Desfazer
            </button>
          )}
        </div>
      )}

      <TaskQuickAddModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        lists={lists}
        defaultListId={selectedListId}
        onCreate={async (payload) => {
          await createTodo({ ...payload, status: 'pending' });
        }}
      />
    </div>
  );
};
