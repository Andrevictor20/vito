import { ApiClient } from './client';
import { Todo, Subtask } from '../../types';

export class TodosApi {
  constructor(private client: ApiClient) {}

  async getTodos(status?: string): Promise<Todo[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await this.client.request<any>(`/api/v1/todos${q}`);
    return Array.isArray(res) ? res : res.todos || [];
  }

  async createTodo(todo: Partial<Todo>): Promise<Todo> {
    return this.client.request<Todo>('/api/v1/todos', {
      method: 'POST',
      body: JSON.stringify(todo),
    });
  }

  async updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
    return this.client.request<Todo>(`/api/v1/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async completeTodo(id: string): Promise<{ status: string }> {
    return this.client.request(`/api/v1/todos/${id}/complete`, {
      method: 'PATCH',
    });
  }

  async reopenTodo(id: string): Promise<{ status: string }> {
    return this.client.request(`/api/v1/todos/${id}/reopen`, {
      method: 'PATCH',
    });
  }

  async deleteTodo(id: string): Promise<void> {
    await this.client.request(`/api/v1/todos/${id}`, { method: 'DELETE' });
  }

  async addSubtask(todoId: string, title: string): Promise<Subtask> {
    return this.client.request<Subtask>(`/api/v1/todos/${todoId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async toggleSubtask(todoId: string, subtaskId: string): Promise<Subtask> {
    return this.client.request<Subtask>(`/api/v1/todos/${todoId}/subtasks/${subtaskId}/toggle`, {
      method: 'PATCH',
    });
  }

  async deleteSubtask(todoId: string, subtaskId: string): Promise<void> {
    await this.client.request(`/api/v1/todos/${todoId}/subtasks/${subtaskId}`, {
      method: 'DELETE',
    });
  }
}
