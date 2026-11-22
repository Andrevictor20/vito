import { describe, it, expect, vi } from 'vitest';
import { AiProvidersApi } from '../aiProvidersApi';
import type { ApiClient } from '../client';

function createMockClient() {
  const request = vi.fn().mockResolvedValue({});
  return {
    client: { request } as unknown as ApiClient,
    request,
  };
}

describe('AiProvidersApi (Contrato REST Plano 03 §5)', () => {
  it('GET /api/v1/ai/providers lista provedores', async () => {
    const { client, request } = createMockClient();
    request.mockResolvedValueOnce({
      providers: [{ provider_key: 'google', status: 'ok', key_last4: '9xQ2' }],
    });

    const api = new AiProvidersApi(client);
    const list = await api.listProviders();

    expect(request).toHaveBeenCalledWith('/api/v1/ai/providers', { method: 'GET' });
    expect(list).toHaveLength(1);
    expect(list[0].key_last4).toBe('9xQ2');
  });

  it('PUT /api/v1/ai/providers/:key envia api_key e base_url opcional', async () => {
    const { client, request } = createMockClient();
    const api = new AiProvidersApi(client);

    await api.connectProvider('custom', {
      api_key: 'secret-123',
      base_url: 'http://192.168.0.20:11434/v1',
    });

    expect(request).toHaveBeenCalledWith('/api/v1/ai/providers/custom', {
      method: 'PUT',
      body: JSON.stringify({
        api_key: 'secret-123',
        base_url: 'http://192.168.0.20:11434/v1',
      }),
    });
  });

  it('POST /api/v1/ai/providers/:key/test e DELETE /api/v1/ai/providers/:key', async () => {
    const { client, request } = createMockClient();
    const api = new AiProvidersApi(client);

    await api.testProvider('anthropic');
    expect(request).toHaveBeenCalledWith('/api/v1/ai/providers/anthropic/test', {
      method: 'POST',
    });

    await api.removeProvider('anthropic');
    expect(request).toHaveBeenCalledWith('/api/v1/ai/providers/anthropic', {
      method: 'DELETE',
    });
  });

  it('GET /api/v1/ai/providers/:key/models?refresh=1 e GET /api/v1/ai/models', async () => {
    const { client, request } = createMockClient();
    request.mockResolvedValueOnce({ models: [{ id: 'sonnet', name: 'Claude Sonnet 5.5' }] });
    const api = new AiProvidersApi(client);

    const models = await api.getProviderModels('anthropic', true);
    expect(request).toHaveBeenCalledWith('/api/v1/ai/providers/anthropic/models?refresh=1', {
      method: 'GET',
    });
    expect(models).toHaveLength(1);

    request.mockResolvedValueOnce({
      groups: [{ provider_key: 'srv', provider_name: 'Servidor do Vito', models: [] }],
    });
    const groups = await api.listSelectableModels();
    expect(request).toHaveBeenCalledWith('/api/v1/ai/models', { method: 'GET' });
    expect(groups).toHaveLength(1);
  });

  it('GET/PUT /api/v1/ai/preferences, PATCH threads/:id/model e PATCH bots/:id/model', async () => {
    const { client, request } = createMockClient();
    const api = new AiProvidersApi(client);

    await api.getPreferences();
    expect(request).toHaveBeenCalledWith('/api/v1/ai/preferences', { method: 'GET' });

    await api.updatePreferences({ default_model: 'google:g36f', default_effort: 'high' });
    expect(request).toHaveBeenCalledWith('/api/v1/ai/preferences', {
      method: 'PUT',
      body: JSON.stringify({ default_model: 'google:g36f', default_effort: 'high' }),
    });

    await api.updateThreadModel('thread-1', { model_pref: 'openai:gpt55', effort_pref: 'med' });
    expect(request).toHaveBeenCalledWith('/api/v1/threads/thread-1/model', {
      method: 'PATCH',
      body: JSON.stringify({ model_pref: 'openai:gpt55', effort_pref: 'med' }),
    });

    await api.updateBotModel('bot-1', { model_pref: 'anthropic:sonnet', effort_pref: 'low' });
    expect(request).toHaveBeenCalledWith('/api/v1/bots/bot-1/model', {
      method: 'PATCH',
      body: JSON.stringify({ model_pref: 'anthropic:sonnet', effort_pref: 'low' }),
    });
  });
});
