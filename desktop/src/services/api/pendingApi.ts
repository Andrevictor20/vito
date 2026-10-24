import { ApiClient } from './client';
import { PendingItem } from '../../types';

export class PendingApi {
  constructor(private client: ApiClient) {}

  async getPendingItems(status?: string, category?: string): Promise<PendingItem[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await this.client.request<any>(`/api/v1/pending${q}`);
    return Array.isArray(res) ? res : res.items || [];
  }

  async getPendingItem(id: string): Promise<PendingItem> {
    return this.client.request<PendingItem>(`/api/v1/pending/${id}`);
  }

  async createPendingItem(data: Partial<PendingItem>): Promise<PendingItem> {
    return this.client.request<PendingItem>('/api/v1/pending', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePendingItem(id: string, data: Partial<PendingItem>): Promise<PendingItem> {
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
    await this.client.request(`/api/v1/pending/${id}`, { method: 'DELETE' });
  }
}
