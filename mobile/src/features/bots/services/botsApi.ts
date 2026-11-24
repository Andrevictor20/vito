import { ApiClient } from '../../../services/api/client';
import { AI_ENDPOINT_TIMEOUT_MS } from '../../../utils/network/requestTimeout';
import {
  DEFAULT_APPS_CATALOG,
  DEFAULT_BOT_TEMPLATES,
  DEFAULT_SKILL_PACKAGES,
} from '../data/botsCatalogFallback';
import {
  ActionPolicy,
  Bot,
  BotActivityItem,
  BotAppInfo,
  BotChatMessage,
  BotMemoryItem,
  BotRunReport,
  BotTemplate,
  CreateBotPayload,
  PendingResolutionDecision,
  SkillPackage,
  UpdateBotPayload,
} from '../types/bots';
import { isAlwaysAskAction } from '../utils/botsHelpers';
import type { UpdateModelPrefPayload } from '../../../types/aiProviders';

export class BotsApi {
  constructor(private client: ApiClient) {}

  async listBots(): Promise<Bot[]> {
    const raw = await this.client.request<Bot[] | { bots?: Bot[]; data?: Bot[] }>('/api/v1/bots');
    if (Array.isArray(raw)) return raw;
    return raw?.bots ?? raw?.data ?? [];
  }

