import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Todo } from '../../types';
import {
  CheckSquare,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
} from 'lucide-react';

export const TasksView: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [priority, setPriority] = useState<Todo['priority']>('medium');
  const [creating, setCreating] = useState(false);

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

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;

    setCreating(true);
    try {
      const created = await api.createTodo({
        title: newTitle.trim(),
        priority,
        completed: false,
      });
      setTodos((prev) => [created, ...prev]);
      setNewTitle('');
    } catch (err: any) {
      alert(err.message || 'Erro ao criar tarefa');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    try {
      const updated = await api.updateTodo(todo.id, { completed: !todo.completed });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: updated.completed } : t)));
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar tarefa');
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await api.deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir tarefa');
    }
  };

  const filteredTodos = todos.filter((t) => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const getPriorityBadge = (p: Todo['priority']) => {
    switch (p) {
      case 'urgent':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">Urgente</span>;
      case 'high':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">Alta</span>;
      case 'medium':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">Média</span>;
      default:
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 font-semibold border border-slate-500/30">Baixa</span>;
    }
  };

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#0B0D10] overflow-hidden select-none">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#14171C]">
        <div className="flex items-center gap-3">
          <CheckSquare size={20} className="text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">Tarefas & Incubadora</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#1C2026] text-slate-400 border border-white/5 tabular-nums">
            {todos.filter((t) => !t.completed).length} pendentes
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex p-1 bg-[#0B0D10] border border-white/5 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              filter === 'all' ? 'bg-[#1C2026] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas ({todos.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              filter === 'pending' ? 'bg-[#1C2026] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              filter === 'completed' ? 'bg-[#1C2026] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Concluídas
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-6">
        {/* Quick Add Bar */}
        <form
          onSubmit={handleCreateTodo}
          className="p-2 bg-[#14171C] border border-white/10 rounded-2xl shadow-sm flex items-center gap-2"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Adicione uma nova tarefa ou ideia rápida..."
            className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
          />

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Todo['priority'])}
            className="bg-[#0B0D10] border border-white/10 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>

          <button
            type="submit"
            disabled={!newTitle.trim() || creating}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-colors disabled:opacity-40"
          >
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={15} />}
            <span>Adicionar</span>
          </button>
        </form>

        {/* Task List */}
        <div className="space-y-2">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <Loader2 size={18} className="animate-spin text-emerald-400" />
              <span>Carregando tarefas...</span>
            </div>
          ) : filteredTodos.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-[#14171C] rounded-2xl border border-white/5">
              Nenhuma tarefa encontrada neste filtro.
            </div>
          ) : (
            filteredTodos.map((todo) => (
              <div
                key={todo.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 group ${
                  todo.completed
                    ? 'bg-[#14171C]/50 border-white/5 opacity-60'
                    : 'bg-[#14171C] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleTodo(todo)}
                    className="text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                  >
                    {todo.completed ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <Circle size={18} />
                    )}
                  </button>

                  <span
                    className={`text-xs text-slate-200 truncate ${
                      todo.completed ? 'line-through text-slate-500' : ''
                    }`}
                  >
                    {todo.title}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {getPriorityBadge(todo.priority)}

                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                    title="Excluir tarefa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
