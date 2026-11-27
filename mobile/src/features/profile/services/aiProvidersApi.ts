import { ApiClient } from '../../../services/api/client';
import type {
  AIPreferences,
  AIProviderKey,
  ConnectProviderPayload,
  ModelProviderGroup,
  TestProviderResponse,
  UpdateModelPrefPayload,
  UserAIProvider,
} from '../../../types/aiProviders';
import { AI_PROVIDER_CATALOG, buildServerFallbackGroup } from '../../../services/ai/aiProviderCatalog';

export class AiProvidersApi {
  constructor(private client: ApiClient) {}

  async listProviders(): Promise<UserAIProvider[]> {
    const res = await this.client.request<UserAIProvider[] | { providers?: UserAIProvider[] }>(
      '/api/v1/ai/providers'
    );
    if (Array.isArray(res)) return res;
    return Array.isArray(res?.providers) ? res.providers : [];
  }

  async connectProvider(
    providerKey: AIProviderKey,
    payload: ConnectProviderPayload
  ): Promise<UserAIProvider> {
    return this.client.request<UserAIProvider>(`/api/v1/ai/providers/${providerKey}`, {
      method: 'PUT',
      timeoutMs: 25000,
      body: JSON.stringify(payload),
    });
  }

  async testProvider(providerKey: AIProviderKey): Promise<TestProviderResponse> {
    return this.client.request<TestProviderResponse>(`/api/v1/ai/providers/${providerKey}/test`, {
      method: 'POST',
      timeoutMs: 20000,
      body: JSON.stringify({}),
    });
  }

  async removeProvider(providerKey: AIProviderKey): Promise<{ status: string }> {
    return this.client.request<{ status: string }>(`/api/v1/ai/providers/${providerKey}`, {
      method: 'DELETE',
    });
  }

  async listSelectableModels(): Promise<ModelProviderGroup[]> {
    const res = await this.client.request<
      ModelProviderGroup[] | { groups?: ModelProviderGroup[]; providers?: ModelProviderGroup[] }
    >('/api/v1/ai/models');
    const raw = Array.isArray(res) ? res : res?.groups || res?.providers || [];
    const normalized = raw.map((g) => ({
      ...g,
      name: g.name || AI_PROVIDER_CATALOG[g.provider_key]?.name || g.provider_key,
      status: g.status || 'ok',
      models: Array.isArray(g.models) ? g.models : [],
    }));
    if (!normalized.some((g) => g.provider_key === 'srv')) {
      return [buildServerFallbackGroup(), ...normalized];
    }
    return normalized;
  }

  async getPreferences(): Promise<AIPreferences> {
    const res = await this.client.request<AIPreferences>('/api/v1/ai/preferences');
    return {
      default_model: res?.default_model || 'srv:auto',
      default_effort: res?.default_effort || 'auto',
    };
  }

  async updatePreferences(prefs: Partial<AIPreferences>): Promise<AIPreferences> {
    return this.client.request<AIPreferences>('/api/v1/ai/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  }

  async updateThreadModel(threadId: string, payload: UpdateModelPrefPayload): Promise<void> {
    await this.client.request<void>(`/api/v1/threads/${threadId}/model`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async updateBotModel(botId: string, payload: UpdateModelPrefPayload): Promise<void> {
    await this.client.request<void>(`/api/v1/bots/${botId}/model`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
}
