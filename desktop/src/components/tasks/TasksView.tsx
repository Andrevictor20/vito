import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../services/api';
import { Todo } from '../../types';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Search,
  Pencil,
  ChevronDown,
  ChevronUp,
  Bell,
  Check,
  Sparkles,
  X,
} from 'lucide-react';

type FilterTab = 'all' | 'today' | 'week' | 'overdue';

export const TasksView: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  // Quick Inline Creation (Zero Modais)
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // In-Place Inline Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

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

  const handleCreateQuickTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setCreating(true);
    try {
      const created = await api.createTodo({
        title,
        priority: newPriority,
        status: 'pending',
      });
      setTodos((prev) => [created, ...prev]);
      setNewTitle('');
      setIsAdding(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar tarefa');
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
    setEditingId(null);

    try {
      await api.updateTodo(id, { title: trimmed });
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar alteração');
      fetchTodos();
    }
  };

  const now = useMemo(() => new Date(), []);
  const startOfToday = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()), [now]);
  const endOfToday = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59), [now]);
  const endOfWeek = useMemo(() => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() + 7);
    return d;
  }, [startOfToday]);

  const pendingTodos = useMemo(() => todos.filter((t) => t.status !== 'completed' && !t.completed), [todos]);
  const completedTodos = useMemo(() => todos.filter((t) => t.status === 'completed' || t.completed), [todos]);
  const overdueCount = useMemo(() => pendingTodos.filter((t) => t.due_date && new Date(t.due_date) < now).length, [pendingTodos, now]);
  const todayCount = useMemo(() => pendingTodos.filter((t) => t.due_date && new Date(t.due_date) >= startOfToday && new Date(t.due_date) <= endOfToday).length, [pendingTodos, startOfToday, endOfToday]);
  const weekCount = useMemo(() => pendingTodos.filter((t) => t.due_date && new Date(t.due_date) >= startOfToday && new Date(t.due_date) <= endOfWeek).length, [pendingTodos, startOfToday, endOfWeek]);

  const filteredPending = useMemo(() => {
    return pendingTodos.filter((t) => {
      const matchSearch = !searchQuery.trim() || t.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (activeTab === 'overdue') return t.due_date && new Date(t.due_date) < now;
      if (activeTab === 'today') return t.due_date && new Date(t.due_date) >= startOfToday && new Date(t.due_date) <= endOfToday;
      if (activeTab === 'week') return t.due_date && new Date(t.due_date) >= startOfToday && new Date(t.due_date) <= endOfWeek;
      return true;
    });
  }, [pendingTodos, searchQuery, activeTab, now, startOfToday, endOfToday, endOfWeek]);

  const getPriorityBadge = (priority?: string) => {
    const color = priority === 'high' ? 'text-rose-500 bg-rose-500' : priority === 'medium' ? 'text-amber-500 bg-amber-500' : 'text-zinc-400 bg-zinc-400';
    const label = priority === 'high' ? 'Alta' : priority === 'medium' ? 'Média' : 'Baixa';
    return (
      <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase ${color.split(' ')[0]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${color.split(' ')[1]}`} />
        {label}
      </span>
    );
  };

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-[#17191b] dark:text-[#f1f3f2] overflow-hidden select-none transition-colors duration-200">
      <header className="h-20 px-8 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/95 dark:bg-[#14171C]/95 backdrop-blur-md z-10 shrink-0">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-[#17191b] dark:text-[#f1f3f2]">
            Tarefas
          </h1>
          <p className="text-xs text-[#69706d] dark:text-[#98a19d] mt-0.5 font-medium">
            {pendingTodos.length} ativas · {overdueCount} atrasadas · {completedTodos.length} concluídas
          </p>
        </div>

        <button
          onClick={() => {
            setIsAdding(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-sm font-bold shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={16} />
          <span>Nova tarefa</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-7">
        <div className="max-w-[1200px] mx-auto space-y-6">
          {/* Quick Add Bar (Zero Modais) */}
          {isAdding && (
            <form
              onSubmit={handleCreateQuickTodo}
              className="p-4 rounded-2xl bg-white dark:bg-[#14171C] border border-[#00E599]/40 shadow-vito-card flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="w-7 h-7 rounded-full bg-[#00E599]/15 text-[#0b9a5f] dark:text-[#34d399] flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="Ex: Pagar fatura do cartão até sexta..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                disabled={creating}
                className="flex-1 bg-transparent text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
              />
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/5 p-1 rounded-full text-xs">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPriority(p)}
                    className={`px-2.5 py-1 rounded-full font-semibold capitalize transition-all ${
                      newPriority === p ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-400'
                    }`}
                  >
                    {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="px-4 py-1.5 rounded-full bg-[#17191b] dark:bg-white text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-40"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="p-1.5 text-zinc-400">
                <X size={16} />
              </button>
            </form>
          )}

          {/* Filtros em Pílula */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 p-1.5 bg-zinc-100 dark:bg-[#191c1e] rounded-full border border-zinc-200/60 dark:border-[#2c3134]">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'all' ? 'bg-white dark:bg-[#2c3134] text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500'
                }`}
              >
                Todas ({pendingTodos.length})
              </button>
              <button
                onClick={() => setActiveTab('today')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'today' ? 'bg-white dark:bg-[#2c3134] text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500'
                }`}
              >
                Hoje ({todayCount})
              </button>
              <button
                onClick={() => setActiveTab('week')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'week' ? 'bg-white dark:bg-[#2c3134] text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500'
                }`}
              >
                Esta semana ({weekCount})
              </button>
              {overdueCount > 0 && (
                <button
                  onClick={() => setActiveTab('overdue')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    activeTab === 'overdue' ? 'bg-rose-500 text-white shadow-xs' : 'text-rose-500 hover:bg-rose-500/10'
                  }`}
                >
                  Atrasadas ({overdueCount})
                </button>
              )}
            </div>

            <div className="w-full sm:w-64 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#2c3134]">
              <Search size={14} className="text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar tarefas..."
                className="w-full bg-transparent text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Lista de Tarefas */}
          <div className="space-y-3">
            {loading ? (
              <div className="p-16 text-center text-sm text-zinc-500 flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-zinc-700 dark:text-zinc-300" />
                <span>Carregando tarefas...</span>
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-500 bg-white dark:bg-[#14171C] rounded-[24px] border border-zinc-200 dark:border-[#222730]">
                {searchQuery ? 'Nenhuma tarefa encontrada na busca.' : 'Tudo em dia! Nenhuma tarefa pendente nesta categoria.'}
              </div>
            ) : (
              filteredPending.map((todo) => {
                const isOverdue = todo.due_date && new Date(todo.due_date) < now;
                const isItemEditing = editingId === todo.id;

                return (
                  <div
                    key={todo.id}
                    className="p-5 rounded-[22px] bg-white dark:bg-[#14171C] border border-zinc-200/90 dark:border-[#222730] hover:border-zinc-300 dark:hover:border-zinc-600 transition-all flex items-center justify-between gap-4 shadow-sm group"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggleTodo(todo)}
                        className="w-6 h-6 rounded-full border-2 border-zinc-400 dark:border-zinc-500 hover:border-[#00E599] hover:bg-[#00E599]/10 transition-all shrink-0 mt-0.5 flex items-center justify-center group-hover:scale-105"
                        title="Concluir tarefa"
                      />

                      <div className="min-w-0 flex-1">
                        {isItemEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(todo.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              className="w-full text-base font-semibold bg-transparent text-zinc-900 dark:text-white border-b border-[#00E599] pb-0.5 focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveEdit(todo.id)}
                              className="px-2.5 py-1 text-xs font-bold rounded-full bg-[#17191b] dark:bg-white text-white dark:text-zinc-900"
                            >
                              Salvar
                            </button>
                          </div>
                        ) : (
                          <h4
                            onClick={() => handleStartEdit(todo)}
                            className="text-base font-semibold text-zinc-900 dark:text-white leading-snug cursor-pointer hover:text-[#00E599] transition-colors"
                          >
                            {todo.title}
                          </h4>
                        )}

                        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs">
                          {getPriorityBadge(todo.priority)}
                          {todo.due_date && (
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue ? 'text-rose-500 font-bold' : 'text-zinc-500'}`}>
                              <Bell size={13} className={isOverdue ? 'text-rose-500' : 'text-zinc-400'} />
                              <span>{isOverdue ? 'Atrasada · ' : ''}{new Date(todo.due_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleStartEdit(todo)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5"
                        title="Editar tarefa"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-rose-500 transition-all rounded-lg hover:bg-rose-500/10"
                        title="Excluir tarefa"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Acordeão de Concluídas */}
          {completedTodos.length > 0 && (
            <div className="pt-4">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="w-full flex items-center justify-between py-3 px-5 rounded-2xl bg-zinc-100/60 dark:bg-white/[0.02] border border-zinc-200/60 dark:border-white/5 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2.5 text-[#00E599]">
                  <Check size={16} />
                  <span>Concluídas ({completedTodos.length})</span>
                </div>
                {showCompleted ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              </button>

              {showCompleted && (
                <div className="space-y-2 mt-3">
                  {completedTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className="p-4 rounded-[18px] bg-zinc-50/70 dark:bg-[#14171C]/60 border border-zinc-200/60 dark:border-[#222730]/60 flex items-center justify-between gap-4 opacity-70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => handleToggleTodo(todo)}
                          className="shrink-0 text-[#00E599] hover:scale-105 transition-transform"
                          title="Reabrir tarefa"
                        >
                          <CheckCircle2 size={20} />
                        </button>
                        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 line-through truncate">
                          {todo.title}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteTodo(todo.id)} className="p-1 text-zinc-400 hover:text-rose-500">
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
    </div>
  );
};
