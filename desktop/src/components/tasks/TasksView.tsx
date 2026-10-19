import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { Todo } from '../../types';
import { CreateItemModal } from '../common/CreateItemModal';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Search,
  Filter,
  Pencil,
  ChevronDown,
  ChevronUp,
  Bell,
  Check,
} from 'lucide-react';

export const TasksView: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const data = await api.getTodos();
      setTodos(data);
    } catch (err) {
      console.error('Erro ao buscar tarefas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleToggleTodo = async (todo: Todo) => {
    const isCompleted = todo.status === 'completed' || todo.completed;
    const nextStatus = isCompleted ? 'pending' : 'completed';

    // Optimistic Update
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, status: nextStatus, completed: !isCompleted } : t))
    );

    try {
      await api.updateTodo(todo.id, { status: nextStatus });
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar tarefa');
      fetchTodos();
    }
  };

  const handleDeleteTodo = async (id: string) => {
    if (!confirm('Deseja excluir esta tarefa?')) return;
    try {
      await api.deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir tarefa');
    }
  };

  // Separação em ativas, atrasadas e concluídas
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const pendingTodos = useMemo(() => {
    return todos.filter((t) => t.status !== 'completed' && !t.completed);
  }, [todos]);

  const completedTodos = useMemo(() => {
    return todos.filter((t) => t.status === 'completed' || t.completed);
  }, [todos]);

  const overdueCount = useMemo(() => {
    return pendingTodos.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return !isNaN(d.getTime()) && d < now;
    }).length;
  }, [pendingTodos, now]);

  const filteredPending = useMemo(() => {
    if (!searchQuery.trim()) return pendingTodos;
    const q = searchQuery.toLowerCase();
    return pendingTodos.filter((t) => t.title.toLowerCase().includes(q));
  }, [pendingTodos, searchQuery]);

  const filteredCompleted = useMemo(() => {
    if (!searchQuery.trim()) return completedTodos;
    const q = searchQuery.toLowerCase();
    return completedTodos.filter((t) => t.title.toLowerCase().includes(q));
  }, [completedTodos, searchQuery]);

  const getPriorityBadge = (p: Todo['priority']) => {
    switch (p) {
      case 'urgent':
      case 'high':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            ALTA
          </span>
        );
      case 'medium':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            MÉDIA
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            BAIXA
          </span>
        );
    }
  };

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/80 dark:bg-[#14171C]/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Tarefas</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {pendingTodos.length} ativas · {overdueCount} atrasadas · {completedTodos.length} concluídas
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs font-semibold shadow-sm transition-all"
        >
          <Plus size={14} />
          <span>+ Nova tarefa</span>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 scroll-smooth">
        <div className="max-w-[1500px] mx-auto space-y-7">
          {/* Top Metric Cards - Toki Style Ampliado */}
          <div className="grid grid-cols-3 gap-6">
            <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-xs">
              <p className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider">Ativas</p>
              <p className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white mt-2 tabular-nums">
                {pendingTodos.length}
              </p>
            </div>
            <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-xs">
              <p className="text-xs sm:text-sm font-bold text-rose-500 uppercase tracking-wider">Atrasadas</p>
              <p className="text-4xl sm:text-5xl font-black text-rose-500 mt-2 tabular-nums">
                {overdueCount}
              </p>
            </div>
            <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-xs">
              <p className="text-xs sm:text-sm font-bold text-[#10B981] uppercase tracking-wider">Concluídas</p>
              <p className="text-4xl sm:text-5xl font-black text-[#10B981] mt-2 tabular-nums">
                {completedTodos.length}
              </p>
            </div>
          </div>

          {/* Search Bar Ampliada */}
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm">
            <Search size={18} className="text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar tarefas..."
              className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
            />
            <button className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors">
              <Filter size={16} />
            </button>
          </div>

          {/* Active Tasks List */}
          <div className="space-y-3.5">
            {loading ? (
              <div className="p-16 text-center text-sm text-zinc-500 flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-zinc-700 dark:text-zinc-300" />
                <span>Carregando tarefas...</span>
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-500 bg-white dark:bg-[#14171C] rounded-[24px] border border-zinc-200 dark:border-[#222730]">
                {searchQuery ? 'Nenhuma tarefa encontrada na busca.' : 'Tudo em dia! Nenhuma tarefa pendente.'}
              </div>
            ) : (
              filteredPending.map((todo) => {
                const isOverdue = todo.due_date && new Date(todo.due_date) < now;
                return (
                  <div
                    key={todo.id}
                    className="p-5 sm:p-6 rounded-[24px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] hover:border-zinc-300 dark:hover:border-zinc-600 transition-all flex items-center justify-between gap-5 shadow-sm group"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Checkbox circular M3 Ampliado */}
                      <button
                        onClick={() => handleToggleTodo(todo)}
                        className="w-6 h-6 rounded-full border-2 border-zinc-400 dark:border-zinc-500 hover:border-zinc-900 dark:hover:border-white transition-colors shrink-0 mt-0.5 flex items-center justify-center group-hover:scale-105"
                        title="Concluir tarefa"
                      />

                      <div className="min-w-0 flex-1">
                        <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white leading-snug">
                          {todo.title}
                        </h4>

                        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                          {getPriorityBadge(todo.priority)}

                          {todo.due_date && (
                            <span
                              className={`flex items-center gap-1.5 text-xs font-semibold ${
                                isOverdue ? 'text-red-500 font-bold' : 'text-zinc-500'
                              }`}
                            >
                              <Bell size={13} className={isOverdue ? 'text-red-500' : 'text-zinc-400'} />
                              <span>
                                {isOverdue ? 'Atrasada · ' : ''}
                                {new Date(todo.due_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                              </span>
                            </span>
                          )}

                          <span className="text-xs text-zinc-400 font-medium">
                            + subtarefas
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => {}}
                        className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5"
                        title="Editar tarefa"
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-500/10"
                        title="Excluir tarefa"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Accordion Concluídas */}
          {completedTodos.length > 0 && (
            <div className="pt-4">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="w-full flex items-center justify-between py-3 px-5 rounded-2xl bg-zinc-100/60 dark:bg-white/[0.02] border border-zinc-200/60 dark:border-white/5 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2.5 text-[#10B981]">
                  <Check size={16} />
                  <span>Concluídas ({completedTodos.length})</span>
                </div>
                {showCompleted ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              </button>

              {showCompleted && (
                <div className="space-y-2.5 mt-3">
                  {filteredCompleted.map((todo) => (
                    <div
                      key={todo.id}
                      className="p-4 rounded-[20px] bg-zinc-50/70 dark:bg-[#14171C]/60 border border-zinc-200/60 dark:border-[#222730]/60 flex items-center justify-between gap-4 opacity-70"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <button
                          onClick={() => handleToggleTodo(todo)}
                          className="shrink-0 text-[#10B981] hover:scale-105 transition-transform"
                          title="Reabrir tarefa"
                        >
                          <CheckCircle2 size={22} />
                        </button>
                        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 line-through truncate">
                          {todo.title}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="p-1 text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Unificado Criar Tarefa / Compromisso (Paridade Mobile) */}
      <CreateItemModal
        open={modalOpen}
        defaultTab="todo"
        onClose={() => setModalOpen(false)}
        onCreated={fetchTodos}
      />
    </div>
  );
};
