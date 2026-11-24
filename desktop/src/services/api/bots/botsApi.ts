import { ApiClient } from '../client';
import {
  ActionPolicy,
  Bot,
  BotActivityItem,
  BotAppStatus,
  BotChatMessage,
  BotMemory,
  BotRunLog,
  BotSkin,
  BotTemplate,
  SkillPackage,
  isAlwaysAskAction,
} from '../../../types/bot';

export interface CreateBotInput {
  template_key?: string;
  title?: string;
  goal?: string;
  category?: string;
  skin?: BotSkin;
  skin_json?: string;
  triggers?: Array<{ kind: string; label: string; cron?: string }>;
  actions?: Array<{ action_key: string; policy: ActionPolicy }>;
  skills?: string[];
  rules?: string[];
  quiet_only_on_change?: boolean;
}

export type PendingDecision = 'allow_once' | 'always_allow' | 'deny';

export class BotsApi {
  constructor(private client: ApiClient) {}

  async getBots(): Promise<Bot[]> {
    const res = await this.client.request<{ bots?: Bot[] } | Bot[]>('/api/v1/bots');
    return Array.isArray(res) ? res : res.bots || [];
  }

  async getBot(id: string): Promise<Bot> {
    return this.client.request<Bot>(`/api/v1/bots/${id}`);
  }

  async createBot(input: CreateBotInput): Promise<Bot> {
    return this.client.request<Bot>('/api/v1/bots', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateBot(id: string, updates: Partial<Bot>): Promise<Bot> {
    return this.client.request<Bot>(`/api/v1/bots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async toggleBot(id: string, active: boolean): Promise<Bot> {
    return this.updateBot(id, { status: active ? 'active' : 'paused' });
  }

  async deleteBot(id: string): Promise<void> {
    await this.client.request(`/api/v1/bots/${id}`, { method: 'DELETE' });
  }

  async runBot(id: string): Promise<BotRunLog> {
    return this.client.request<BotRunLog>(`/api/v1/bots/${id}/run`, { method: 'POST' });
  }

  async getBotChat(id: string): Promise<BotChatMessage[]> {
    const res = await this.client.request<{ messages?: BotChatMessage[] } | BotChatMessage[]>(
      `/api/v1/bots/${id}/chat`
    );
    return Array.isArray(res) ? res : res.messages || [];
  }

  async sendBotChat(id: string, message: string): Promise<BotChatMessage> {
    return this.client.request<BotChatMessage>(`/api/v1/bots/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async addBotAction(id: string, actionKey: string, policy?: ActionPolicy): Promise<void> {
    const safePolicy = isAlwaysAskAction(actionKey) && policy === 'auto' ? 'ask' : policy;
    await this.client.request(`/api/v1/bots/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action_key: actionKey, policy: safePolicy }),
    });
  }

  async updateBotAction(
    id: string,
    actionKey: string,
    policy: ActionPolicy,
    alwaysAsk?: boolean
  ): Promise<void> {
    if (isAlwaysAskAction(actionKey, alwaysAsk) && policy === 'auto') {
      throw new Error('Esta ação sempre exige sua aprovação e não pode ficar automática.');
    }
    await this.client.request(`/api/v1/bots/${id}/actions/${actionKey}`, {
      method: 'PATCH',
      body: JSON.stringify({ policy }),
    });
  }

  async removeBotAction(id: string, actionKey: string): Promise<void> {
    await this.client.request(`/api/v1/bots/${id}/actions/${actionKey}`, {
      method: 'DELETE',
    });
  }

  async addBotSkill(id: string, skillKey: string): Promise<void> {
    await this.client.request(`/api/v1/bots/${id}/skills`, {
      method: 'POST',
      body: JSON.stringify({ skill_key: skillKey }),
    });
  }

  async removeBotSkill(id: string, skillKey: string): Promise<void> {
    await this.client.request(`/api/v1/bots/${id}/skills/${skillKey}`, {
      method: 'DELETE',
    });
  }

  async upgradeBotSkill(id: string, skillKey: string): Promise<void> {
    await this.client.request(`/api/v1/bots/${id}/skills/${skillKey}/upgrade`, {
      method: 'POST',
    });
  }

  async getBotMemories(id: string): Promise<BotMemory[]> {
    const res = await this.client.request<{ memories?: BotMemory[] } | BotMemory[]>(
      `/api/v1/bots/${id}/memories`
    );
    return Array.isArray(res) ? res : res.memories || [];
  }

  async addBotMemory(id: string, content: string): Promise<BotMemory> {
    return this.client.request<BotMemory>(`/api/v1/bots/${id}/memories`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteBotMemory(id: string, memId: string): Promise<void> {
    await this.client.request(`/api/v1/bots/${id}/memories/${memId}`, {
      method: 'DELETE',
    });
  }

  async resolvePending(
    botId: string,
    confirmationId: string,
    decision: PendingDecision,
    actionKey?: string,
    alwaysAsk?: boolean
  ): Promise<void> {
    if (decision === 'always_allow' && actionKey && isAlwaysAskAction(actionKey, alwaysAsk)) {
      throw new Error('Ações de envio não permitem "Sempre permitir".');
    }
    await this.client.request(`/api/v1/bots/${botId}/pending/${confirmationId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
  }

  async updateBotModel(id: string, modelPref: string, effortPref?: string): Promise<Bot> {
    return this.client.request<Bot>(`/api/v1/bots/${id}/model`, {
      method: 'PATCH',
      body: JSON.stringify({ model_pref: modelPref, effort_pref: effortPref || '' }),
    });
  }

  async getActivity(limit = 20): Promise<BotActivityItem[]> {
    const res = await this.client.request<{ activity?: BotActivityItem[] } | BotActivityItem[]>(
      `/api/v1/bots/activity?limit=${limit}`
    );
    return Array.isArray(res) ? res : res.activity || [];
  }

  async getCatalogTemplates(): Promise<BotTemplate[]> {
    const res = await this.client.request<{ templates?: BotTemplate[] } | BotTemplate[]>(
      '/api/v1/bots/catalog/templates'
    );
    return Array.isArray(res) ? res : res.templates || [];
  }

  async getCatalogSkills(): Promise<SkillPackage[]> {
    const res = await this.client.request<{ skills?: SkillPackage[] } | SkillPackage[]>(
      '/api/v1/bots/catalog/skills'
    );
    return Array.isArray(res) ? res : res.skills || [];
  }

  async getApps(): Promise<BotAppStatus[]> {
    const res = await this.client.request<{ apps?: BotAppStatus[] } | BotAppStatus[]>(
      '/api/v1/bots/apps'
    );
    return Array.isArray(res) ? res : res.apps || [];
  }

  async suggestApp(name: string, reason: string): Promise<void> {
    await this.client.request('/api/v1/bots/apps/suggest', {
      method: 'POST',
      body: JSON.stringify({ name, reason }),
    });
  }
}
