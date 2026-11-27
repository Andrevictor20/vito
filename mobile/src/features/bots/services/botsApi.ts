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
  BotRunReport,
  BotTemplate,
  CreateBotPayload,
  PendingResolutionDecision,
  SkillPackage,
  UpdateBotPayload,
} from '../types/bots';
import { isAlwaysAskAction } from '../utils/botsHelpers';
import {
  normalizeBot,
  normalizeBotActivity,
  normalizeBotApps,
  normalizeBotTemplates,
  normalizeSkillPackages,
} from '../utils/botsNormalizers';
import type { UpdateModelPrefPayload } from '../../../types/aiProviders';

export class BotsApi {
  constructor(private client: ApiClient) {}

  async listBots(): Promise<Bot[]> {
    const raw = await this.client.request<Bot[] | { bots?: Bot[]; data?: Bot[] }>('/api/v1/bots');
    const list = Array.isArray(raw) ? raw : raw?.bots ?? raw?.data ?? [];
    return list.map(normalizeBot);
  }

  async getBot(id: string): Promise<Bot> {
    const raw = await this.client.request<Bot>(`/api/v1/bots/${id}`);
    return normalizeBot(raw);
  }

  async createBot(payload: CreateBotPayload): Promise<Bot> {
    const raw = await this.client.request<Bot>('/api/v1/bots', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeBot(raw);
  }

  async updateBot(id: string, payload: UpdateBotPayload): Promise<Bot> {
    const body: UpdateBotPayload = { ...payload };
    if (body.quiet !== undefined && body.quiet_only_on_change === undefined) {
      body.quiet_only_on_change = body.quiet;
    }
    const raw = await this.client.request<Bot>(`/api/v1/bots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return normalizeBot(raw);
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
    const raw = await this.client.request<
      BotChatMessage | { reply?: BotChatMessage; messages?: BotChatMessage[] }
    >(`/api/v1/bots/${id}/chat`, {
      method: 'POST',
      timeoutMs: AI_ENDPOINT_TIMEOUT_MS,
      body: JSON.stringify({ message }),
    });
    if (raw && !Array.isArray((raw as { messages?: BotChatMessage[] }).messages) && !('reply' in raw)) {
      return { reply: raw as BotChatMessage };
    }
    return raw as { reply?: BotChatMessage; messages?: BotChatMessage[] };
  }

  async addBotAction(
    id: string,
    payload: { action_key: string; policy: ActionPolicy; always_ask?: boolean }
  ): Promise<Bot> {
    const safePolicy =
      isAlwaysAskAction(payload.action_key, payload.always_ask) && payload.policy === 'auto'
        ? 'ask'
        : payload.policy;
    const raw = await this.client.request<Bot>(`/api/v1/bots/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action_key: payload.action_key, policy: safePolicy }),
    });
    return normalizeBot(raw);
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
    const raw = await this.client.request<Bot>(`/api/v1/bots/${id}/actions/${actionKey}`, {
      method: 'PATCH',
      body: JSON.stringify({ policy }),
    });
    return normalizeBot(raw);
  }

  async removeBotAction(id: string, actionKey: string): Promise<Bot> {
    const raw = await this.client.request<Bot>(`/api/v1/bots/${id}/actions/${actionKey}`, {
      method: 'DELETE',
    });
    return normalizeBot(raw);
  }

  async addBotSkill(id: string, skillKey: string): Promise<Bot> {
    const raw = await this.client.request<Bot>(`/api/v1/bots/${id}/skills`, {
      method: 'POST',
      body: JSON.stringify({ skill_key: skillKey }),
    });
    return normalizeBot(raw);
  }

  async removeBotSkill(id: string, skillKey: string): Promise<Bot> {
    const raw = await this.client.request<Bot>(`/api/v1/bots/${id}/skills/${skillKey}`, {
      method: 'DELETE',
    });
    return normalizeBot(raw);
  }

  async upgradeBotSkill(id: string, skillKey: string): Promise<Bot> {
    const raw = await this.client.request<Bot>(`/api/v1/bots/${id}/skills/${skillKey}/upgrade`, {
      method: 'POST',
    });
    return normalizeBot(raw);
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
    const list = Array.isArray(raw) ? raw : raw?.activity ?? raw?.items ?? [];
    return normalizeBotActivity(list);
  }

  async getCatalogTemplates(): Promise<BotTemplate[]> {
    try {
      const raw = await this.client.request<
        BotTemplate[] | { templates?: BotTemplate[]; data?: BotTemplate[] }
      >('/api/v1/bots/catalog/templates');
      const list = Array.isArray(raw) ? raw : raw?.templates ?? raw?.data ?? [];
      return list.length > 0 ? normalizeBotTemplates(list) : DEFAULT_BOT_TEMPLATES;
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
      return list.length > 0 ? normalizeSkillPackages(list) : DEFAULT_SKILL_PACKAGES;
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
      return list.length > 0 ? normalizeBotApps(list) : DEFAULT_APPS_CATALOG;
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
