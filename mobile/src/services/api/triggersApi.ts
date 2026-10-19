import { ApiClient } from './client';
import { AI_ENDPOINT_TIMEOUT_MS } from '../../utils/requestTimeout';
import {
  Trigger,
  TriggerCategory,
  TriggerStatus,
  CreateTriggerInput,
  TriggerTestResult,
  TriggerLog,
  TriggerTemplate,
} from '../../types';
import { DEFAULT_TRIGGER_TEMPLATES } from '../../data/defaultTriggerTemplates';

export class TriggersApi {
  constructor(private client: ApiClient) {}

  async getTriggers(category?: TriggerCategory, status?: TriggerStatus): Promise<Trigger[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    const qs = params.toString();
    return this.client.request<Trigger[]>(`/api/v1/triggers${qs ? `?${qs}` : ''}`);
  }

  async getTrigger(id: string): Promise<Trigger> {
    return this.client.request<Trigger>(`/api/v1/triggers/${id}`);
  }

  async createTrigger(input: CreateTriggerInput): Promise<Trigger> {
    return this.client.request<Trigger>('/api/v1/triggers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async toggleTrigger(id: string): Promise<Trigger> {
    return this.client.request<Trigger>(`/api/v1/triggers/${id}/toggle`, {
      method: 'PATCH',
    });
  }

  async updateTrigger(
    id: string,
    input: Partial<CreateTriggerInput> & {
      status?: TriggerStatus;
      scheduled_time?: string;
      days_of_week?: string;
    }
  ): Promise<Trigger> {
    return this.client.request<Trigger>(`/api/v1/triggers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async testTrigger(id: string): Promise<TriggerTestResult> {
    return this.client.request<TriggerTestResult>(`/api/v1/triggers/${id}/test`, {
      method: 'POST',
      timeoutMs: AI_ENDPOINT_TIMEOUT_MS,
    });
  }

  async runTrigger(id: string): Promise<TriggerLog> {
    return this.client.request<TriggerLog>(`/api/v1/triggers/${id}/run`, {
      method: 'POST',
      timeoutMs: AI_ENDPOINT_TIMEOUT_MS,
    });
  }

  async deleteTrigger(id: string): Promise<void> {
    await this.client.request<void>(`/api/v1/triggers/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteTriggerLog(triggerId: string, logId: string): Promise<void> {
    await this.client.request<void>(`/api/v1/triggers/${triggerId}/logs/${logId}`, {
      method: 'DELETE',
    });
  }

  async clearTriggerLogs(triggerId: string): Promise<void> {
    await this.client.request<void>(`/api/v1/triggers/${triggerId}/logs`, {
      method: 'DELETE',
    });
  }

  async parseTriggerPrompt(prompt: string): Promise<{
    category: TriggerCategory;
    suggested_title: string;
    query: string;
    condition_type: string;
  }> {
    return this.client.request('/api/v1/triggers/parse', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async getTriggerLogs(id: string): Promise<TriggerLog[]> {
    return this.client.request<TriggerLog[]>(`/api/v1/triggers/${id}/logs`);
  }

  async getTemplates(): Promise<TriggerTemplate[]> {
    try {
      const raw = await this.client.request<any>('/api/v1/triggers/templates');
      const list = Array.isArray(raw) ? raw : (raw?.templates ?? raw?.data ?? []);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
      return DEFAULT_TRIGGER_TEMPLATES;
    } catch (err) {
      console.warn('[TriggersApi] Falha ao consultar templates da API, usando catálogo local:', err);
      return DEFAULT_TRIGGER_TEMPLATES;
    }
  }

  async activateTemplate(
    templateId: string,
    overrides?: { title?: string; query?: string; target_value?: string }
  ): Promise<Trigger> {
    return this.client.request<Trigger>(`/api/v1/triggers/templates/${templateId}/activate`, {
      method: 'POST',
      body: overrides ? JSON.stringify(overrides) : undefined,
    });
  }
}
