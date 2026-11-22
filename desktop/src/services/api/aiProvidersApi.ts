import { ApiClient } from './client';
import {
  AiModelGroup,
  AiModelItem,
  AiPreferences,
  AiProviderInfo,
  AiProviderKey,
  ThreadModelPref,
} from '../../types';

export interface ConnectAiProviderInput {
  api_key: string;
  base_url?: string;
}

export interface TestAiProviderResponse {
  status: 'ok' | 'invalid' | string;
  valid?: boolean;
  message?: string;
  model_count?: number;
  models?: AiModelItem[];
}

export class AiProvidersApi {
  constructor(private client: ApiClient) {}

  async listProviders(): Promise<AiProviderInfo[]> {
    const res = await this.client.request<AiProviderInfo[] | { providers?: AiProviderInfo[] }>(
      '/api/v1/ai/providers',
      { method: 'GET' }
    );
    return Array.isArray(res) ? res : res?.providers || [];
  }

  async connectProvider(
    providerKey: AiProviderKey,
    input: ConnectAiProviderInput
  ): Promise<AiProviderInfo> {
    return this.client.request<AiProviderInfo>(`/api/v1/ai/providers/${providerKey}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async testProvider(providerKey: AiProviderKey): Promise<TestAiProviderResponse> {
    return this.client.request<TestAiProviderResponse>(
      `/api/v1/ai/providers/${providerKey}/test`,
      { method: 'POST' }
    );
  }

  async removeProvider(providerKey: AiProviderKey): Promise<{ status?: string }> {
    return this.client.request<{ status?: string }>(`/api/v1/ai/providers/${providerKey}`, {
      method: 'DELETE',
    });
  }

  async getProviderModels(
    providerKey: AiProviderKey,
    refresh = false
  ): Promise<AiModelItem[]> {
    const query = refresh ? '?refresh=1' : '';
    const res = await this.client.request<AiModelItem[] | { models?: AiModelItem[] }>(
      `/api/v1/ai/providers/${providerKey}/models${query}`,
      { method: 'GET' }
    );
    return Array.isArray(res) ? res : res?.models || [];
  }

  async listSelectableModels(): Promise<AiModelGroup[]> {
    const res = await this.client.request<AiModelGroup[] | { groups?: AiModelGroup[]; providers?: AiModelGroup[] }>(
      '/api/v1/ai/models',
      { method: 'GET' }
    );
    if (Array.isArray(res)) return res;
    return res?.groups || res?.providers || [];
  }

  async getPreferences(): Promise<AiPreferences> {
    return this.client.request<AiPreferences>('/api/v1/ai/preferences', {
      method: 'GET',
    });
  }

  async updatePreferences(data: Partial<AiPreferences>): Promise<AiPreferences> {
    return this.client.request<AiPreferences>('/api/v1/ai/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateThreadModel(
    threadId: string,
    data: ThreadModelPref
  ): Promise<ThreadModelPref> {
    return this.client.request<ThreadModelPref>(`/api/v1/threads/${threadId}/model`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateBotModel(
    botId: string,
    data: ThreadModelPref
  ): Promise<ThreadModelPref> {
    return this.client.request<ThreadModelPref>(`/api/v1/bots/${botId}/model`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}
