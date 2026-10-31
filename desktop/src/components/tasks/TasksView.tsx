import React, { useState, useMemo, useRef } from 'react';
import { useTasks } from '../../hooks';
import { Todo } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Plus, Check } from 'lucide-react';

export const TasksView: React.FC = () => {
  const {
    todos,
    createTodo,
    updateTodo,
    toggleTodo,
  } = useTasks();

  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [isAddingQuick, setIsAddingQuick] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);

  // Fallback com dados canônicos se lista estiver vazia
  const displayTodos: Todo[] = useMemo(() => {
    if (todos.length > 0) return todos;
    return [
      {
        id: 'task-1',
        title: 'Treinar mais inglês',
        description: 'Foco no listening antes da aula de conversação.',
        priority: 'high',
        status: 'pending',
        due_date: '2026-10-24T18:00:00Z',
        subtasks: [
          { id: 'sub-1', title: 'Revisar vocabulário', completed: true },
          { id: 'sub-2', title: 'Podcast 20 min', completed: false },
        ],
      },
      {
        id: 'task-2',
        title: 'Ajustar backend, dívida técnica e IA',
        description: 'Refatoração dos logs e handlers do WhatsApp.',
        priority: 'medium',
        status: 'pending',
        subtasks: [
          { id: 'sub-3', title: 'Mapear dívida técnica', completed: false },
          { id: 'sub-4', title: 'Leitura de contatos WhatsApp', completed: false },
        ],
      },
      {
        id: 'task-3',
        title: 'Confirmar local exato da visita técnica à Vale',
        description: 'Ligar para a portaria da Vale.',
        priority: 'high',
        status: 'pending',
        due_date: '2026-10-25T14:00:00Z',
        subtasks: [],
      },
      {
        id: 'task-4',
        title: 'XP multiagent kit: subagentes de verdade',
        description: 'Orquestrador, testes e documentação contínua.',
        priority: 'medium',
        status: 'pending',
        subtasks: [
          { id: 'sub-5', title: 'Orquestrador', completed: true },
          { id: 'sub-6', title: 'Testes de integração', completed: false },
        ],
      },
      {
        id: 'task-5',
        title: 'Ler links salvos do radar',
        description: '',
        priority: 'low',
        status: 'pending',
        due_date: '2026-10-22T20:00:00Z',
        subtasks: [],
      },
    ];
  }, [todos]);

  const activeTasks = useMemo(() => displayTodos.filter((t) => t.status !== 'completed'), [displayTodos]);
  const completedTasks = useMemo(() => displayTodos.filter((t) => t.status === 'completed'), [displayTodos]);

  const overdueTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return activeTasks.filter((t) => t.due_date && t.due_date.split('T')[0] < today);
  }, [activeTasks]);

  const nonOverdueTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return activeTasks.filter((t) => !t.due_date || t.due_date.split('T')[0] >= today);
  }, [activeTasks]);

  const currentTask = displayTodos[selectedTaskIndex] || displayTodos[0];

  const handleToggleTodo = async (todo: Todo) => {
    try {
      await toggleTodo(todo);
    } catch {
      // Ignora erro em modo demo
    }
  };

  const handleCreateNewTask = async () => {
    if (quickTitle.trim()) {
      try {
        await createTodo({ title: quickTitle.trim(), priority: 'medium', status: 'pending' });
        setQuickTitle('');
        setIsAddingQuick(false);
      } catch {
        // Ignora
      }
    } else {
      setIsAddingQuick(true);
      setTimeout(() => quickInputRef.current?.focus(), 50);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!currentTask) return;
    const nextSubtasks = (currentTask.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );

    try {
      await updateTodo(currentTask.id, { subtasks: nextSubtasks });
    } catch {
      // Ignora erro local
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !currentTask) return;

    const newSub: any = {
      id: `sub_${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };

    const nextSubtasks = [...(currentTask.subtasks || []), newSub];
    setNewSubtaskTitle('');

    try {
      await updateTodo(currentTask.id, { subtasks: nextSubtasks });
    } catch {
      // Ignora erro local
    }
  };

  return (
    <div className="flex-1 h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header Fiel ao Vito Desktop.html */}
      <header className="h-16 px-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] z-10 shrink-0">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight leading-tight">
            Tarefas & Foco
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {activeTasks.length} ativas · {completedTasks.length} concluídas
          </p>
        </div>

        <Button
          variant="pri"
          size="sm"
          pill
          onClick={handleCreateNewTask}
          leftIcon={<Plus size={16} />}
        >
          Nova tarefa <kbd className="ml-1 text-xs opacity-70">C</kbd>
        </Button>
      </header>

      {/* Layout Master-Detail (Split-Pane 52% lista / 48% Inspector) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Coluna Esquerda: Lista de Tarefas (.lst com 52% da largura) */}
        <div className="w-[52%] shrink-0 border-r border-[var(--line)] overflow-y-auto p-5 space-y-5 bg-[var(--bg)]">
          {/* Campo de Adição Rápida */}
          {isAddingQuick && (
            <form onSubmit={(e) => { e.preventDefault(); handleCreateNewTask(); }} className="flex items-center gap-2">
              <input
                ref={quickInputRef}
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="Título da tarefa..."
                className="flex-1 px-4 py-2 text-sm rounded-xl border border-[var(--line)] bg-[var(--surf)] focus:outline-none focus:border-[var(--blue)] font-medium"
              />
              <Button variant="pri" size="sm" pill type="submit">Salvar</Button>
              <Button variant="gh" size="sm" pill type="button" onClick={() => setIsAddingQuick(false)}>Cancelar</Button>
            </form>
          )}

          {/* Seção Atrasadas */}
          {overdueTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[var(--red)] uppercase tracking-wider mb-2">
                Atrasadas ({overdueTasks.length})
              </h3>
              {overdueTasks.map((t) => {
                const idx = displayTodos.findIndex((x) => x.id === t.id);
                const isSelected = idx === selectedTaskIndex;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskIndex(idx)}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--surf)] border-[var(--ink)] shadow-xs'
                        : 'border-transparent hover:bg-[var(--surf)]'
                    }`}
                  >
                    {/* Checkbox Circular (.ck) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTodo(t);
                      }}
                      className="w-5 h-5 rounded-full border-2 border-[var(--line)] shrink-0 flex items-center justify-center transition-colors hover:border-[var(--acc)]"
                    />
                    <div className="flex-1 min-w-0">
                      <b className="text-base text-[var(--ink)] block truncate">{t.title}</b>
                      <div className="text-xs text-[var(--red)] font-semibold mt-0.5">
                        Atrasada · {t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Vencida'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Seção Sem Data / Próximas */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider mb-2">
              Sem data / Próximas ({nonOverdueTasks.length})
            </h3>
            {nonOverdueTasks.map((t) => {
              const idx = displayTodos.findIndex((x) => x.id === t.id);
              const isSelected = idx === selectedTaskIndex;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaskIndex(idx)}
                  className={`flex items-center gap-3.5 p-3.5 rounded-2xl border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--surf)] border-[var(--ink)] shadow-xs'
                      : 'border-transparent hover:bg-[var(--surf)]'
                  }`}
                >
                  {/* Checkbox Circular (.ck) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTodo(t);
                    }}
                    className="w-5 h-5 rounded-full border-2 border-[var(--line)] shrink-0 flex items-center justify-center transition-colors hover:border-[var(--acc)]"
                  />
                  <div className="flex-1 min-w-0">
                    <b className="text-base text-[var(--ink)] block truncate">{t.title}</b>
                    <div className="text-xs text-[var(--muted)] font-medium mt-0.5">
                      {t.priority === 'high' ? 'Alta prioridade' : t.priority === 'low' ? 'Baixa prioridade' : 'Média prioridade'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna Direita: Inspector de Tarefa (.pn com 48% de largura) */}
        <aside className="w-[48%] shrink-0 overflow-y-auto p-8 bg-[var(--surf)] space-y-5">
          {currentTask ? (
            <>
              {/* Título e Prioridade */}
              <div>
                <h2 className="text-2xl font-extrabold text-[var(--ink)] leading-tight m-0">
                  {currentTask.title}
                </h2>
                <div className="mt-2.5 flex items-center gap-2">
                  <span
                    className={`inline-block text-xs font-bold px-3 py-0.5 rounded-full ${
                      currentTask.due_date ? 'bg-[var(--red-bg)] text-[var(--red)]' : 'bg-[var(--orange-bg)] text-[var(--orange)]'
                    }`}
                  >
                    {currentTask.due_date ? 'Atrasada' : 'Média prioridade'}
                  </span>
                </div>
              </div>

              {/* Subtarefas */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider">
                  Subtarefas ({(currentTask.subtasks || []).length})
                </h3>
                <Card padding="lg" className="space-y-3 bg-[var(--bg)]">
                  {(currentTask.subtasks || []).length > 0 ? (
                    currentTask.subtasks!.map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => handleToggleSubtask(sub.id)}
                        className="flex items-center gap-3 py-2 cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <button
                          type="button"
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                            sub.completed ? 'bg-[var(--acc)] border-[var(--acc)]' : 'border-[var(--line)]'
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

                  {/* Form de Adicionar Subtarefa */}
                  <form onSubmit={handleAddSubtask} className="pt-3 border-t border-[var(--line)] flex gap-2">
                    <input
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="+ Nova subtarefa..."
                      className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-[var(--line)] bg-[var(--surf)] focus:outline-none focus:border-[var(--blue)] font-medium"
                    />
                    <Button variant="outline" size="sm" pill type="submit">Adicionar</Button>
                  </form>
                </Card>
              </div>

              {/* Bloco de Notas */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider">
                  Notas
                </h3>
                <Card padding="lg" className="bg-[var(--bg)]">
                  <p className="text-sm text-[var(--ink)] m-0 leading-relaxed font-normal">
                    {currentTask.description || (
                      <span className="text-[var(--muted)]">Sem notas adicionais para esta tarefa.</span>
                    )}
                  </p>
                </Card>
              </div>

              {/* Card de Sugestão Inteligente do Vito */}
              <div className="p-5 rounded-2xl border border-[var(--line)] border-l-4 border-l-[var(--purple)] bg-[var(--bg)] space-y-3">
                <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-[var(--purple-bg)] text-[var(--purple)]">
                  Sugestão do Vito
                </span>
                <p className="text-sm text-[var(--ink)] leading-relaxed m-0 font-medium">
                  Há 12 h livres hoje na sua agenda. Deseja reservar um bloco de foco de 1 h para finalizar esta tarefa?
                </p>
                <div className="flex items-center gap-2.5 pt-1">
                  <Button variant="pri" size="sm" pill>Reservar foco</Button>
                  <Button variant="outline" size="sm" pill>Lembrar amanhã</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-[var(--muted)] py-12">
              Selecione uma tarefa para ver os detalhes
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
