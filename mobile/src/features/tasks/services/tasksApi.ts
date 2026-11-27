import { ApiClient } from '../../../services/api/client';
import {
  CreatePendingInput,
  PendingItem,
  PendingStatus,
  Subtask,
  Todo,
  UpdatePendingInput,
} from '../../../types';

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

  async suggestSubtasks(todoId: string): Promise<Subtask[]> {
    const res = await this.client.request<{ subtasks?: Subtask[] }>(
      `/api/v1/todos/${todoId}/subtasks/suggest`,
      { method: 'POST' },
    );
    return Array.isArray(res?.subtasks) ? res.subtasks : [];
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

export class PendingApi {
  constructor(private client: ApiClient) {}

  async getPendingItems(status?: PendingStatus, category?: string): Promise<PendingItem[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.client.request<PendingItem[]>(`/api/v1/pending${qs}`);
  }

  async createPendingItem(data: CreatePendingInput): Promise<PendingItem> {
    return this.client.request<PendingItem>('/api/v1/pending', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePendingItem(id: string, data: UpdatePendingInput): Promise<PendingItem> {
    return this.client.request<PendingItem>(`/api/v1/pending/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async schedulePendingItem(id: string, scheduledDate: string): Promise<PendingItem> {
    return this.client.request<PendingItem>(`/api/v1/pending/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_date: scheduledDate }),
    });
  }

  async completePendingItem(id: string): Promise<PendingItem> {
    return this.client.request<PendingItem>(`/api/v1/pending/${id}/complete`, {
      method: 'POST',
    });
  }

  async deletePendingItem(id: string): Promise<void> {
    await this.client.request<void>(`/api/v1/pending/${id}`, {
      method: 'DELETE',
    });
  }
}
