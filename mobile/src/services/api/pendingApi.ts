import { ApiClient } from './client';
import {
  PendingItem,
  PendingStatus,
  CreatePendingInput,
  UpdatePendingInput,
} from '../../types';

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

  async getPendingItem(id: string): Promise<PendingItem> {
    return this.client.request<PendingItem>(`/api/v1/pending/${id}`);
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
