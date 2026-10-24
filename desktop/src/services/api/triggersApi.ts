import { ApiClient } from './client';
import { Trigger, TriggerLog } from '../../types';

export class TriggersApi {
  constructor(private client: ApiClient) {}

  async getTriggers(): Promise<Trigger[]> {
    const res = await this.client.request<any>('/api/v1/triggers');
    return Array.isArray(res) ? res : res.triggers || [];
  }

  async getTrigger(id: string): Promise<Trigger> {
    return this.client.request<Trigger>(`/api/v1/triggers/${id}`);
  }

  async createTrigger(input: Partial<Trigger> & { title: string; query: string }): Promise<Trigger> {
    return this.client.request<Trigger>('/api/v1/triggers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateTrigger(id: string, updates: Partial<Trigger>): Promise<Trigger> {
    return this.client.request<Trigger>(`/api/v1/triggers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteTrigger(id: string): Promise<void> {
    await this.client.request(`/api/v1/triggers/${id}`, { method: 'DELETE' });
  }

  async getTriggerLogs(id: string): Promise<TriggerLog[]> {
    const res = await this.client.request<any>(`/api/v1/triggers/${id}/logs`);
    return Array.isArray(res) ? res : res.logs || [];
  }

  async deleteTriggerLog(triggerId: string, logId: string): Promise<void> {
    await this.client.request(`/api/v1/triggers/${triggerId}/logs/${logId}`, { method: 'DELETE' });
  }

  async clearTriggerLogs(triggerId: string): Promise<void> {
    await this.client.request(`/api/v1/triggers/${triggerId}/logs`, { method: 'DELETE' });
  }

  async testTrigger(id: string): Promise<any> {
    return this.client.request(`/api/v1/triggers/${id}/test`, { method: 'POST' });
  }

  async runTrigger(id: string): Promise<TriggerLog> {
    return this.client.request(`/api/v1/triggers/${id}/run`, { method: 'POST' });
  }

  async toggleTrigger(id: string, active: boolean): Promise<any> {
    return this.client.request(`/api/v1/triggers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: active ? 'active' : 'paused' }),
    });
  }

  async getTriggerTemplates(): Promise<any[]> {
    const res = await this.client.request<any>('/api/v1/triggers/templates');
    return Array.isArray(res) ? res : res.templates || [];
  }

  async activateTriggerTemplate(templateId: string): Promise<Trigger> {
    return this.client.request(`/api/v1/triggers/templates/${templateId}/activate`, {
      method: 'POST',
    });
  }
}
