import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Todo } from '../types';

export function useTasks() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTodos();
      setTodos(data || []);
      return data || [];
    } catch (e) {
      console.error('[useTasks] Falha ao buscar tarefas:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createTodo = useCallback(async (todoData: Partial<Todo>) => {
    try {
      const created = await api.createTodo(todoData);
      setTodos((prev) => [created, ...prev]);
      return created;
    } catch (e) {
      console.error('[useTasks] Falha ao criar tarefa:', e);
      throw e;
    }
  }, []);

  const updateTodo = useCallback(async (id: string, updates: Partial<Todo>) => {
    try {
      const updated = await api.updateTodo(id, updates);
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      return updated;
    } catch (e) {
      console.error('[useTasks] Falha ao atualizar tarefa:', e);
      throw e;
    }
  }, []);

  const deleteTodo = useCallback(async (id: string) => {
    try {
      await api.deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error('[useTasks] Falha ao excluir tarefa:', e);
      throw e;
    }
  }, []);

  const toggleTodo = useCallback(async (todo: Todo) => {
    const isCompleted = todo.status === 'completed' || todo.completed;
    const nextStatus = isCompleted ? 'pending' : 'completed';

    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, status: nextStatus, completed: !isCompleted } : t))
    );

    try {
      await api.updateTodo(todo.id, { status: nextStatus });
    } catch (e) {
      await fetchTodos();
      throw e;
    }
  }, [fetchTodos]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  return {
    todos,
    setTodos,
    loading,
    refresh: fetchTodos,
    fetchTodos,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
  };
}