  async createBot(payload: CreateBotPayload): Promise<Bot> {
    return this.client.request<Bot>('/api/v1/bots', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getBot(id: string): Promise<Bot> {
    return this.client.request<Bot>(`/api/v1/bots/${id}`);
  }

  async updateBot(id: string, payload: UpdateBotPayload): Promise<Bot> {
    return this.client.request<Bot>(`/api/v1/bots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteBot(id: string): Promise<void> {
    await this.client.request<void>(`/api/v1/bots/${id}`, {
      method: 'DELETE',
    });
  }

  async runBot(id: string): Promise<BotRunReport> {
    return this.client.request<BotRunReport>(`/api/v1/bots/${id}/run`, {
      method: 'POST',
      timeoutMs: AI_ENDPOINT_TIMEOUT_MS,
    });
  }

  async getBotChat(id: string): Promise<BotChatMessage[]> {
    const raw = await this.client.request<
      BotChatMessage[] | { messages?: BotChatMessage[]; data?: BotChatMessage[] }
    >(`/api/v1/bots/${id}/chat`);
    if (Array.isArray(raw)) return raw;
    return raw?.messages ?? raw?.data ?? [];
  }

  async sendBotChat(
    id: string,
    message: string
  ): Promise<{ reply?: BotChatMessage; messages?: BotChatMessage[] }> {
    return this.client.request(`/api/v1/bots/${id}/chat`, {
      method: 'POST',
      timeoutMs: AI_ENDPOINT_TIMEOUT_MS,
      body: JSON.stringify({ message }),
    });
  }

  async addBotAction(
    id: string,
    payload: { action_key: string; policy: ActionPolicy; always_ask?: boolean }
  ): Promise<Bot> {
    const safePolicy =
      isAlwaysAskAction(payload.action_key, payload.always_ask) && payload.policy === 'auto'
        ? 'ask'
        : payload.policy;
    return this.client.request<Bot>(`/api/v1/bots/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action_key: payload.action_key, policy: safePolicy }),
    });
  }

  async updateBotAction(
    id: string,
    actionKey: string,
    policy: ActionPolicy,
    alwaysAsk?: boolean
  ): Promise<Bot> {
    if (isAlwaysAskAction(actionKey, alwaysAsk) && policy === 'auto') {
      throw new Error('Esta ação sempre exige aprovação antes de executar.');
    }
    return this.client.request<Bot>(`/api/v1/bots/${id}/actions/${actionKey}`, {
      method: 'PATCH',
      body: JSON.stringify({ policy }),
    });
  }

  async removeBotAction(id: string, actionKey: string): Promise<Bot> {
    return this.client.request<Bot>(`/api/v1/bots/${id}/actions/${actionKey}`, {
      method: 'DELETE',
    });
  }

  async addBotSkill(id: string, skillKey: string): Promise<Bot> {
    return this.client.request<Bot>(`/api/v1/bots/${id}/skills`, {
      method: 'POST',
      body: JSON.stringify({ skill_key: skillKey }),
    });
  }

  async removeBotSkill(id: string, skillKey: string): Promise<Bot> {
    return this.client.request<Bot>(`/api/v1/bots/${id}/skills/${skillKey}`, {
      method: 'DELETE',
    });
  }

  async upgradeBotSkill(id: string, skillKey: string): Promise<Bot> {
    return this.client.request<Bot>(`/api/v1/bots/${id}/skills/${skillKey}/upgrade`, {
      method: 'POST',
    });
  }

  async getBotMemories(id: string): Promise<BotMemoryItem[]> {
    const raw = await this.client.request<
      BotMemoryItem[] | { memories?: BotMemoryItem[]; data?: BotMemoryItem[] }
    >(`/api/v1/bots/${id}/memories`);
    if (Array.isArray(raw)) return raw;
    return raw?.memories ?? raw?.data ?? [];
  }

  async addBotMemory(id: string, content: string): Promise<BotMemoryItem> {
    return this.client.request<BotMemoryItem>(`/api/v1/bots/${id}/memories`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteBotMemory(id: string, memId: string): Promise<void> {
    await this.client.request<void>(`/api/v1/bots/${id}/memories/${memId}`, {
      method: 'DELETE',
    });
  }

  async resolvePending(
    id: string,
    confirmationId: string,
    decision: PendingResolutionDecision,
    alwaysAsk?: boolean
  ): Promise<void> {
    if (alwaysAsk && decision === 'always_allow') {
      throw new Error('Ação protegida não permite "Sempre permitir".');
    }
    await this.client.request<void>(`/api/v1/bots/${id}/pending/${confirmationId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
  }

  async updateBotModel(id: string, payload: UpdateModelPrefPayload): Promise<void> {
    await this.client.request<void>(`/api/v1/bots/${id}/model`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getActivity(limit = 20): Promise<BotActivityItem[]> {
    const raw = await this.client.request<
      BotActivityItem[] | { activity?: BotActivityItem[]; items?: BotActivityItem[] }
    >(`/api/v1/bots/activity?limit=${limit}`);
    if (Array.isArray(raw)) return raw;
    return raw?.activity ?? raw?.items ?? [];
  }

  async getCatalogTemplates(): Promise<BotTemplate[]> {
    try {
      const raw = await this.client.request<
        BotTemplate[] | { templates?: BotTemplate[]; data?: BotTemplate[] }
      >('/api/v1/bots/catalog/templates');
      const list = Array.isArray(raw) ? raw : raw?.templates ?? raw?.data ?? [];
      return list.length > 0 ? list : DEFAULT_BOT_TEMPLATES;
    } catch {
      return DEFAULT_BOT_TEMPLATES;
    }
  }

  async getCatalogSkills(): Promise<SkillPackage[]> {
    try {
      const raw = await this.client.request<
        SkillPackage[] | { skills?: SkillPackage[]; data?: SkillPackage[] }
      >('/api/v1/bots/catalog/skills');
      const list = Array.isArray(raw) ? raw : raw?.skills ?? raw?.data ?? [];
      return list.length > 0 ? list : DEFAULT_SKILL_PACKAGES;
    } catch {
      return DEFAULT_SKILL_PACKAGES;
    }
  }

  async getApps(): Promise<BotAppInfo[]> {
    try {
      const raw = await this.client.request<
        BotAppInfo[] | { apps?: BotAppInfo[]; data?: BotAppInfo[] }
      >('/api/v1/bots/apps');
      const list = Array.isArray(raw) ? raw : raw?.apps ?? raw?.data ?? [];
      return list.length > 0 ? list : DEFAULT_APPS_CATALOG;
    } catch {
      return DEFAULT_APPS_CATALOG;
    }
  }

  async suggestApp(name: string, reason: string): Promise<void> {
    await this.client.request<void>('/api/v1/bots/apps/suggest', {
      method: 'POST',
      body: JSON.stringify({ name, reason }),
    });
  }
}
