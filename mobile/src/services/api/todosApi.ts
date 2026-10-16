import { ApiClient } from './client';
import { Todo, Subtask } from '../../types';

export class TodosApi {
  constructor(private client: ApiClient) {}

  async getTodos(status?: string): Promise<Todo[]> {
    const query = status ? `?status=${status}` : '';
    const res = await this.client.request<Todo[]>(`/api/v1/todos${query}`);
    return res || [];
  }

  async createTodo(todo: {
    title: string;
    priority?: string;
    category?: string;
    due_date?: string;
    remind_at?: string;
    remind_repeat?: string;
    remind_advance_minutes?: number;
    event_id?: string;
    event_title?: string;
  }): Promise<Todo> {
    return this.client.request<Todo>('/api/v1/todos', {
      method: 'POST',
      body: JSON.stringify(todo),
    });
  }

  async completeTodo(id: string): Promise<{ status: string }> {
    return this.client.request<{ status: string }>(`/api/v1/todos/${id}/complete`, {
      method: 'PATCH',
    });
  }

  async reopenTodo(id: string): Promise<{ status: string }> {
    return this.client.request<{ status: string }>(`/api/v1/todos/${id}/reopen`, {
      method: 'PATCH',
    });
  }

  async deleteTodo(id: string): Promise<void> {
    return this.client.request<void>(`/api/v1/todos/${id}`, { method: 'DELETE' });
  }

  async updateTodo(
    id: string,
    data: {
      title?: string;
      priority?: string;
      category?: string;
      due_date?: string;
      remind_at?: string;
      remind_repeat?: string;
      remind_advance_minutes?: number;
    }
  ): Promise<Todo> {
    return this.client.request<Todo>(`/api/v1/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
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
    return this.client.request<void>(`/api/v1/todos/${todoId}/subtasks/${subtaskId}`, {
      method: 'DELETE',
    });
  }
}
